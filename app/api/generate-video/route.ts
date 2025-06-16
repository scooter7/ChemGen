// app/api/generate-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

interface VideoRequest {
  imageUrl: string;
  prompt?: string;
}

const HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt";
const HF_TOKEN = process.env.HUGGING_FACE_TOKEN;

// Supabase admin client for uploading the final video
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
const VIDEO_BUCKET = 'generated-videos';

export async function POST(req: NextRequest) {
  if (!HF_TOKEN) {
    return NextResponse.json({ error: 'Hugging Face API token is not configured.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as VideoRequest;
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required.' }, { status: 400 });
    }

    // 1. Fetch the user-selected image from its public URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
    }
    const imageBlob = await imageResponse.blob();

    // 2. Call the Hugging Face Inference API
    const hfResponse = await fetch(HUGGING_FACE_API_URL, {
        headers: { Authorization: `Bearer ${HF_TOKEN}` },
        method: "POST",
        body: imageBlob,
    });

    if (!hfResponse.ok) {
        const errorText = await hfResponse.text();
        console.error("Hugging Face API Error:", errorText);
        throw new Error(`Hugging Face API failed: ${errorText}`);
    }

    // 3. Get the generated video as a blob
    const videoBlob = await hfResponse.blob();
    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

    // 4. Upload the new video to Supabase Storage
    const videoId = nanoid();
    const filePathInBucket = `videos/${session.user.id}/${videoId}.mp4`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .upload(filePathInBucket, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
        throw new Error(`Failed to upload video to Supabase: ${uploadError.message}`);
    }

    // 5. Get the public URL for the newly uploaded video
    const { data: publicUrlData } = supabaseAdmin.storage.from(VIDEO_BUCKET).getPublicUrl(filePathInBucket);
    
    return NextResponse.json(
      { 
        message: 'Video generated successfully!',
        videoUrl: publicUrlData.publicUrl
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in video generation route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
