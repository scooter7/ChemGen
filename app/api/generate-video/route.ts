// file: app/api/generate-video/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Buffer } from 'buffer';

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export async function POST(req: NextRequest) {
  if (!process.env.GOOGLE_API_KEY) {
    console.error("GOOGLE_API_KEY is not set.");
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
    // 3️⃣ Convert the image file to a base64 string
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Image = buffer.toString('base64');

    // 4️⃣ Call the Gemini API with the correct model name
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });
    
    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: base64Image,
                mimeType: file.type,
            }
        }
    ]);

    const videoUrl = result.response.text();

    if (!videoUrl) {
      console.error("No video URL found in the Gemini API response:", result.response);
      return NextResponse.json(
        { error: 'The generated video could not be found in the response.' },
        { status: 500 }
      );
    }
    
    // 5️⃣ Return the video URL
    return NextResponse.json({ videoUrl }, { status: 200 });

  } catch (error) {
    console.error('An unexpected error occurred in generate-video API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please check the server logs.' },
      { status: 500 }
    );
  }
}