// app/api/source-materials/[materialId]/process/route.ts

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initPrisma } from '@/lib/prismaInit';
import { chunkText } from '@/lib/textChunker';

// Polyfill for a browser-only API. We use 'global' for the Node.js environment.
// @ts-expect-error - We are intentionally polyfilling a browser API on the global object.
if (typeof global.DOMMatrix === 'undefined') {
  // @ts-expect-error - We are intentionally polyfilling a browser API on the global object.
  global.DOMMatrix = class DOMMatrix {
    // Declare properties to satisfy TypeScript
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    
    constructor() {
      // Mock properties to avoid potential errors during runtime
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
    translateSelf() { return this; }
    scaleSelf() { return this; }
    multiplySelf() { return this; }
  };
}

const prisma = initPrisma();

export async function POST(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
): Promise<NextResponse> {
  const { materialId } = context.params;

  if (!materialId) {
    return NextResponse.json({ success: false, error: 'Material ID is required.' }, { status: 400 });
  }

  const sourceMaterial = await prisma.sourceMaterial.findUnique({
    where: { id: materialId },
  });

  if (!sourceMaterial) {
    return NextResponse.json({ success: false, error: 'SourceMaterial not found' }, { status: 404 });
  }
  
  if (!sourceMaterial.storagePath) {
    return NextResponse.json({ success: false, error: 'SourceMaterial has no storage path' }, { status: 400 });
  }

  let text: string;
  try {
    // Dynamically import libraries to ensure they are only loaded at runtime
    const { createClient } = await import('@supabase/supabase-js');
    const pdfjs = await import('pdfjs-dist'); 
    
    if (pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = '';
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration error: URL or key is missing.');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: file, error: downloadError } = await supabase
      .storage
      .from('source-materials')
      .download(sourceMaterial.storagePath);

    if (downloadError || !file) {
      throw downloadError ?? new Error(`Failed to download file: ${sourceMaterial.storagePath}`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const doc = await pdfjs.getDocument({
        data: buffer,
    }).promise;

    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items
            .filter(item => 'str' in item)
            .map(item => (item as { str: string }).str);
        fullText += strings.join(' ') + '\n';
    }
    text = fullText;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error.';
    console.error(`Failed to process material ${materialId}:`, errorMessage);

    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'FAILED' },
    });

    return NextResponse.json({ success: false, error: `PDF processing failed: ${errorMessage}` }, { status: 500 });
  }

  // If parsing was successful, proceed to chunk and save
  try {
    const chunks = text ? chunkText(text) : [];
    
    await prisma.$transaction([
      prisma.documentChunk.createMany({
        data: chunks.map((chunkContent) => ({
          sourceMaterialId: materialId,
          content: chunkContent,
        })),
        skipDuplicates: true,
      }),
      prisma.sourceMaterial.update({
        where: { id: materialId },
        data: {
          status: 'INDEXED',
          processedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      materialId,
      chunkCount: chunks.length,
      message: "Material processed and indexed successfully!",
    });

  } catch (dbError: unknown) {
    const errorMessage = dbError instanceof Error ? dbError.message : 'Database transaction failed.';
    console.error(`Database error for material ${materialId}:`, errorMessage);

    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'FAILED' },
    });
    
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}