// app/api/source-materials/[materialId]/process/route.ts

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initPrisma }                from '@/lib/prismaInit';
import { chunkText }                 from '@/lib/textChunker';

const prisma = initPrisma();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
): Promise<NextResponse> {
  const { materialId } = await params;

  // 0️⃣ Dynamically load Supabase client at runtime
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase env vars');
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1️⃣ Dynamically load PDF parser
  const { extractPdfData } = await import('@/lib/pdfProcessor');

  try {
    // 2️⃣ Fetch storagePath from DB
    const sm = await prisma.sourceMaterial.findUnique({
      where: { id: materialId },
      select: { storagePath: true },
    });
    if (!sm) throw new Error('SourceMaterial not found');

    // 3️⃣ Download PDF blob
    const { data: file, error: downloadError } = await supabase
      .storage
      .from('source-materials')
      .download(sm.storagePath);
    if (downloadError || !file) throw downloadError ?? new Error('Download failed');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4️⃣ Extract text & chunk it
    const { text } = await extractPdfData(buffer);
    const chunks = chunkText(text);

    // 5️⃣ Persist chunks + update status
    await prisma.$transaction([
      prisma.documentChunk.createMany({
        data: chunks.map((c) => ({
          sourceMaterialId: materialId,
          content: c,
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
