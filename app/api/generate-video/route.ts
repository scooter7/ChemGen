// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Buffer } from 'buffer';

const HF_SPACE_API_URL = process.env.VIDEO_GENERATION_API_URL!;
// = "https://scooter7-wan2-1-fast.hf.space"

interface ImageInputDict {
  url:       string;
  mime_type: string;
  orig_name: string;
  size:      number;
  is_stream: boolean;
  meta:      Record<string, unknown>;
}

// Build the same dict that gradio_client.handle_file() would produce
async function fileToInputDict(file: File): Promise<ImageInputDict> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer      = Buffer.from(arrayBuffer);
  return {
    url:        `data:${file.type};base64,${buffer.toString('base64')}`,
    mime_type:  file.type,
    orig_name:  file.name,
    size:       buffer.length,
    is_stream:  false,
    meta:       {},
  };
}

export async function POST(req: NextRequest) {
  // 1️⃣ Configuration check
  if (!HF_SPACE_API_URL) {
    return NextResponse.json(
      { error: 'VIDEO_GENERATION_API_URL is not set.' },
      { status: 500 }
    );
  }

  try {
    // 2️⃣ Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3️⃣ Parse incoming form-data
    const formData = await req.formData();
    const file     = formData.get('file')   as File | null;
    const prompt   = formData.get('prompt') as string | null;

    if (!file || !prompt) {
      return NextResponse.json(
        { error: 'Both an image file and a prompt are required.' },
        { status: 400 }
      );
    }

    // 4️⃣ Convert file → Gradio-style input dict
    const inputImage = await fileToInputDict(file);

    // 5️⃣ Prepare Gradio payload for /call/generate_video
    const payload = {
      data: [
        inputImage,                           // input_image
        prompt,                               // prompt
        512,                                  // height
        896,                                  // width
        "Bright tones, overexposed, ...",     // negative_prompt
        2,                                    // duration_seconds
        1,                                    // guidance_scale
        4,                                    // steps
        42,                                   // seed
        true                                  // randomize_seed
      ]
    };

    // 6️⃣ Call the public Space’s named endpoint
    const res = await fetch(
      `${HF_SPACE_API_URL}/call/generate_video`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Video API call failed: ${text}`);
    }

    // 7️⃣ Extract the generated video path
    const json = await res.json();
    const entry = Array.isArray(json.data) ? json.data[0] : null;
    if (!entry?.video) {
      console.error('Unexpected API response:', json);
      throw new Error('No video returned from API.');
    }

    // 8️⃣ Return to client
    return NextResponse.json(
      { videoUrl: entry.video },
      { status: 200 }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
