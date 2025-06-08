// app/api/source-materials/[materialId]/process/route.ts

// Polyfill for DOMMatrix for Node.js environment
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;

    constructor(init?: string | number[]) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      if (typeof init === 'string') {
        const values = init.replace('matrix(', '').replace(')', '').split(',').map(Number);
        [this.a, this.b, this.c, this.d, this.e, this.f] = values;
      } else if (Array.isArray(init) && init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    translate(tx: number, ty: number) { return this; }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    scale(sx: number, sy: number) { return this; }

    // Disable unused-vars for polyfill static methods
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static fromFloat32Array(array32: Float32Array) { return new this(); }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static fromFloat64Array(array64: Float64Array) { return new this(); }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static fromMatrix(other?: unknown) { return new this(); }
  } as unknown as typeof DOMMatrix;
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, type DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { initPrisma } from '@/lib/prismaInit';
import cuid from 'cuid';

// Augment the next-auth module to include the 'id' property
declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
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
const genAI = new GoogleGenerativeAI(API_KEY);
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
  _req: NextRequest,
  { params }: { params: { materialId: string } }
) {
  const { materialId } = params;

  if (!supabaseUrl || !supabaseServiceRoleKey || !API_KEY) {
    return NextResponse.json({ message: 'Server configuration error for processing.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const sourceMaterial = await prisma.sourceMaterial.findUnique({
      where: { id: materialId, userId: session.user.id },
    });
    if (!sourceMaterial) {
      return NextResponse.json({ message: 'Source material not found or access denied.' }, { status: 404 });
    }

    if (sourceMaterial.status === 'INDEXED' || sourceMaterial.status === 'PROCESSING') {
      console.log(`Material ${materialId} status is ${sourceMaterial.status}. Re-processing: Deleting old chunks.`);
      await prisma.documentChunk.deleteMany({ where: { sourceMaterialId: materialId } });
    }

    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'PROCESSING', processedAt: new Date() },
    });

    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .download(sourceMaterial.storagePath);

    if (downloadError) {
      throw new Error(`Failed to download file from Supabase. Raw error: ${downloadError.message}`);
    }
    if (!fileData) {
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
        fullText += textContent.items.map(item => ('str' in item ? item.str : '')).join(' ') + "\n";
      }
      extractedText = fullText;
    } else if (sourceMaterial.fileType?.startsWith('text/')) {
      extractedText = Buffer.from(fileArrayBuffer).toString('utf-8');
    } else {
      await prisma.sourceMaterial.update({
        where: { id: materialId }, data: { status: 'FAILED', processedAt: new Date() }
      });
      return NextResponse.json({ message: `Unsupported file type: ${sourceMaterial.fileType}` }, { status: 400 });
    }

    if (!extractedText.trim()) {
      await prisma.sourceMaterial.update({
        where: { id: materialId }, data: { status: 'FAILED', processedAt: new Date(), description: (sourceMaterial.description || "") + " No text content found." }
      });
      return NextResponse.json({ message: 'No text content found.' }, { status: 400 });
    }

    const textChunks = chunkText(extractedText);
    if (!textChunks.length) {
      await prisma.sourceMaterial.update({
        where: { id: materialId }, data: { status: 'FAILED', processedAt: new Date(), description: (sourceMaterial.description || "") + " Failed to chunk document." }
      });
      return NextResponse.json({ message: 'Failed to chunk document.' }, { status: 400 });
    }

    for (const chunk of textChunks) {
      if (!chunk.trim()) continue;
      const embeddingResponse = await embeddingModel.embedContent(chunk);
      const embeddingValues = embeddingResponse.embedding.values;
      const embeddingString = `[${embeddingValues.join(',')}]`;
      const newChunkId = cuid();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DocumentChunk" ("id","sourceMaterialId","content","embedding","createdAt") VALUES ($1,$2,$3,$4::vector,NOW())`,
        newChunkId, materialId, chunk, embeddingString
      );
    }

    await prisma.sourceMaterial.update({
      where: { id: materialId }, data: { status: 'INDEXED', processedAt: new Date() }
    });

    return NextResponse.json({ message: `Successfully processed ${sourceMaterial.fileName}.` }, { status: 200 });

  } catch (error) {
    console.error(error);
    await prisma.sourceMaterial.update({
      where: { id: params.materialId }, data: { status: 'FAILED', processedAt: new Date() }
    });
    return NextResponse.json({ message: 'Processing failed.', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
