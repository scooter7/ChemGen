// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { Buffer } from 'buffer';

const HF_SPACE_API_URL = process.env.VIDEO_GENERATION_API_URL!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VIDEO_BUCKET_NAME = 'generated-videos';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// The GradioFile interface has been removed as it is no longer used.

export async function POST(req: NextRequest) {
  if (!HF_SPACE_API_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("One or more environment variables are not set.");
    return NextResponse.json(
      { error: 'Server is not configured correctly.' },
      { status: 500 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

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
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uniqueFileName = `${userId}-${nanoid()}.png`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from(VIDEO_BUCKET_NAME)
        .upload(uniqueFileName, fileBuffer, {
            contentType: file.type,
            upsert: true
        });

    if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw new Error("Could not upload image for video generation.");
    }
    
    const { data: publicUrlData } = supabaseAdmin.storage
        .from(VIDEO_BUCKET_NAME)
        .getPublicUrl(uploadData.path);
        
    const publicImageUrl = publicUrlData.publicUrl;

    if (!publicImageUrl) {
        throw new Error("Could not get public URL for the uploaded image.");
    }

    const gradioPayload = {
      url: publicImageUrl,
      meta: { _type: 'gradio.FileData' }
    };

    const initRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            gradioPayload,
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
      console.error('Initial request to Hugging Face Space failed:', text);
      return NextResponse.json(
        { error: `The video generation service returned an error. Please try again later.` },
        { status: 502 }
      );
    }
    
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

    const resultRes = await fetch(
      `${HF_SPACE_API_URL}/gradio_api/call/generate_video/${eventId}`
    );
    if (!resultRes.ok) {
      const text = await resultRes.text();
      console.error('Result request to Hugging Face Space failed:', text);
      return NextResponse.json(
        { error: `Failed to retrieve the generated video. Please try again.` },
        { status: 502 }
      );
    }

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

    console.log('Full response from video service:', JSON.stringify(parsed, null, 2));

    const videoUrl = findVideoUrl(parsed);

    if (!videoUrl) {
      return NextResponse.json(
        { error: `The generated video could not be found in the response.` },
        { status: 500 }
      );
    }

    return NextResponse.json({ videoUrl }, { status: 200 });

  } catch (error) {
    console.error('An unexpected error occurred in generate-video API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please check the server logs.' },
      { status: 500 }
    );
  }
}

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