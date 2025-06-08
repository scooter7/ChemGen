// app/api/images/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import type { DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { initPrisma } from '@/lib/prismaInit';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { nanoid } from 'nanoid';

// Augment the next-auth module to include the 'id' property
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

const prisma = initPrisma();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("CRITICAL: Supabase environment variables not set for image upload route.");
}
const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!);

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("CRITICAL: GEMINI_API_KEY is not set for image upload route.");
}
const genAI = new GoogleGenerativeAI(API_KEY || "");
const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

const IMAGE_BUCKET_NAME = 'image-library';

async function generateDescriptionForImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  try {
    const imagePart: Part = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType,
      },
    };
    
    const prompt = "Describe this image in detail for a university's marketing team. Focus on key elements, mood, potential use cases, and any notable features. Make it suitable for alt text or for finding the image later via search.";
    
    const result = await visionModel.generateContent([prompt, imagePart]);
    const response = result.response;
    const description = response.text();
    console.log("AI Generated Image Description:", description);
    return description;
  } catch (error) {
    console.error("Error generating image description with AI:", error);
    throw new Error("AI failed to generate image description.");
  }
}

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey || !API_KEY) {
    return NextResponse.json({ message: 'Server configuration error for image processing.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No image file provided.' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
        return NextResponse.json({ message: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const aiDescription = await generateDescriptionForImage(fileBuffer, file.type);

    const fileExtension = file.name.split('.').pop() || 'png';
    const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const uniqueFilenameSuffix = nanoid(8);
    const filePathInBucket = `images/${userId}/${originalNameWithoutExt}_${uniqueFilenameSuffix}.${fileExtension}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(IMAGE_BUCKET_NAME)
      .upload(filePathInBucket, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase Storage image upload error:', uploadError);
      throw new Error(uploadError.message || 'Failed to upload image to Supabase Storage.');
    }
    if (!uploadData || !uploadData.path) {
      throw new Error('Supabase Storage image upload failed: No path returned.');
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(IMAGE_BUCKET_NAME).getPublicUrl(uploadData.path);
    const publicUrl = publicUrlData?.publicUrl;

    const newImageResource = await prisma.imageResource.create({
      data: {
        userId: userId,
        fileName: file.name,
        fileType: file.type,
        storagePath: uploadData.path,
        publicUrl: publicUrl || null,
        aiGeneratedDescription: aiDescription,
        fileSize: file.size,
      },
    });

    return NextResponse.json(
      { message: 'Image uploaded and described successfully!', imageResource: newImageResource },
      { status: 201 }
    );

  } catch (error) {
    console.error('Image upload & description route error:', error);
    let errorMessage = 'An unexpected error occurred during image processing.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Image processing failed.', error: errorMessage }, { status: 500 });
  }
}