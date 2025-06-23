// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Buffer } from 'buffer';

const HF_SPACE_API_URL = process.env.VIDEO_GENERATION_API_URL;
// e.g. "https://scooter7-wan2-1-fast.hf.space"

interface ImageInputDict {
  url: string;
  mime_type: string;
  orig_name: string;
  size: number;
  is_stream: boolean;
  meta: Record<string, unknown>;
}

// Turn an uploaded File into what gradio_client.handle_file() would produce:
async function fileToInputDict(file: File): Promise<ImageInputDict> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return {
    url: `data:${file.type};base64,${buffer.toString('base64')}`,
    mime_type: file.type,
    orig_name: file.name,
    size: buffer.length,
    is_stream: false,
    meta: {},
  };
}

export async function POST(req: NextRequest) {
  if (!HF_SPACE_API_URL) {
    return NextResponse.json(
      { error: 'Video generation service is not configured.' },
      { status: 500 }
    );
  }

  try {
    // 1) Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Parse multipart form
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string | null;
    if (!file || !prompt) {
      return NextResponse.json(
        { error: 'An image file and a prompt are required.' },
        { status: 400 }
      );
    }

    // 3) Build the input_image dict
    const inputImage = await fileToInputDict(file);

    // 4) Construct the Gradio payload
    const payload = {
      data: [
        inputImage,
        prompt,
        512,
        896,
        "Bright tones, overexposed, static, blurred details, subtitles, style, works, paintings, images, static, overall gray, worst quality, low quality, JPEG compression residue, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, misshapen limbs, fused fingers, still picture, messy background, three legs, many people in the background, walking backwards, watermark, text, signature",
        2,
        1,
        4,
        42,
        true
      ]
    };

    // 5) Call the named /generate_video endpoint
    const res = await fetch(
      `${HF_SPACE_API_URL}/call/generate_video`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Video API call failed: ${errText}`);
    }

    // 6) Parse the result
    const json = await res.json();
    // json.data: [ { video: "<filepath>", subtitles: "<filepath>|null" }, <seed> ]
    const entry = Array.isArray(json.data) ? json.data[0] : null;
    if (!entry?.video) {
      console.error('Unexpected API response:', json);
      throw new Error('No video returned from API.');
    }

    // 7) Return the video path/URL
    return NextResponse.json({ videoUrl: entry.video }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
