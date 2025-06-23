// app/api/generate-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const HF_SPACE_API_URL = process.env.VIDEO_GENERATION_API_URL;

// Helper function to convert a File to a base64 data URL
async function fileToDataURL(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // The Gradio API expects this specific format for file uploads
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

    // This JSON body is structured exactly as the /generate_video API expects.
    // The `data` array contains all 10 parameters in the correct order.
    const apiRequestBody = {
      data: [
        imageDataUrl, // input_image (as a data URL)
        prompt,       // prompt
        512,          // height
        896,          // width
        "Bright tones, overexposed, static, blurred details, subtitles, style, works, paintings, images, static, overall gray, worst quality, low quality, JPEG compression residue, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, misshapen limbs, fused fingers, still picture, messy background, three legs, many people in the background, walking backwards, watermark, text, signature", // negative_prompt
        2,            // duration_seconds
        1,            // guidance_scale
        4,            // steps
        42,           // seed
        true,         // randomize_seed
      ]
    };

    // The endpoint for Gradio APIs is typically /run/predict
    const response = await fetch(`${HF_SPACE_API_URL}/run/generate_video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`The video generation API failed: ${errorBody}`);
    }

    const result = await response.json();
    
    // According to the docs, the video is in the first element of the returned data array.
    // The gradio_client returns a file object, which in a raw API call
    // is a dictionary containing the base64 data URL in its `name` property.
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