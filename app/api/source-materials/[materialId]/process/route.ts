/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = 'force-dynamic';

// Declare pdf-parse so TS won’t complain
declare module 'pdf-parse';

import { getServerSession, type DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initPrisma } from '@/lib/prismaInit';
import cuid from 'cuid';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

const prisma = initPrisma();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
const BUCKET = 'source-materials';

function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i += chunkSize - overlap;
  }
  return chunks.filter(c => c.trim().length > 10);
}

export async function POST(request: Request, context: any) {
  const materialId: string = context.params.materialId;

  // dynamic import so nothing runs at build time
  const { default: pdf } = await import('pdf-parse');

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    }

    const src = await prisma.sourceMaterial.findUnique({
      where: { id: materialId, userId: session.user.id }
    });
    if (!src) {
      return new Response(JSON.stringify({ message: 'Not found or access denied' }), { status: 404 });
    }

    if (['INDEXED', 'PROCESSING'].includes(src.status)) {
      await prisma.documentChunk.deleteMany({ where: { sourceMaterialId: materialId } });
    }
    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'PROCESSING', processedAt: new Date() }
    });

    const { data: fileData, error } = await supabaseAdmin
      .storage.from(BUCKET)
      .download(src.storagePath);
    if (error || !fileData) throw new Error(`Download failed: ${error?.message}`);
    const buffer = Buffer.from(await fileData.arrayBuffer());

    let text = '';
    if (src.fileType === 'application/pdf') {
      const pdfData = await pdf(buffer);
      text = pdfData.text;
    } else if (src.fileType?.startsWith('text/')) {
      text = buffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file type: ${src.fileType}`);
    }
    if (!text.trim()) throw new Error('No text extracted from document.');

    for (const chunk of chunkText(text)) {
      const resp = await embeddingModel.embedContent(chunk);
      const vec = `[${resp.embedding.values.join(',')}]`;
      const id = cuid();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DocumentChunk" 
         ("id","sourceMaterialId","content","embedding","createdAt")
         VALUES ($1,$2,$3,$4::vector,NOW())`,
        id, materialId, chunk, vec
      );
    }

    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'INDEXED', processedAt: new Date() }
    });

    return new Response(JSON.stringify({ message: `Processed ${src.fileName}` }), { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Processing error:', msg);

    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'FAILED' }
    }).catch(() => {});

    return new Response(JSON.stringify({ message: 'Failed', error: msg }), { status: 500 });
  }
}
