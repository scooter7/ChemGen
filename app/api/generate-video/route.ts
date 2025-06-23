// app/api/generate-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const HF_SPACE_API_URL = process.env.VIDEO_GENERATION_API_URL;

// Helper function to convert a File to a base64 data URL
async function fileToDataURL(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return `data:${file.type};base64,${buffer.toString('base64')}`;
}

export async function POST(req: NextRequest) {
  if (!HF_SPACE_API_URL) {
    return NextResponse.json({ error: 'Video generation service is not configured.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const prompt = formData.get('prompt') as string | null;

    if (!file || !prompt) {
      return NextResponse.json({ error: 'An image file and a prompt are required.' }, { status: 400 });
    }

    const imageDataUrl = await fileToDataURL(file);

    // This JSON body targets the 3rd API function (index 2)
    const apiRequestBody = {
      fn_index: 2, // Corresponds to the `/generate_video` function
      data: [
        imageDataUrl,
        prompt,
        512,
        896,
        "Bright tones, overexposed, static, blurred details, subtitles, style, works, paintings, images, static, overall gray, worst quality, low quality, JPEG compression residue, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, misshapen limbs, fused fingers, still picture, messy background, three legs, many people in the background, walking backwards, watermark, text, signature",
        2,
        1,
        4,
        42,
        true,
      ]
    };

    // The most common generic endpoint for Gradio APIs is /api/predict/
    const response = await fetch(`${HF_SPACE_API_URL}/api/predict/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`The video generation API failed: ${errorBody}`);
    }

    const result = await response.json();
    const videoDataUrl = result?.data?.[0]?.name;

    if (!videoDataUrl) {
      console.error("Unexpected API response structure:", result);
      throw new Error('The API did not return a valid video format.');
    }

    return NextResponse.json({ videoUrl: videoDataUrl }, { status: 200 });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}