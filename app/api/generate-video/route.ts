// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }        from 'next-auth';
import { authOptions }            from '@/lib/authOptions';
import { Buffer }                 from 'buffer';

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
    // 1️⃣ Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2️⃣ Parse form data
    const formData = await req.formData();
    const file     = formData.get('file')   as File | null;
    const prompt   = formData.get('prompt') as string | null;
    if (!file || !prompt) {
      return NextResponse.json(
        { error: 'Both an image file and a prompt are required.' },
        { status: 400 }
      );
    }

    // 3️⃣ Build Gradio-style File dict
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);
    const dataUrl     = `data:${file.type};base64,${buffer.toString('base64')}`;
    const gradioFile: GradioFile = {
      path: dataUrl,
      meta: { _type: 'gradio.FileData' }
    };

    // 4️⃣ Initial POST to get the EVENT_ID
    const initRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            gradioFile, // [0] input_image
            prompt,     // [1] prompt
            512,        // [2] height
            896,        // [3] width
            "Bright tones, overexposed, static, blurred details, subtitles, style, works, paintings, images, static, overall gray, worst quality, low quality, JPEG compression residue, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, misshapen limbs, fused fingers, still picture, messy background, three legs, many people in the background, walking backwards, watermark, text, signature",
                        // [4] negative_prompt
            2,          // [5] duration_seconds
            1,          // [6] guidance_scale
            4,          // [7] steps
            42,         // [8] seed
            true        // [9] randomize_seed
          ]
        })
      }
    );
    if (!initRes.ok) {
      const txt = await initRes.text();
      throw new Error(`Init request failed: ${txt}`);
    }

    // 5️⃣ Extract event_id
    const initJson: unknown = await initRes.json();
    let eventId: string;
    if (
      typeof initJson === 'object' &&
      initJson !== null &&
      'event_id' in initJson &&
      typeof (initJson as Record<string, unknown>)['event_id'] === 'string'
    ) {
      eventId = (initJson as Record<string, string>)['event_id'];
    } else {
      throw new Error(`Could not parse event ID: ${JSON.stringify(initJson)}`);
    }

    // 6️⃣ GET the result
    const resultRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video/${eventId}`
    );
    if (!resultRes.ok) {
      const txt = await resultRes.text();
      throw new Error(`Result request failed: ${txt}`);
    }

    // 7️⃣ Parse the final output
    const resultJson: unknown = await resultRes.json();
    if (!Array.isArray(resultJson)) {
      throw new Error(`Unexpected result format: ${JSON.stringify(resultJson)}`);
    }
    const entry = resultJson[0];
    let videoUrl: string;
    if (typeof entry === 'string') {
      videoUrl = entry;
    } else if (
      typeof entry === 'object' &&
      entry !== null &&
      'video' in entry &&
      typeof (entry as Record<string, unknown>)['video'] === 'string'
    ) {
      videoUrl = (entry as Record<string, string>)['video'];
    } else {
      throw new Error(`Unexpected result entry: ${JSON.stringify(entry)}`);
    }

    // 8️⃣ Return to client
    return NextResponse.json({ videoUrl }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
