// app/api/source-materials/[materialId]/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { initPrisma } from '@/lib/prismaInit';
import cuid from 'cuid';
import { type DefaultSession } from 'next-auth';

// Augment the next-auth module to include the 'id' property
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

const prisma = initPrisma(); 

if (typeof window === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("CRITICAL: Supabase environment variables not set for processing route.");
}
const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!);

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("CRITICAL: GEMINI_API_KEY is not set for processing route.");
}
const genAI = new GoogleGenerativeAI(API_KEY || "");
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

const BUCKET_NAME = 'source-materials';

function chunkText(text: string, chunkSize: number = 1500, overlap: number = 200): string[] {
  const chunks: string[] = [];
  if (!text) return chunks;
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.substring(i, end));
    i += (chunkSize - overlap);
    if (i < 0 && text.length > 0) i = 0; 
    else if (i >= text.length && end < text.length) break; 
  }
  return chunks.filter(chunk => chunk.trim().length > 10);
}


export async function POST(
  // The request object is not used, so it's prefixed with _
  _req: NextRequest, 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any 
) {
  const { materialId } = context.params; 

  if (!supabaseUrl || !supabaseServiceRoleKey || !API_KEY) {
    return NextResponse.json({ message: 'Server configuration error for processing.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    if (!materialId) {
      return NextResponse.json({ message: 'Material ID is required.' }, { status: 400 });
    }

    const sourceMaterial = await prisma.sourceMaterial.findUnique({
      where: { id: materialId, userId: userId },
    });

    if (!sourceMaterial) {
      return NextResponse.json({ message: 'Source material not found or access denied.' }, { status: 404 });
    }
    
    if (sourceMaterial.status === 'INDEXED' || sourceMaterial.status === 'PROCESSING') {
        console.log(`Material ${materialId} status is ${sourceMaterial.status}. Re-processing: Deleting old chunks.`);
        await prisma.documentChunk.deleteMany({ where: { sourceMaterialId: materialId }});
    }
    
    await prisma.sourceMaterial.update({
        where: { id: materialId },
        data: { status: 'PROCESSING', processedAt: new Date() },
    });

    console.log(`Attempting to download from Supabase path: ${sourceMaterial.storagePath} in bucket: ${BUCKET_NAME}`);
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .download(sourceMaterial.storagePath);

    console.log('Supabase downloadError object:', JSON.stringify(downloadError, null, 2));
    console.log('Supabase fileData object (on download attempt):', fileData ? 'Blob/File data received' : String(fileData)); 

    if (downloadError) {
        console.error('Full Supabase Storage download error object:', downloadError); 
        const errorMessage = typeof downloadError.message === 'string' ? downloadError.message : JSON.stringify(downloadError);
        throw new Error(`Failed to download file from Supabase. Raw error: ${errorMessage}`);
    }
    if (!fileData) {
      console.error('No file data returned from Supabase download, and no explicit error object was present.');
      throw new Error('No file data downloaded from Supabase.');
    }
        
    const fileArrayBuffer = await fileData.arrayBuffer();
    let extractedText = "";

    if (sourceMaterial.fileType === 'application/pdf') {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileArrayBuffer) });
      const pdfDocument = await loadingTask.promise;
      let fullText = "";
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: TextItem) => item.str).join(' ') + "\n";
      }
      extractedText = fullText;
      console.log(`Extracted ${pdfDocument.numPages} pages from PDF.`);
    } else if (sourceMaterial.fileType?.startsWith('text/')) {
      extractedText = Buffer.from(fileArrayBuffer).toString('utf-8');
    } else {
      await prisma.sourceMaterial.update({ where: { id: materialId }, data: { status: 'FAILED', processedAt: new Date() }});
      return NextResponse.json({ message: `Unsupported file type for processing: ${sourceMaterial.fileType}` }, { status: 400 });
    }

    if (!extractedText || !extractedText.trim()) {
        await prisma.sourceMaterial.update({ where: { id: materialId }, data: { status: 'FAILED', processedAt: new Date(), description: (sourceMaterial.description || "") + " No text content found." }});
        return NextResponse.json({ message: 'No text content found in the document.' }, { status: 400 });
    }

    const textChunks = chunkText(extractedText); 
    console.log(`Extracted text chunked into ${textChunks.length} chunks.`);

    if(textChunks.length === 0) {
        await prisma.sourceMaterial.update({ where: { id: materialId }, data: { status: 'FAILED', processedAt: new Date(), description: (sourceMaterial.description || "") + " Failed to chunk document." }});
        return NextResponse.json({ message: 'Failed to chunk document, no content to process.' }, { status: 400 });
    }


    let chunksEmbeddedCount = 0;
    for (const chunk of textChunks) {
      if (!chunk || chunk.trim() === "") continue;
      
      const embeddingResponse = await embeddingModel.embedContent(chunk);
      const embeddingValues = embeddingResponse.embedding.values;
      const embeddingString = `[${embeddingValues.join(',')}]`;
      
      const newChunkId = cuid();

      await prisma.$executeRawUnsafe(
        `INSERT INTO "DocumentChunk" ("id", "sourceMaterialId", "content", "embedding", "createdAt") 
         VALUES ($1, $2, $3, $4::vector, NOW())`,
        newChunkId,
        materialId, 
        chunk, 
        embeddingString
      );
      chunksEmbeddedCount++;
    }
    console.log(`${chunksEmbeddedCount} chunks embedded and stored.`);

    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'INDEXED', processedAt: new Date() },
    });

    return NextResponse.json({ message: `Successfully processed and indexed ${sourceMaterial.fileName}. ${chunksEmbeddedCount} chunks created.` }, { status: 200 });

  } catch (error) {
    console.error(`Error processing material ${materialId || 'unknown'}:`, error);
    if (materialId) {
        try {
            await prisma.sourceMaterial.update({
                where: { id: materialId },
                data: { status: 'FAILED', processedAt: new Date() },
            });
        } catch (statusUpdateError) {
            console.error("Failed to update material status to FAILED:", statusUpdateError);
        }
    }
    return NextResponse.json({ message: 'Failed to process material.', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}