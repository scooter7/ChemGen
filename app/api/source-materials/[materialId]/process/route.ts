// app/api/source-materials/[materialId]/process/route.ts

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { initPrisma }                from '@/lib/prismaInit';
import { chunkText }                 from '@/lib/textChunker';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const prisma = initPrisma();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
): Promise<NextResponse> {
  const { materialId } = await params;

  // 👉 Dynamic import so no test‐file logic fires on build
  const { extractPdfData } = await import('@/lib/pdfProcessor');

  try {
    // 1️⃣ Fetch storagePath from DB
    const sm = await prisma.sourceMaterial.findUnique({
      where: { id: materialId },
      select: { storagePath: true },
    });
    if (!sm) throw new Error('SourceMaterial not found');

    // 2️⃣ Download PDF blob from Supabase Storage
    const { data: file, error: downloadError } = await supabase
      .storage
      .from('source-materials')
      .download(sm.storagePath);
    if (downloadError || !file) throw downloadError;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3️⃣ Extract raw text via pdf‐parse
    const { text } = await extractPdfData(buffer);

    // 4️⃣ Split text into manageable chunks
    const chunks = chunkText(text);

    // 5️⃣ Persist chunks + update status in one transaction
    await prisma.$transaction([
      prisma.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          sourceMaterialId: materialId,
          content: chunk,
        })),
      }),
      prisma.sourceMaterial.update({
        where: { id: materialId },
        data: {
          status: 'INDEXED',
          processedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ success: true, materialId });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('Processing error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
