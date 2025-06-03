// app/api/generate-segmented-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;
// Ensure genAI and generationModel are initialized if API_KEY exists
let genAI: GoogleGenerativeAI | null = null;
let generationModel: any = null; // Use 'any' or a more specific type if available from SDK

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
  generationModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
} else {
  console.error("CRITICAL: GEMINI_API_KEY is not set for segmented content route.");
}


const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

interface SegmentedContentRequest {
  baseContent: string;
  segmentTags: string[];
  originalPromptData?: { // Define more specifically what you'll send
    audience?: string;
    mediaType?: string;
    archetypeRefinements?: Record<string, number>;
    dominantArchetype?: string;
  };
}

interface SegmentedVariation {
  segmentTag: string;
  generatedText: string;
  justification?: string;
}

export async function POST(req: NextRequest) {
  if (!API_KEY || !generationModel) { // Check if generationModel is initialized
    return NextResponse.json({ message: 'API Key for AI service is not configured or model failed to initialize.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as SegmentedContentRequest;
    const { baseContent, segmentTags, originalPromptData } = body;

    if (!baseContent || baseContent.trim() === '') {
      return NextResponse.json({ message: 'Base content is required.' }, { status: 400 });
    }
    if (!segmentTags || segmentTags.length === 0) {
      return NextResponse.json({ message: 'At least one segment tag is required.' }, { status: 400 });
    }

    const variations: SegmentedVariation[] = [];

    for (const tag of segmentTags) {
      const archetypeInfo = originalPromptData?.archetypeRefinements 
        ? Object.entries(originalPromptData.archetypeRefinements)
            .filter(([, percentage]) => percentage > 0)
            .map(([name, percentage]) => `${name}: ${percentage}%`)
            .join(', ')
        : (originalPromptData?.dominantArchetype || 'general university persona');

      let adaptationPrompt = `
        You are an AI assistant adapting marketing content for Samford University.
        The original content was generated for a target audience of "${originalPromptData?.audience || 'a general audience'}" 
        with the brand archetype(s) influence of: ${archetypeInfo}.
        
        Now, please adapt the following BASE CONTENT specifically for the segment: "${tag}".
        Focus on making it relevant and resonant for this segment. For example, if the segment is "Out-of-State Students", emphasize aspects welcoming to them. If "First-Generation", highlight support systems.
        Maintain the core message and purpose of the base content. The output should be only the adapted content for this segment, followed by a brief justification on a new line starting with "Justification:".

        BASE CONTENT:
        """
        ${baseContent}
        """

        ADAPTED CONTENT FOR "${tag}":
        [Generate the adapted content here]

        Justification:
        [Provide a brief justification for the specific changes made for this segment]
      `;

      console.log(`Prompting LLM for segment: "${tag}" (Prompt length: ${adaptationPrompt.length})`);
      
      const result = await generationModel.generateContent({
          contents: [{ role: "user", parts: [{text: adaptationPrompt}]}],
          safetySettings,
      });
      const response = result.response;
      
      if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts || response.candidates[0].content.parts.length === 0) {
        console.error(`LLM returned an empty or invalid response for segment "${tag}":`, JSON.stringify(response, null, 2));
        // Add a placeholder or error for this segment
        variations.push({
            segmentTag: tag,
            generatedText: `Error: AI failed to generate content for segment "${tag}".`,
            justification: "No justification due to generation error.",
        });
        continue; // Move to the next tag
      }
      const text = response.candidates[0].content.parts[0].text || "";

      let segmentedText = text;
      let segmentJustification = `Justification for '${tag}' adaptation.`; // Default
      
      // Attempt to parse justification
      const justificationMarker = "\nJustification:";
      const justificationIndex = text.lastIndexOf(justificationMarker); // Find the last occurrence

      if (justificationIndex !== -1) {
        segmentedText = text.substring(0, justificationIndex).replace(`ADAPTED CONTENT FOR "${tag}":`, "").trim();
        segmentJustification = text.substring(justificationIndex + justificationMarker.length).trim();
      } else {
        segmentedText = text.replace(`ADAPTED CONTENT FOR "${tag}":`, "").trim(); // Clean up if no justification found
      }

      variations.push({
        segmentTag: tag,
        generatedText: segmentedText,
        justification: segmentJustification,
      });
    }

    return NextResponse.json({
      message: 'Segmented content generated successfully.',
      segmentedVariations: variations,
    }, { status: 200 });

  } catch (error) {
    console.error('Error generating segmented content:', error);
    let errorMessage = 'An unexpected error occurred.';
    if (error instanceof Error) errorMessage = error.message;
    return NextResponse.json({ message: 'Failed to generate segmented content.', error: errorMessage }, { status: 500 });
  }
}