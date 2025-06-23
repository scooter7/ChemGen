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

  // 1️⃣ Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2️⃣ Parse form data
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const prompt = formData.get('prompt') as string | null;
  if (!file || !prompt) {
    return NextResponse.json(
      { error: 'Both an image file and a prompt are required.' },
      { status: 400 }
    );
  }

  // 3️⃣ Build Gradio-style File dict
  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
  const gradioFile: GradioFile = {
    path: dataUrl,
    meta: { _type: 'gradio.FileData' }
  };

  // 4️⃣ Initial POST to start job (SSE stream) and get event_id
  const initRes = await fetch(
    `${HF_SPACE_API_URL}/gradio_api/call/generate_video`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          gradioFile,                                    // [0] input_image
          prompt,                                        // [1] prompt
          512,                                           // [2] height
          896,                                           // [3] width
          "Bright tones, overexposed, static, blurred details, subtitles, style, works, paintings, images, static, overall gray, worst quality, low quality, JPEG compression residue, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, misshapen limbs, fused fingers, still picture, messy background, three legs, many people in the background, walking backwards, watermark, text, signature",
                                                         // [4] negative_prompt
          2,                                             // [5] duration_seconds
          1,                                             // [6] guidance_scale
          4,                                             // [7] steps
          42,                                            // [8] seed
          true                                           // [9] randomize_seed
        ]
      })
    }
  );
  if (!initRes.ok) {
    const text = await initRes.text();
    return NextResponse.json(
      { error: `Init request failed: ${text}` },
      { status: 500 }
    );
  }

  // 5️⃣ Extract event_id from SSE response text
  const initText = await initRes.text();
  const match = initText.match(/"event_id"\s*:\s*"([^"]+)"/);
  if (!match) {
    return NextResponse.json(
      { error: `Could not parse event_id from SSE response: ${initText}` },
      { status: 500 }
    );
  }
  const eventId = match[1];

  // 6️⃣ Poll GET endpoint for final result SSE stream
  const resultRes = await fetch(
    `${HF_SPACE_API_URL}/gradio_api/call/generate_video/${eventId}`
  );
  if (!resultRes.ok) {
    const text = await resultRes.text();
    return NextResponse.json(
      { error: `Result request failed: ${text}` },
      { status: 500 }
    );
  }

  // 7️⃣ Parse last SSE data line as JSON
  const resultText = await resultRes.text();
  const dataLines = resultText.split('\n').filter(line => line.startsWith('data: '));
  if (dataLines.length === 0) {
    return NextResponse.json(
      { error: `No data in SSE result: ${resultText}` },
      { status: 500 }
    );
  }
  const lastData = dataLines[dataLines.length - 1].replace(/^data: /, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(lastData);
  } catch {
    return NextResponse.json(
      { error: `Failed to JSON-parse SSE data: ${lastData}` },
      { status: 500 }
    );
  }

  // 8️⃣ Extract video URL/path
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return NextResponse.json(
      { error: `Unexpected parsed result: ${JSON.stringify(parsed)}` },
      { status: 500 }
    );
  }
  const entry = parsed[0];
  let videoUrl: string;
  if (typeof entry === 'string') {
    videoUrl = entry;
  } else if (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as Record<string, unknown>).video === 'string'
  ) {
    videoUrl = (entry as Record<string, string>).video;
  } else {
    return NextResponse.json(
      { error: `Could not find video URL in: ${JSON.stringify(entry)}` },
      { status: 500 }
    );
  }

  // 9️⃣ Return the video URL
  return NextResponse.json({ videoUrl }, { status: 200 });
}
