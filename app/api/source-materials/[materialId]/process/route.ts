/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

// Polyfill for DOMMatrix in Node.js (so libraries that rely on it can run server-side)
if (typeof globalThis.DOMMatrix === 'undefined') {
  // Assign a minimal “duck-typed” polyfill for DOMMatrix
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

    // no-op to satisfy code paths that call it
    translate(_tx: number, _ty: number) { /* noop */ }

    static fromFloat32Array(_array: Float32Array): DOMMatrix {
      return new (globalThis as any).DOMMatrix();
    }
    static fromFloat64Array(_array: Float64Array): DOMMatrix {
      return new (globalThis as any).DOMMatrix();
    }
    static fromMatrix(_other?: DOMMatrixInit): DOMMatrix {
      return new (globalThis as any).DOMMatrix();
    }
  };
}

import { NextRequest, NextResponse } from 'next/server';
// import { extractPdfData } from '@/lib/pdfProcessor';
// import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
): Promise<NextResponse> {
  const { materialId } = await params; // Next.js 15 now requires awaiting params

  try {
    // Example payload parsing (uncomment & adapt if needed):
    // const { fileData } = await request.json();
    // const buffer = Buffer.from(fileData, 'base64');
    // const pdfData = await extractPdfData(buffer);
    // await prisma.sourceMaterial.update({
    //   where: { id: materialId },
    //   data: { processedText: pdfData.text },
    // });

    return NextResponse.json({ success: true, materialId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
