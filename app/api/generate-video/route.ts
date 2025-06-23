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
  // 1️⃣ Config check
  if (!HF_SPACE_API_URL) {
    return NextResponse.json(
      { error: 'VIDEO_GENERATION_API_URL is not set.' },
      { status: 500 }
    );
  }

  try {
    // 2️⃣ Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3️⃣ Parse inputs
    const formData = await req.formData();
    const file     = formData.get('file')   as File | null;
    const prompt   = formData.get('prompt') as string | null;
    if (!file || !prompt) {
      return NextResponse.json(
        { error: 'Both an image file and a prompt are required.' },
        { status: 400 }
      );
    }

    // 4️⃣ Build Gradio‐style file object
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);
    const dataUrl     = `data:${file.type};base64,${buffer.toString('base64')}`;
    const gradioFile: GradioFile = {
      path: dataUrl,
      meta: { _type: 'gradio.FileData' }
    };

    // 5️⃣ Initial POST to start the job (SSE stream)
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
      const text = await initRes.text();
      throw new Error(`Init request failed: ${text}`);
    }

    // 6️⃣ Read the SSE text and extract the event_id
    const sseText = await initRes.text();
    const match = sseText.match(/"event_id"\s*:\s*"([^"]+)"/);
    if (!match) {
      throw new Error(`Could not parse event ID from SSE response: ${sseText}`);
    }
    const eventId = match[1];

    // 7️⃣ Poll the GET endpoint for the final result
    const resultRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video/${eventId}`
    );
    if (!resultRes.ok) {
      const text = await resultRes.text();
      throw new Error(`Result request failed: ${text}`);
    }

    // 8️⃣ Parse the JSON array result
    const resultJson = await resultRes.json();
    if (!Array.isArray(resultJson) || resultJson.length === 0) {
      throw new Error(`Unexpected result format: ${JSON.stringify(resultJson)}`);
    }
    const entry = resultJson[0];
    let videoUrl: string;
    if (typeof entry === 'string') {
      videoUrl = entry;
    } else if (
      entry &&
      typeof entry === 'object' &&
      'video' in entry &&
      typeof (entry as Record<string, unknown>).video === 'string'
    ) {
      videoUrl = (entry as Record<string, string>).video;
    } else {
      throw new Error(`Unexpected result entry: ${JSON.stringify(entry)}`);
    }

    // 9️⃣ Return back to the client
    return NextResponse.json({ videoUrl }, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
