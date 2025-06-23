// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import Replicate from 'replicate';
import { Buffer } from 'buffer';

// Initialize the Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(req: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN || !process.env.REPLICATE_VIDEO_MODEL) {
    console.error("Replicate environment variables are not set.");
    return NextResponse.json(
      { error: 'Video generation service is not configured.' },
      { status: 500 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const prompt = formData.get('prompt') as string | null;
  const imageStrength = parseFloat(formData.get('imageStrength') as string || '0.85');
  
  if (!file || !prompt) {
    return NextResponse.json(
      { error: 'Both an image file and a prompt are required.' },
      { status: 400 }
    );
  }

  try {
    // Convert the image file to a base64 data URI
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${imageBuffer.toString('base64')}`;

    // Call the Replicate API
    const output = await replicate.run(
      process.env.REPLICATE_VIDEO_MODEL as `${string}/${string}:${string}`,
      {
        input: {
          image_path: dataUri,
          prompt: prompt,
          image_strength: imageStrength, // Pass the image strength to the API
        }
      }
    );
    
    const videoUrl = Array.isArray(output) ? output[0] : output;

    if (!videoUrl || typeof videoUrl !== 'string') {
      console.error("No video URL found in the Replicate API response:", output);
      return NextResponse.json(
        { error: 'The video generation service did not return a video.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ videoUrl }, { status: 200 });

  } catch (error) {
    console.error('An unexpected error occurred in generate-video API:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { error: `An unexpected error occurred: ${errorMessage}` },
      { status: 500 }
    );
  }
}