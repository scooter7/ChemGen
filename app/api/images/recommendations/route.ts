// app/api/images/recommendations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { initPrisma } from '@/lib/prismaInit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ImageResource } from '@prisma/client'; // Import ImageResource type

const prisma = initPrisma();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("CRITICAL: GEMINI_API_KEY is not set for image recommendation route.");
}
const genAI = new GoogleGenerativeAI(API_KEY || "");
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

interface RecommendationRequest {
  textContent: string; // The generated marketing text
  topN?: number;      // How many image recommendations to return
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ message: 'API Key for AI service is not configured.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    const userId = session.user.id; // Use this to scope image search to user's images

    const body = await req.json() as RecommendationRequest;
    const { textContent, topN = 5 } = body; // Default to 5 recommendations

    if (!textContent || textContent.trim() === '') {
      return NextResponse.json({ message: 'Text content is required for recommendations.' }, { status: 400 });
    }

    // 1. Generate embedding for the input text content
    const queryEmbeddingResponse = await embeddingModel.embedContent(textContent);
    const queryEmbedding = queryEmbeddingResponse.embedding.values;
    const queryEmbeddingString = `[${queryEmbedding.join(',')}]`;

    // 2. Perform similarity search against ImageResource description embeddings
    // We want images whose AI-generated descriptions are similar to the provided text content.
    // Ensure you have a vector index on ImageResource.embedding (e.g., vector_cosine_ops)
    const recommendedImages = await prisma.$queryRaw<ImageResource[]>`
      SELECT 
        id, "fileName", "fileType", "publicUrl", "aiGeneratedDescription", 
        "uploadedAt", "width", "height", "fileSize", "userId", "updatedAt" 
        -- Do not select the "embedding" column itself unless needed for re-ranking client-side
      FROM "ImageResource"
      WHERE "userId" = ${userId} -- Scope search to the current user's images
      ORDER BY embedding <-> (${queryEmbeddingString}::vector)
      LIMIT ${topN}
    `;
    // The `<->` operator gives cosine distance (0 is most similar).
    // If your index is `vector_ip_ops` or you normalize embeddings for dot product, use `<#>` and `DESC`.

    console.log(`Found ${recommendedImages.length} image recommendations for user ${userId}.`);

    return NextResponse.json({
      message: 'Image recommendations retrieved successfully.',
      recommendations: recommendedImages,
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching image recommendations:', error);
    let errorMessage = 'An unexpected error occurred while fetching image recommendations.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Error fetching image recommendations.', error: errorMessage },
      { status: 500 }
    );
  }
}