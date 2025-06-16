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
  auth: process.env.REPLICATE_API_TOKEN!,
});

// Supabase admin client for uploading the final video
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
const VIDEO_BUCKET = 'generated-videos';

// Read the model slug (and version hash) from env
const VIDEO_MODEL = process.env.REPLICATE_VIDEO_MODEL!;

export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: 'Replicate API token is not configured.' },
      { status: 500 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageUrl } = (await req.json()) as VideoRequest;
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required.' },
        { status: 400 }
      );
    }

    // 1. Run the prediction on Replicate using your chosen model
    const output = await replicate.run(VIDEO_MODEL, {
      input: {
        input_image: imageUrl,
        decoding_t: 7,                       // Motion strength
        video_length: '25_frames_with_svd_xt',
        sizing_strategy: 'maintain_aspect_ratio',
        motion_bucket_id: 127,
        frames_per_second: 6,
      },
    });

    const generatedVideoUrl = output as unknown as string;
    if (!generatedVideoUrl) {
      throw new Error(
        'Video generation failed: Replicate did not return a video URL.'
      );
    }

    // 2. Fetch the video bytes
    const videoResponse = await fetch(generatedVideoUrl);
    if (!videoResponse.ok) {
      throw new Error(
        `Failed to fetch generated video: ${videoResponse.statusText}`
      );
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // 3. Upload to Supabase Storage
    const videoId = nanoid();
    const filePathInBucket = `videos/${session.user.id}/${videoId}.mp4`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .upload(filePathInBucket, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    // 4. Make it public and return the URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .getPublicUrl(filePathInBucket);

    return NextResponse.json(
      {
        message: 'Video generated successfully!',
        videoUrl: publicUrlData.publicUrl,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    // Narrow the error type so we don’t use `any`
    const message =
      error instanceof Error ? error.message : String(error);
    console.error('Error in video generation route:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
