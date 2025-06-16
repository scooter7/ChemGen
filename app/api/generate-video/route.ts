// app/api/generate-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, type DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import Replicate from 'replicate';

export const runtime = 'nodejs';
export const revalidate = 0;

interface CreateRequest {
  prompt: string;
}

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });
const MODEL = process.env
  .REPLICATE_VIDEO_MODEL! as `${string}/${string}` | `${string}/${string}:${string}`;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const VIDEO_BUCKET = 'generated-videos';

export async function POST(req: NextRequest) {
  // 1️⃣ Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2️⃣ Validate prompt
  const { prompt } = (await req.json()) as CreateRequest;
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json(
      { error: 'Missing or invalid `prompt` in body' },
      { status: 400 }
    );
  }

  // 3️⃣ Kick off the async job
  try {
    const prediction = await replicate.predictions.create({
      version: MODEL,
      input: { prompt },
    });
    return NextResponse.json({ id: prediction.id }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('POST /api/generate-video error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // 1️⃣ Auth check (optional but recommended)
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2️⃣ Read the prediction ID
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: 'Missing `id` query parameter' },
      { status: 400 }
    );
  }

  try {
    // 3️⃣ Check Replicate status
    const pred = await replicate.predictions.get(id);

    if (pred.status !== 'succeeded') {
      // Still processing (or errored)—just forward status & error
      return NextResponse.json(
        { status: pred.status, error: pred.error ?? null },
        { status: 200 }
      );
    }

    // 4️⃣ When succeeded: download the file, upload to Supabase
    const videoUrl = pred.output as string;
    const resp = await fetch(videoUrl);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.statusText}`);
    const buffer = Buffer.from(await resp.arrayBuffer());

    const videoId = nanoid();
    const path = `videos/${session.user.id}/${videoId}.mp4`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .upload(path, buffer, { contentType: 'video/mp4' });
    if (uploadError) throw uploadError;

    const { data } = supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .getPublicUrl(path);

    // 5️⃣ Return final URL
    return NextResponse.json(
      { status: 'succeeded', videoUrl: data.publicUrl },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('GET /api/generate-video error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
