// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }              from 'next-auth';
import { authOptions }                  from '@/lib/authOptions';
import { Buffer }                       from 'buffer';

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
    // 1️⃣ Auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2️⃣ Parse form-data
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const prompt = form.get('prompt') as string | null;
    if (!file || !prompt) {
      return NextResponse.json(
        { error: 'Both file and prompt are required.' },
        { status: 400 }
      );
    }

    // 3️⃣ Build Gradio-style file dict
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
    const gradioFile: GradioFile = {
      path: dataUrl,
      meta: { _type: 'gradio.FileData' }
    };

    // 4️⃣ First POST to obtain EVENT_ID
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
      const errText = await initRes.text();
      throw new Error(`Init request failed: ${errText}`);
    }

    // 5️⃣ Extract EVENT_ID from the raw response
    const initText = await initRes.text();
    const eventId = initText.split('"')[3];
    if (!eventId) {
      throw new Error('Could not parse event ID from response');
    }

    // 6️⃣ Poll the GET endpoint for the result
    const resultRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video/${eventId}`
    );
    if (!resultRes.ok) {
      const errText = await resultRes.text();
      throw new Error(`Result request failed: ${errText}`);
    }
    const resultJson = await resultRes.json();

    // 7️⃣ Extract video path
    // resultJson is [ <video_path>, <seed> ]
    const output = Array.isArray(resultJson) ? resultJson[0] : null;
    if (typeof output !== 'string') {
      console.error('Unexpected result:', resultJson);
      throw new Error('Video not returned');
    }

    // 8️⃣ Return to client
    return NextResponse.json({ videoUrl: output }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
