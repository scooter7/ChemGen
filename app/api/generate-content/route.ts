// app/api/generate-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

interface ContentGenerationRequest {
  audience?: string;
  mediaType?: string;
  textCount?: number;
  textCountUnit?: 'characters' | 'words';
  dominantArchetype?: string;
  prompt?: string;
  sourceMaterials?: string[];
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY is not set in .env file");
}
const genAI = new GoogleGenerativeAI(API_KEY || ""); 

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  // ... other settings
];

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ message: 'API Key for AI service is not configured.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const body = await req.json() as ContentGenerationRequest;
    
    if (!body.prompt || body.prompt.trim() === '') {
      return NextResponse.json({ message: 'Prompt is required.' }, { status: 400 });
    }

    const detailedPrompt = `
      You are an AI assistant for Samford University creating marketing content. Your persona is "The Inspirational and Confident Shepherd."
      Target Audience: ${body.audience || 'a general university audience'}.
      Media Type: ${body.mediaType || 'general content'}.
      Approximate Length: ${body.textCount || 150} ${body.textCountUnit || 'words'}.
      User's Core Request: "${body.prompt}"

      Please structure your response based on the Media Type.

      If the Media Type is "Email Newsletter", YOU MUST generate the content with a subject line, a pre-header, the main body, and a signature. Each part MUST be separated by a double line break.

      Follow this exact format, without including the labels like "Subject:":
      [The Subject Line Here]

      [The Pre-Header Text Here]

      [The main body of the email content here...]

      [The Signature Here]

      For all other media types, generate only the main body content.

      IMPORTANT: Under no circumstances should you include HTML tags, markdown formatting (like ### or **), or section labels (like "Subject:" or "Body:"). The output must be clean, raw text with the specified line breaks.

      After all the generated content, provide a brief "Justification:" on a new line.
    `;
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
    
    const result = await model.generateContent(detailedPrompt);
    const response = result.response;
    const text = response.text();

    let generatedText = text;
    let justification = "Justification not explicitly provided by AI in this format.";

    const justificationSplit = text.split(/\nJustification:/i);
    if (justificationSplit.length > 1) {
      generatedText = justificationSplit[0].trim();
      justification = justificationSplit.slice(1).join('\nJustification:').trim();
    }
    
    return NextResponse.json(
      { 
        message: 'Content generated successfully!',
        data: {
          generatedText: generatedText,
          justification: justification,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in /api/generate-content:', error);
    let errorMessage = 'An unexpected error occurred while generating content.';
    if (error instanceof Error) {
        if (error.message.includes('SAFETY')) {
            errorMessage = "The content could not be generated due to safety settings. Please revise your prompt.";
            return NextResponse.json({ message: errorMessage, errorDetails: error }, { status: 400 });
        }
        errorMessage = error.message;
    }
    
    return NextResponse.json(
      { message: 'Error processing content generation request.', error: errorMessage, errorDetails: error },
      { status: 500 }
    );
  }
}