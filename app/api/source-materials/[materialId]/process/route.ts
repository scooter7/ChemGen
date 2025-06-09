// app/api/source-materials/[materialId]/process/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import { extractPdfData }            from '@/lib/pdfProcessor';
import { initPrisma }                from '@/lib/prismaInit';
import { chunkText }                 from '@/lib/textChunker';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// initialize (or reuse) a PrismaClient instance
const prisma = initPrisma();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
): Promise<NextResponse> {
  const { materialId } = await params;

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
    if (downloadError || !file) throw downloadError ?? new Error('Download failed');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3️⃣ Extract raw text via pdf‐parse
    const { text } = await extractPdfData(buffer);

    // 4️⃣ Split text into manageable chunks
    const chunks = chunkText(text);

    // 5️⃣ Persist chunks + update status in one transaction
    await prisma.$transaction([
      prisma.documentChunk.createMany({
        data: chunks.map((chunk, idx) => ({
          sourceMaterialId: materialId,
          chunkIndex: idx,
          text: chunk,
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
  } catch (err: any) {
    console.error('Processing error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
