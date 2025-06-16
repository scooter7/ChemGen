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
const MODEL = process.env.REPLICATE_VIDEO_MODEL! as `${string}/${string}` | `${string}/${string}:${string}`;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const VIDEO_BUCKET = 'generated-videos';

export async function POST(req: NextRequest) {
  console.log('[DEBUG] POST /api/generate-video called');
  let session;
  try {
    session = await getServerSession(authOptions);
    console.log('[DEBUG] Session:', session);
  } catch (err) {
    console.error('[DEBUG] Failed to get session:', err);
  }
  if (!session?.user?.id) {
    console.log('[DEBUG] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = (await req.json()) as CreateRequest;
    console.log('[DEBUG] Request body:', body);
  } catch (err) {
    console.error('[DEBUG] Failed to parse JSON body:', err);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt } = body;
  if (!prompt || typeof prompt !== 'string') {
    console.log('[DEBUG] Missing or invalid prompt');
    return NextResponse.json(
      { error: 'Missing or invalid `prompt` in body' },
      { status: 400 }
    );
  }

  try {
    console.log('[DEBUG] Creating prediction for prompt:', prompt);
    const prediction = await replicate.predictions.create({
      version: MODEL,
      input: { prompt },
    });
    console.log('[DEBUG] Prediction created:', prediction.id, prediction);
    return NextResponse.json({ id: prediction.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DEBUG] Error creating prediction:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  console.log('[DEBUG] GET /api/generate-video called with URL:', req.url);
  let session;
  try {
    session = await getServerSession(authOptions);
    console.log('[DEBUG] Session:', session);
  } catch (err) {
    console.error('[DEBUG] Failed to get session:', err);
  }
  if (!session?.user?.id) {
    console.log('[DEBUG] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  console.log('[DEBUG] Query param id:', id);
  if (!id) {
    console.log('[DEBUG] Missing id parameter');
    return NextResponse.json(
      { error: 'Missing `id` query parameter' },
      { status: 400 }
    );
  }

  try {
    console.log('[DEBUG] Fetching prediction status for id:', id);
    const pred = await replicate.predictions.get(id);
    console.log('[DEBUG] Prediction status:', pred.status, 'error:', pred.error);

    if (pred.status !== 'succeeded') {
      return NextResponse.json(
        { status: pred.status, error: pred.error ?? null },
        { status: 200 }
      );
    }

    console.log('[DEBUG] Prediction succeeded, downloading video from:', pred.output);
    const resp = await fetch(pred.output as string);
    console.log('[DEBUG] Fetch response ok:', resp.ok, resp.status);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.statusText}`);
    const buffer = Buffer.from(await resp.arrayBuffer());

    console.log('[DEBUG] Uploading video to Supabase');
    const videoId = nanoid();
    const path = `videos/${session.user.id}/${videoId}.mp4`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .upload(path, buffer, { contentType: 'video/mp4' });
    if (uploadError) {
      console.error('[DEBUG] Supabase upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabaseAdmin.storage.from(VIDEO_BUCKET).getPublicUrl(path);
    console.log('[DEBUG] Public URL:', data.publicUrl);

    return NextResponse.json(
      { status: 'succeeded', videoUrl: data.publicUrl },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DEBUG] Error in GET handler:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
