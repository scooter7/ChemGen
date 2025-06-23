// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }         from 'next-auth';
import { authOptions }             from '@/lib/authOptions';
import { Buffer }                  from 'buffer';

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
    // 1) Ensure user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Parse multipart form data
    const formData = await req.formData();
    const file     = formData.get('file')   as File | null;
    const prompt   = formData.get('prompt') as string | null;

    if (!file || !prompt) {
      return NextResponse.json(
        { error: 'Both an image file and a prompt are required.' },
        { status: 400 }
      );
    }

    // 3) Build the Gradio‐style File dict
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);
    const dataUrl     = `data:${file.type};base64,${buffer.toString('base64')}`;
    const gradioFile: GradioFile = {
      path: dataUrl,
      meta: { _type: 'gradio.FileData' }
    };

    // 4) INITIAL POST to /gradio_api/call/generate_video to get an EVENT_ID
    const initRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            gradioFile,                                       // [0] input image
            prompt,                                           // [1] prompt
            512,                                              // [2] height
            896,                                              // [3] width
            "Bright tones, overexposed, static, blurred details, ...", // [4] negative_prompt
            2,                                                // [5] duration_seconds
            1,                                                // [6] guidance_scale
            4,                                                // [7] steps
            42,                                               // [8] seed
            true                                              // [9] randomize_seed
          ]
        })
      }
    );
    if (!initRes.ok) {
      const txt = await initRes.text();
      throw new Error(`Init request failed: ${txt}`);
    }

    // 5) Parse the EVENT_ID out of the JSON response
    const initJson = await initRes.json() as { data: string[] | string };
    let eventId: string;
    if (Array.isArray(initJson.data)) {
      eventId = initJson.data[0];
    } else if (typeof initJson.data === 'string') {
      eventId = initJson.data;
    } else {
      throw new Error(`Could not parse event ID: ${JSON.stringify(initJson)}`);
    }

    // 6) GET the result using the EVENT_ID
    const resultRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video/${eventId}`
    );
    if (!resultRes.ok) {
      const txt = await resultRes.text();
      throw new Error(`Result request failed: ${txt}`);
    }

    // 7) Parse the final output
    const resultJson = await resultRes.json() as any[];
    const entry = resultJson[0]; 
    // entry may be a string (filepath) or an object { video: filepath, subtitles: ... }
    let videoUrl: string;
    if (typeof entry === 'string') {
      videoUrl = entry;
    } else if (entry && typeof entry === 'object' && 'video' in entry) {
      videoUrl = (entry as { video: string }).video;
    } else {
      throw new Error(`Unexpected final result: ${JSON.stringify(resultJson)}`);
    }

    // 8) Return the video URL to the client
    return NextResponse.json({ videoUrl }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
