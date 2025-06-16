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
    return NextResponse.json({ error: 'Hugging Face API token is not configured on the server.' }, { status: 500 });
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

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
        throw new Error(`Failed to fetch the provided image from its URL.`);
    }
    const imageBlob = await imageResponse.blob();

    const hfResponse = await fetch(HUGGING_FACE_API_URL, {
        headers: { Authorization: `Bearer ${HF_TOKEN}` },
        method: "POST",
        body: imageBlob,
    });

    if (!hfResponse.ok) {
        // Provide more specific error messages for common Hugging Face issues
        if (hfResponse.status === 404) {
            throw new Error("The video generation model was not found. It might be offline or has been moved.");
        }
        if (hfResponse.status === 503) {
            throw new Error("The video generation model is currently loading. Please wait a minute and try again.");
        }
        const errorText = await hfResponse.text();
        console.error("Hugging Face API Error:", errorText);
        throw new Error(`The video generation service failed with status ${hfResponse.status}: ${errorText}`);
    }

    const videoBlob = await hfResponse.blob();
    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

    const videoId = nanoid();
    const filePathInBucket = `videos/${session.user.id}/${videoId}.mp4`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .upload(filePathInBucket, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
        throw new Error(`Failed to upload generated video to storage: ${uploadError.message}`);
    }

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
