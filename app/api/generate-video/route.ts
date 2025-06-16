// app/api/generate-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, type DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import Replicate from 'replicate';

interface VideoRequest {
  imageUrl: string;
}

// Augment the session type to include the user ID
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

// Initialize Replicate with the API token
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Supabase admin client for uploading the final video
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
const VIDEO_BUCKET = 'generated-videos';

// CORRECTED: The latest, correct model version on Replicate
const STABLE_VIDEO_DIFFUSION_MODEL = "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172638";

export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json({ error: 'Replicate API token is not configured.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as VideoRequest;
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required.' }, { status: 400 });
    }

    // 1. Run the prediction on Replicate
    const output = await replicate.run(
      STABLE_VIDEO_DIFFUSION_MODEL,
      {
        input: {
          input_image: imageUrl,
          decoding_t: 7, // Motion strength
          video_length: '25_frames_with_svd_xt', // Output length
          sizing_strategy: 'maintain_aspect_ratio',
          motion_bucket_id: 127,
          frames_per_second: 6
        }
      }
    );
    
    const generatedVideoUrl = output as unknown as string;

    if (!generatedVideoUrl) {
        throw new Error("Video generation failed: Replicate did not return a video URL.");
    }
    
    // 2. Fetch the generated video to store it ourselves
    const videoResponse = await fetch(generatedVideoUrl);
    if (!videoResponse.ok) {
        throw new Error(`Failed to fetch generated video from Replicate: ${videoResponse.statusText}`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // 3. Upload the new video to our own Supabase Storage
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

    // 4. Get the public URL for our copy of the video
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
