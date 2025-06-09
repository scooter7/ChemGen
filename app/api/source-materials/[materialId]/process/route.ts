// app/api/source-materials/[materialId]/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, type DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initPrisma } from '@/lib/prismaInit';
import cuid from 'cuid';
import { extractTextFromSource } from '@/lib/pdfProcessor'; // Import the new helper

// Augment NextAuth Session to include user.id
declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

interface RouteContext {
  params: {
    materialId: string;
  };
}

const prisma = initPrisma();

const GEMINI_KEY = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const chunks: string[] = [];
  let index = 0;
  while (index < text.length) {
    const end = Math.min(index + chunkSize, text.length);
    chunks.push(text.slice(index, end));
    index += chunkSize - overlap;
  }
  return chunks.filter(c => c.trim().length > 10);
}

export async function POST(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { materialId } = params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const src = await prisma.sourceMaterial.findUnique({
      where: { id: materialId, userId: session.user.id }
    });
    if (!src) {
      return NextResponse.json({ message: 'Not found or access denied' }, { status: 404 });
    }

    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'PROCESSING', processedAt: new Date() }
    });

    // Use the helper function to get the text
    const text = await extractTextFromSource(src);

    const chunks = chunkText(text);
    for (const chunk of chunks) {
      const resp = await embeddingModel.embedContent(chunk);
      const vec = `[${resp.embedding.values.join(',')}]`;
      const id = cuid();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DocumentChunk" ("id","sourceMaterialId","content","embedding","createdAt") VALUES ($1,$2,$3,$4::vector,NOW())`,
        id, materialId, chunk, vec
      );
    }

    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'INDEXED', processedAt: new Date() }
    });

    return NextResponse.json({ message: `Processed ${src.fileName}` }, { status: 200 });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    console.error("Processing error:", errorMessage);
    
    await prisma.sourceMaterial.update({
        where: { id: materialId },
        data: { status: 'FAILED' }
    }).catch(updateErr => console.error("Failed to update status to FAILED:", updateErr));
    
    return NextResponse.json({ message: 'Failed to process material', error: errorMessage }, { status: 500 });
  }
}