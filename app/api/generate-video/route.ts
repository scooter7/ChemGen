// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Buffer } from 'buffer';

const HF_SPACE_API_URL = process.env.VIDEO_GENERATION_API_URL; 
// e.g. https://scooter7-wan2-1-fast.hf.space

// Convert the uploaded File into a base64 data URL
async function fileToDataURL(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return `data:${file.type};base64,${buffer.toString('base64')}`;
}

export async function POST(req: NextRequest) {
  if (!HF_SPACE_API_URL) {
    return NextResponse.json(
      { error: 'Video generation service is not configured.' },
      { status: 500 }
    );
  }

  try {
    // — 1) Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // — 2) Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string | null;
    if (!file || !prompt) {
      return NextResponse.json(
        { error: 'An image file and a prompt are required.' },
        { status: 400 }
      );
    }

    // — 3) To base64 data URL
    const imageDataUrl = await fileToDataURL(file);

    // — 4) Build the Gradio /api/predict payload (fn_index = 2 → /generate_video)
    const apiRequestBody = {
      fn_index: 2,
      data: [
        /* input_image */       imageDataUrl,
        /* prompt */            prompt,
        /* height */            512,
        /* width */             896,
        /* negative_prompt */   "Bright tones, overexposed, static, blurred details, subtitles, style, works, paintings, images, static, overall gray, worst quality, low quality, JPEG compression residue, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, misshapen limbs, fused fingers, still picture, messy background, three legs, many people in the background, walking backwards, watermark, text, signature",
        /* duration_seconds */  2,
        /* guidance_scale */    1,
        /* steps */             4,
        /* seed */              42,
        /* randomize_seed */    true
      ]
    };

    // — 5) POST to /api/predict
    const response = await fetch(
      `${HF_SPACE_API_URL}/api/predict`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiRequestBody),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Video API call failed: ${text}`);
    }

    // — 6) Parse the JSON and extract the video path
    const result = await response.json();
    // result.data: [ { video: "<filepath>", subtitles: "<filepath>|null" }, <seed> ]
    const entry = result.data?.[0];
    if (!entry?.video) {
      console.error('Unexpected API response:', result);
      throw new Error('No video returned from API.');
    }

    // — 7) Return the video URL/filepath
    return NextResponse.json(
      { videoUrl: entry.video },
      { status: 200 }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
