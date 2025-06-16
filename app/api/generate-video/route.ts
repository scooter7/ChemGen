// app/api/generate-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export const runtime = 'nodejs';            // ensure it runs on Node
export const revalidate = 0;                // dynamic, no caching

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// Narrow the env var’s type to satisfy Replicate’s signature
const MODEL_VERSION = process.env
  .REPLICATE_VIDEO_MODEL! as `${string}/${string}` | `${string}/${string}:${string}`;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing `prompt` in request body' },
        { status: 400 }
      );
    }

    // 1️⃣ Create the prediction asynchronously
    const prediction = await replicate.predictions.create({
      version: MODEL_VERSION,
      input: { prompt },
      // optional: webhook: process.env.REPLICATE_WEBHOOK_URL
    });

    // 2️⃣ Return the ID immediately
    return NextResponse.json(
      { id: prediction.id },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('POST /api/generate-video error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error: 'Missing `id` query parameter' },
        { status: 400 }
      );
    }

    // Fetch the prediction status
    const prediction = await replicate.predictions.get(id);

    return NextResponse.json(
      {
        status: prediction.status,
        output: prediction.output,  // once status==='succeeded' this is your URL
        error: prediction.error,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('GET /api/generate-video error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
