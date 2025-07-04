// app/api/generate-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions'; // Adjust path if needed
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Define the expected shape of the incoming data from the form
interface ContentGenerationRequest {
  audience?: string;
  mediaType?: string;
  textCount?: number;
  textCountUnit?: 'characters' | 'words';
  dominantArchetype?: string;
  prompt?: string;
  sourceMaterials?: string[];
}

// Initialize the Google Generative AI client
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY is not set in .env file");
}
const genAI = new GoogleGenerativeAI(API_KEY || ""); 

// Define safety settings for the model
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
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
      You are an AI assistant for Samford University, tasked with creating marketing content.
      Your persona should align with "The Inspirational and Confident Shepherd" brand archetype.
      If a dominant brand archetype is specified, lean into it: "${body.dominantArchetype || 'Inspirational and Confident Shepherd'}".
      
      Target Audience: ${body.audience || 'a general university audience'}.
      Media Type: ${body.mediaType || 'general content'}.
      Approximate Length: ${body.textCount || 150} ${body.textCountUnit || 'words'}.
      ${body.sourceMaterials && body.sourceMaterials.length > 0 ? `Reference these materials if relevant: ${body.sourceMaterials.join(', ')}.` : ''}

      User's Core Request: "${body.prompt}"

      Please structure your response based on the Media Type. 
      If the Media Type is "Email Newsletter" or similar, generate the content with the following parts, each separated by a double line break:
      1. A subject line.
      2. A pre-header text (if applicable).
      3. The main body of the content.
      4. A signature line.
      For other media types, just generate the main body content.

      IMPORTANT: Generate only the raw text. Do NOT include any HTML tags, markdown (like \`###\` or \`**\`), or section labels (like "Subject:" or "Body:").

      After all the generated content, provide a brief "Justification:" on a new line, explaining your key creative choices.
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