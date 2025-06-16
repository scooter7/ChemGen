// app/api/generate-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, type DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import Replicate from 'replicate';

interface VideoRequest {
  prompt: string;
}

// Augment NextAuth’s Session type to include `user.id`
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// Supabase admin client for uploads
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
const VIDEO_BUCKET = 'generated-videos';

// Your Veo-3 model slug + version from .env
const VIDEO_MODEL = process.env
  .REPLICATE_VIDEO_MODEL! as `${string}/${string}` | `${string}/${string}:${string}`;

export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: 'Replicate API token is not configured.' },
      { status: 500 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1️⃣ Parse & validate prompt
    const { prompt } = (await req.json()) as VideoRequest;
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid `prompt` in request body.' },
        { status: 400 }
      );
    }

    // 2️⃣ Run Veo-3 (text→video)
    const output = await replicate.run(VIDEO_MODEL, {
      input: { prompt },
    });
    const videoUrl = output as unknown as string;
    if (!videoUrl) {
      throw new Error('Replicate did not return a video URL.');
    }

    // 3️⃣ Download the generated video
    const resp = await fetch(videoUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch video: ${resp.statusText}`);
    }
    const videoBuffer = Buffer.from(await resp.arrayBuffer());

    // 4️⃣ Upload to Supabase
    const videoId = nanoid();
    const path = `videos/${session.user.id}/${videoId}.mp4`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .upload(path, videoBuffer, { contentType: 'video/mp4' });
    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    // 5️⃣ Return your public URL
    const { data } = supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .getPublicUrl(path);

    return NextResponse.json(
      { message: 'Video generated!', videoUrl: data.publicUrl },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Video route error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
