// app/api/source-materials/[materialId]/process/route.ts

// Polyfill for DOMMatrix for Node.js environment
if (typeof global.DOMMatrix === 'undefined') {
  // A simple mock class to prevent the ReferenceError from pdfjs-dist
  const MockDOMMatrix = class {
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

    // Add missing static methods to satisfy the type checker
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static fromFloat32Array(array32: Float32Array) { return new this(); }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static fromFloat64Array(array64: Float64Array) { return new this(); }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static fromMatrix(other?: unknown) { return new this(); }
  };
  // Assign to global object using 'any' to bypass strict type checking
  (global as any).DOMMatrix = MockDOMMatrix;
}


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, type DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { initPrisma } from '@/lib/prismaInit';
import cuid from 'cuid';

// Augment NextAuth Session to include user.id
declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

const prisma = initPrisma();

// Configure PDF.js worker in Node
if (typeof window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
}

// Supabase admin client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Supabase environment variables missing');
  throw new Error('Supabase not configured');
}
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Google Generative AI setup
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error('CRITICAL: GEMINI_API_KEY missing');
  throw new Error('GEMINI_API_KEY not set');
}
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

const BUCKET = 'source-materials';

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
  request: NextRequest,
  { params }: { params: { materialId: string } }
) {
  const materialId = params.materialId;

  // Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Load source material record
  const src = await prisma.sourceMaterial.findUnique({
    where: { id: materialId, userId: session.user.id }
  });
  if (!src) {
    return NextResponse.json({ message: 'Not found or access denied' }, { status: 404 });
  }

  // Cleanup old chunks if re-processing
  if (['INDEXED', 'PROCESSING'].includes(src.status)) {
    await prisma.documentChunk.deleteMany({ where: { sourceMaterialId: materialId } });
  }
  await prisma.sourceMaterial.update({
    where: { id: materialId },
    data: { status: 'PROCESSING', processedAt: new Date() }
  });

  // Download file from Supabase
  const { data: fileData, error } = await supabaseAdmin
    .storage.from(BUCKET).download(src.storagePath);
  if (error || !fileData) {
    throw new Error(`Download failed: ${error?.message}`);
  }
  const arrayBuffer = await fileData.arrayBuffer();

  // Extract text
  let text = '';
  if (src.fileType === 'application/pdf') {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n';
    }
  } else if (src.fileType?.startsWith('text/')) {
    text = Buffer.from(arrayBuffer).toString('utf-8');
  } else {
    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'FAILED', processedAt: new Date() }
    });
    return NextResponse.json({ message: `Unsupported file type: ${src.fileType}` }, { status: 400 });
  }

  if (!text.trim()) {
    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: {
        status: 'FAILED',
        processedAt: new Date(),
        description: (src.description || '') + ' No text found'
      }
    });
    return NextResponse.json({ message: 'No text extracted' }, { status: 400 });
  }

  // Chunk and embed
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

  // Mark indexed
  await prisma.sourceMaterial.update({
    where: { id: materialId },
    data: { status: 'INDEXED', processedAt: new Date() }
  });

  return NextResponse.json({ message: `Processed ${src.fileName}` }, { status: 200 });
}