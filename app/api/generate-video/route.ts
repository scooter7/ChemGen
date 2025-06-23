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
const VIDEO_BUCKET_NAME = 'generated-videos'; // Using your existing bucket

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);


export async function POST(req: NextRequest) {
  if (!HF_SPACE_API_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("One or more environment variables are not set.");
    return NextResponse.json(
      { error: 'Server is not configured correctly.' },
      { status: 500 }
    );
  }

  // 1️⃣ Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

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
    // 3️⃣ NEW: Upload image to Supabase to get a public URL
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

    // 4️⃣ Initial POST to start job with the public image URL
    const initRes = await fetch(
      `${HF_SPACE_API_URL}/run/predict`, // Using the /run/predict endpoint which is standard for public Gradio spaces
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            publicImageUrl, // Sending the public URL instead of a data URL
            prompt,
            25, // motion_bucket_id
            15, // fps
            "animate", // augmentation_level ('animate', 'video', or 'disabled')
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
    
    const responseJson = await initRes.json();
    
    // 5️⃣ Extract video URL directly from the response
    const videoData = responseJson?.data?.[0];
    if (!videoData || !videoData.name) {
      console.error("Could not find video data in the response:", responseJson);
      return NextResponse.json(
        { error: 'The video service returned an unexpected response.' },
        { status: 500 }
      );
    }

    // The response from this type of space is often a temporary file path
    const videoUrl = `${HF_SPACE_API_URL}/file=${videoData.name}`;

    // 6️⃣ Return the final video URL
    return NextResponse.json({ videoUrl }, { status: 200 });

  } catch (error) {
    console.error('An unexpected error occurred in generate-video API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please check the server logs.' },
      { status: 500 }
    );
  }
}