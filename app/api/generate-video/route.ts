// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Buffer } from 'buffer';

const HF_SPACE_API_URL = process.env.VIDEO_GENERATION_API_URL!;
// e.g. "https://scooter7-wan2-1-fast.hf.space"

interface GradioFile {
  path: string;
  meta: { _type: 'gradio.FileData' };
}

export async function POST(req: NextRequest) {
  if (!HF_SPACE_API_URL) {
    return NextResponse.json(
      { error: 'VIDEO_GENERATION_API_URL is not set.' },
      { status: 500 }
    );
  }

  try {
    // 1) Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Parse form-data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string | null;
    if (!file || !prompt) {
      return NextResponse.json(
        { error: 'Both an image file and a prompt are required.' },
        { status: 400 }
      );
    }

    // 3) Build the Gradio-style File dict
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
    const gradioFile: GradioFile = { path: dataUrl, meta: { _type: 'gradio.FileData' } };

    // 4) Initial POST to get EVENT_ID
    const initRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            gradioFile,
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
        })
      }
    );
    if (!initRes.ok) {
      const txt = await initRes.text();
      throw new Error(`Init request failed: ${txt}`);
    }

    // 5) Parse the EVENT_ID from response JSON
    const initJson = await initRes.json();
    const dataField = (initJson as { data: unknown }).data;
    let eventId: string;
    if (typeof dataField === 'string') {
      eventId = dataField;
    } else if (Array.isArray(dataField) && typeof dataField[0] === 'string') {
      eventId = dataField[0];
    } else {
      throw new Error(`Could not parse event ID: ${JSON.stringify(initJson)}`);
    }

    // 6) GET the result using EVENT_ID
    const resultRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video/${eventId}`
    );
    if (!resultRes.ok) {
      const txt = await resultRes.text();
      throw new Error(`Result request failed: ${txt}`);
    }

    // 7) Parse the final output
    const resultRaw = await resultRes.json();
    if (!Array.isArray(resultRaw)) {
      throw new Error(`Unexpected result format: ${JSON.stringify(resultRaw)}`);
    }
    const entry = resultRaw[0];
    let videoUrl: string;
    if (typeof entry === 'string') {
      videoUrl = entry;
    } else if (
      entry &&
      typeof entry === 'object' &&
      'video' in entry &&
      typeof (entry as { video: unknown }).video === 'string'
    ) {
      videoUrl = (entry as { video: string }).video;
    } else {
      throw new Error(`Unexpected result entry: ${JSON.stringify(entry)}`);
    }

    // 8) Return the video URL to client
    return NextResponse.json({ videoUrl }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
