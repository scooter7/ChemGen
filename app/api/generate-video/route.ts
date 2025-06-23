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

/**
 * A more robust function to find a video URL within a complex object.
 * This will look for a string that ends with a video file extension.
 */
function findVideoUrl(data: unknown): string | null {
    if (typeof data === 'string' && data.match(/\.(mp4|webm|mov|avi)$/)) {
        return data;
    }

    if (Array.isArray(data)) {
        for (const item of data) {
            const url = findVideoUrl(item);
            if (url) return url;
        }
    }

    if (typeof data === 'object' && data !== null) {
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const url = findVideoUrl((data as Record<string, unknown>)[key]);
                if (url) return url;
            }
        }
    }

    return null;
}


export async function POST(req: NextRequest) {
  if (!HF_SPACE_API_URL) {
    console.error("VIDEO_GENERATION_API_URL is not set.");
    return NextResponse.json(
      { error: 'Video generation service is not configured.' },
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

  try {
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
      console.error('Initial request to Hugging Face Space failed:', text);
      return NextResponse.json(
        { error: `The video generation service returned an error. Please try again later.` },
        { status: 502 } // Bad Gateway
      );
    }

    // 5️⃣ Extract event_id from SSE response text
    const initText = await initRes.text();
    const match = initText.match(/"event_id"\s*:\s*"([^"]+)"/);
    if (!match) {
      console.error('Could not parse event_id from SSE response:', initText);
      return NextResponse.json(
        { error: `Could not start video generation. Please try again.` },
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
      console.error('Result request to Hugging Face Space failed:', text);
      return NextResponse.json(
        { error: `Failed to retrieve the generated video. Please try again.` },
        { status: 502 } // Bad Gateway
      );
    }

    // 7️⃣ Parse last SSE data line as JSON
    const resultText = await resultRes.text();
    const dataLines = resultText.split('\n').filter(line => line.startsWith('data: '));
    if (dataLines.length === 0) {
      console.error('No data in SSE result:', resultText);
      return NextResponse.json(
        { error: `No video data was returned from the service.` },
        { status: 500 }
      );
    }
    const lastData = dataLines[dataLines.length - 1].replace(/^data: /, '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(lastData);
    } catch {
      console.error('Failed to JSON-parse SSE data:', lastData);
      return NextResponse.json(
        { error: `The video service returned an invalid response.` },
        { status: 500 }
      );
    }

    // ✨ NEW: Log the entire parsed response for debugging
    console.log('Full response from video service:', JSON.stringify(parsed, null, 2));

    // 8️⃣ Extract video URL/path using the more robust function
    const videoUrl = findVideoUrl(parsed);

    if (!videoUrl) {
      // The console.log above will now show us what 'parsed' contains
      return NextResponse.json(
        { error: `The generated video could not be found in the response.` },
        { status: 500 }
      );
    }

    // 9️⃣ Return the video URL
    return NextResponse.json({ videoUrl }, { status: 200 });

  } catch (error) {
    console.error('An unexpected error occurred in generate-video API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please check the server logs.' },
      { status: 500 }
    );
  }
}