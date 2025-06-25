// app/api/generate-podcast-script/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("CRITICAL: GEMINI_API_KEY is not set.");
}
const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

interface ScriptRequest {
  text: string;
  hostMode: 'single' | 'co-host';
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ message: 'AI service is not configured.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as ScriptRequest;
    const { text, hostMode } = body;

    if (!text || text.trim() === '') {
      return NextResponse.json({ message: 'Text is required to generate a script.' }, { status: 400 });
    }

    let systemPrompt = '';
    if (hostMode === 'co-host') {
      systemPrompt = `You are a scriptwriter. Convert the following text into a natural, conversational podcast dialogue between two hosts, "Host A" and "Host B". Each line of dialogue must be prefixed with either "[HOST A]:" or "[HOST B]:". Ensure the script flows logically and maintains the core information from the original text. Start with an introduction from Host A and end with a conclusion from Host B.`;
    } else {
      systemPrompt = `You are a scriptwriter. Convert the following text into a monologue for a single podcast host. The script should be well-structured and engaging for a listener. Start with an introduction and end with a conclusion.`;
    }

    const prompt = `${systemPrompt}\n\n---START OF TEXT---\n${text}\n---END OF TEXT---`;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        safetySettings,
    });

    const response = result.response;
    const generatedScript = response.text();

    return NextResponse.json({ script: generatedScript }, { status: 200 });

  } catch (error) {
    console.error('Error generating podcast script:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Failed to generate script.', error: errorMessage }, { status: 500 });
  }
}