// app/api/source-materials/[materialId]/process/route.ts

// Polyfill for DOMMatrix in Node.js (so libraries that rely on it can run server-side)
// We cast to `any` here to avoid having to implement all of the static methods.
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-ignore: Assigning a minimal polyfill to DOMMatrix
  (globalThis as any).DOMMatrix = class {
    a: number; b: number; c: number; d: number; e: number; f: number;

    constructor(init?: string | number[]) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      if (typeof init === 'string') {
        const vals = init
          .replace('matrix(', '')
          .replace(')', '')
          .split(',')
          .map(Number);
        [this.a, this.b, this.c, this.d, this.e, this.f] = vals;
      } else if (Array.isArray(init) && init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }

    // no-op to satisfy interfaces
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    translate(tx: number, ty: number) { /* noop */ }

    // Add stub static methods so TS consumers won’t break at runtime if they’re used:
    static fromFloat32Array(array: Float32Array) { return new (globalThis as any).DOMMatrix() }
    static fromFloat64Array(array: Float64Array) { return new (globalThis as any).DOMMatrix() }
    static fromMatrix(other?: DOMMatrixInit) { return new (globalThis as any).DOMMatrix() }
  };
}

import { NextRequest, NextResponse } from 'next/server';
// import { extractPdfData } from '@/lib/pdfProcessor';
// import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
): Promise<NextResponse> {
  const { materialId } = await params; // Next.js 15 requires awaiting params

  try {
    // If you expect a JSON body, uncomment and use:
    // const { fileData } = await request.json();
    // const buffer = Buffer.from(fileData, 'base64');
    // const pdfData = await extractPdfData(buffer);
    // await prisma.sourceMaterial.update({
    //   where: { id: materialId },
    //   data: { processedText: pdfData.text },
    // });

    return NextResponse.json({ success: true, materialId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
