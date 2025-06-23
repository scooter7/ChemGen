// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { Buffer } from 'buffer';

// Initialize clients
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const VIDEO_BUCKET_NAME = 'generated-videos';

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export async function POST(req: NextRequest) {
  if (!process.env.GOOGLE_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("One or more environment variables are not set.");
    return NextResponse.json(
      { error: 'Server is not configured correctly.' },
      { status: 500 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const prompt = formData.get('prompt') as string | null;
  if (!file || !prompt) {
    return NextResponse.json(
      { error: 'Both an image file and a prompt are required.' },
      { status: 400 }
    );
  }

  try {
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const base64Image = imageBuffer.toString('base64');
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });
    
    const result = await model.generateContent([
        `Animate this image based on the following prompt: "${prompt}"`,
        {
            inlineData: {
                data: base64Image,
                mimeType: file.type,
            }
        }
    ]);

    const response = result.response;
    const firstPart = response.candidates?.[0]?.content?.parts?.[0];

    // Check for the existence of firstPart and fileData before using them
    if (!firstPart || !('fileData' in firstPart) || !firstPart.fileData) {
      console.error("No video data found in the Gemini API response:", response);
      return NextResponse.json(
        { error: 'The video generation service did not return a video.' },
        { status: 500 }
      );
    }
    
    // Now that we've checked for fileData, TypeScript knows it's safe to use
    const videoBase64 = firstPart.fileData.fileUri.split(',')[1];
    const videoBuffer = Buffer.from(videoBase64, 'base64');
    const videoMimeType = firstPart.fileData.mimeType;
    
    const videoFileName = `generated-video-${userId}-${nanoid()}.mp4`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from(VIDEO_BUCKET_NAME)
        .upload(videoFileName, videoBuffer, {
            contentType: videoMimeType,
            upsert: false
        });

    if (uploadError) {
        console.error("Supabase video upload error:", uploadError);
        throw new Error("Could not save the generated video.");
    }

    const { data: publicUrlData } = supabaseAdmin.storage
        .from(VIDEO_BUCKET_NAME)
        .getPublicUrl(uploadData.path);

    const publicVideoUrl = publicUrlData.publicUrl;

    if (!publicVideoUrl) {
      throw new Error("Could not get a public URL for the generated video.");
    }

    return NextResponse.json({ videoUrl: publicVideoUrl }, { status: 200 });

  } catch (error) {
    console.error('An unexpected error occurred in generate-video API:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { error: `An unexpected error occurred: ${errorMessage}` },
      { status: 500 }
    );
  }
}