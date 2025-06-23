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
    // 1) Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Parse inputs
    const formData = await req.formData();
    const file     = formData.get('file')   as File | null;
    const prompt   = formData.get('prompt') as string | null;
    if (!file || !prompt) {
      return NextResponse.json(
        { error: 'Both an image file and a prompt are required.' },
        { status: 400 }
      );
    }

    // 3) Build Gradio‐style File dict
    const buf       = Buffer.from(await file.arrayBuffer());
    const dataUrl   = `data:${file.type};base64,${buf.toString('base64')}`;
    const gradioFile: GradioFile = {
      path: dataUrl,
      meta: { _type: 'gradio.FileData' }
    };

    // 4) INITIAL POST → SSE stream with event_id JSON embedded
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

    // 5) Read the SSE text and extract the event_id
    const initText = await initRes.text();
    const idMatch = initText.match(/"event_id"\s*:\s*"([^"]+)"/);
    if (!idMatch) {
      throw new Error(`Could not parse event_id from:\n${initText}`);
    }
    const eventId = idMatch[1];

    // 6) GET the SSE result stream
    const resultRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video/${eventId}`
    );
    if (!resultRes.ok) {
      const txt = await resultRes.text();
      throw new Error(`Result request failed: ${txt}`);
    }

    // 7) Read the SSE text and extract the final data block
    const resultText = await resultRes.text();
    // Grab all lines starting with `data: ` and pick the last one
    const dataLines = resultText
      .split('\n')
      .filter((l) => l.startsWith('data: '));
    if (dataLines.length === 0) {
      throw new Error(`No data in SSE result:\n${resultText}`);
    }
    const lastData = dataLines[dataLines.length - 1].replace(/^data:\s*/, '');
    let parsed;
    try {
      parsed = JSON.parse(lastData);
    } catch (e) {
      throw new Error(`Failed to JSON-parse SSE data:\n${lastData}`);
    }

    // 8) Extract the video URL/path from the parsed result
    // Gradio returns either [ "<video_path>", <seed> ] or [ { video: "<video_path>", ... }, <seed> ]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`Unexpected parsed result: ${JSON.stringify(parsed)}`);
    }
    const entry = parsed[0];
    let videoUrl: string;
    if (typeof entry === 'string') {
      videoUrl = entry;
    } else if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as any).video === 'string'
    ) {
      videoUrl = (entry as any).video;
    } else {
      throw new Error(`Could not find video URL in: ${JSON.stringify(entry)}`);
    }

    // 9) Return to client
    return NextResponse.json({ videoUrl }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
