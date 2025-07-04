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
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
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

    const isEmailFormat = body.mediaType === "Email Newsletter";

    const detailedPrompt = `
      You are an AI assistant for Samford University creating marketing content.
      Your persona is "The Inspirational and Confident Shepherd."
      
      Target Audience: ${body.audience || 'a general university audience'}.
      Media Type: ${body.mediaType || 'general content'}.
      Approximate Length: ${body.textCount || 150} ${body.textCountUnit || 'words'}.
      User's Core Request: "${body.prompt}"
      ${body.sourceMaterials && body.sourceMaterials.length > 0 ? `Reference these materials if relevant: ${body.sourceMaterials.join(', ')}.` : ''}

      ---
      FINAL INSTRUCTIONS:
      Your entire output must be a single JSON object. Do not include any text or formatting outside of this JSON object.
      
      The JSON object must have two top-level keys: "content" and "justification".
      
      The "content" value should be another JSON object.
      - If the media type is "Email Newsletter", this object MUST contain the keys: "subject", "preheader", "body", and "signature".
      - For all other media types, this object should only contain one key: "body".
      
      The "justification" value must be a string explaining your creative choices.
      
      Example for Email Newsletter:
      {
        "content": {
          "subject": "Your Future Awaits at Samford!",
          "preheader": "Discover your path with us.",
          "body": "Dear [Student Name], ...",
          "signature": "Warmly, The Samford Admissions Team"
        },
        "justification": "The tone is welcoming and aligned with the Shepherd archetype..."
      }
      
      Example for Social Media Post:
      {
        "content": {
          "body": "Join the Samford family! Orientation is just around the corner..."
        },
        "justification": "This post is concise and energetic to fit social media platforms."
      }
    `;
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
    
    const result = await model.generateContent(detailedPrompt);
    const response = result.response;
    let text = response.text();

    // Clean the response to ensure it's valid JSON
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let generatedText = "";
    let justification = "Justification not provided in the expected format.";

    try {
        const parsedResponse = JSON.parse(text);
        justification = parsedResponse.justification || justification;

        if (isEmailFormat && parsedResponse.content) {
            const { subject, preheader, body: emailBody, signature } = parsedResponse.content;
            generatedText = [subject, preheader, emailBody, signature].filter(Boolean).join('\n\n');
        } else if (parsedResponse.content && parsedResponse.content.body) {
            generatedText = parsedResponse.content.body;
        } else {
            throw new Error("AI response did not contain the expected 'content' object.");
        }
    } catch (e) {
        console.error("Failed to parse AI response as JSON:", e);
        console.error("Raw AI response:", text);
        // Fallback to using the raw text if JSON parsing fails
        generatedText = text.split(/\nJustification:/i)[0] || "Error: Could not process AI response.";
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