// app/api/source-materials/[materialId]/process/route.ts

// Polyfill for DOMMatrix in Node.js (so libraries that rely on it can run server-side)
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class {
    a: number; b: number; c: number; d: number; e: number; f: number;

    constructor(init?: string | number[]) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      if (typeof init === 'string') {
        const vals = init.replace('matrix(', '').replace(')', '').split(',').map(Number);
        [this.a, this.b, this.c, this.d, this.e, this.f] = vals;
      } else if (Array.isArray(init) && init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }

    // no-op to satisfy interfaces
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    translate(tx: number, ty: number) { /* noop */ }
  };
}

import { NextRequest, NextResponse } from 'next/server';
// (Any other imports you need, e.g. your PDF-parser, DB client, etc.)
// import { extractPdfData } from '@/lib/pdfProcessor';
// import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
): Promise<NextResponse> {
  // In Next.js 15 the `params` object is async
  const { materialId } = await params; 
                              // ─────────────────────────── await the Promise here :contentReference[oaicite:0]{index=0}

  try {
    // Parse the incoming JSON payload (if you expect JSON):
    const body = await request.json();

    // TODO: Replace the below with your actual material-processing logic.
    // For example, fetch & parse a PDF, store results in your database, etc.
    // const pdfBuffer = Buffer.from(body.fileData, 'base64');
    // const pdfData = await extractPdfData(pdfBuffer);
    // const record = await prisma.sourceMaterial.update({
    //   where: { id: materialId },
    //   data: { processedText: pdfData.text },
    // });

    // Return a success response (adjust shape as needed)
    return NextResponse.json({
      success: true,
      materialId,
      // data: record,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
