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

  // 1️⃣ Dynamically load Supabase
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 2️⃣ Dynamically load pdf-parse right here
  const { default: pdfParse } = await import('pdf-parse');

  try {
    // Fetch storagePath…
    const sm = await prisma.sourceMaterial.findUnique({
      where: { id: materialId },
      select: { storagePath: true },
    });
    if (!sm) throw new Error('SourceMaterial not found');

    // Download PDF…
    const { data: file, error: dlErr } = await supabase
      .storage
      .from('source-materials')
      .download(sm.storagePath);
    if (dlErr || !file) throw dlErr ?? new Error('Download failed');

    // Turn into Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse text directly—**no test-data fallback**
    const { text } = await pdfParse(buffer);

    // Chunk and persist
    const chunks = chunkText(text);
    await prisma.$transaction([
      prisma.documentChunk.createMany({
        data: chunks.map((c) => ({
          sourceMaterialId: materialId,
          content: c,
        })),
      }),
      prisma.sourceMaterial.update({
        where: { id: materialId },
        data: { status: 'INDEXED', processedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true, materialId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('Processing error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
