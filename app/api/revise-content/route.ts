// app/api/revise-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("CRITICAL: GEMINI_API_KEY is not set for revise-content route.");
}
const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  // ... other settings
];

interface ReviseContentRequest {
  originalContent: string;
  revisionInstructions: string;
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ message: 'API Key for AI service is not configured.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as ReviseContentRequest;
    const { originalContent, revisionInstructions } = body;

    if (!originalContent || !revisionInstructions) {
      return NextResponse.json({ message: 'Original content and revision instructions are required.' }, { status: 400 });
    }

    const prompt = `
      You are an expert editor. Revise the following "ORIGINAL CONTENT" based on the provided "REVISION INSTRUCTIONS".
      Maintain the original tone and purpose unless the instructions specify otherwise.
      If the original content has distinct sections (like a subject, body, and signature, separated by line breaks), you MUST preserve that structure in your revised output. Ensure the revised sections are also separated by double line breaks.
      IMPORTANT: Output only the final, revised raw text. Do NOT include any HTML tags or markdown formatting.

      REVISION INSTRUCTIONS:
      ---
      ${revisionInstructions}
      ---

      ORIGINAL CONTENT:
      ---
      ${originalContent}
      ---

      REVISED CONTENT:
    `;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{text: prompt}]}],
        safetySettings,
    });
    
    const response = result.response;
    const revisedText = response.text();

    return NextResponse.json({ revisedContent: revisedText }, { status: 200 });

  } catch (error) {
    console.error('Error revising content:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ message: 'Failed to revise content.', error: errorMessage }, { status: 500 });
  }
}