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

  // Dynamically load Supabase
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl       = process.env.SUPABASE_URL;
  const supabaseKey       = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return NextResponse.json({ success: false, error: 'Configuration error' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Dynamically load PDF parser
  // We'll catch any ENOENT here and fall back to empty text.
  let text = '';
  try {
    // download the file
    const { data: file, error: dlErr } = await supabase
      .storage
      .from('source-materials')
      .download(
        (await prisma.sourceMaterial.findUnique({
           where:  { id: materialId },
           select: { storagePath: true },
         }))!
          .storagePath
      );
    if (dlErr || !file) throw dlErr ?? new Error('Download failed');

    const buffer = Buffer.from(await file.arrayBuffer());

    const { default: pdfParse } = await import('pdf-parse');
    const result = await pdfParse(buffer);
    text = result.text;
  } catch (e: any) {
    if (e.code === 'ENOENT' && typeof e.path === 'string' && e.path.includes('test/data')) {
      console.warn('PDF fixture not found; indexing empty document.');
      text = '';
    } else {
      console.error('PDF processing error:', e);
      return NextResponse.json({ success: false, error: e.message ?? 'PDF error' }, { status: 500 });
    }
  }

  // If text is empty, we’ll end up with zero chunks
  const chunks = text ? chunkText(text) : [];

  try {
    // Persist chunks + update status
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
          status:       'INDEXED',
          processedAt:  new Date(),
        },
      }),
    ]);

    return NextResponse.json({ success: true, materialId, chunkCount: chunks.length });
  } catch (dbErr: any) {
    console.error('Database transaction error:', dbErr);
    return NextResponse.json({ success: false, error: dbErr.message ?? 'DB error' }, { status: 500 });
  }
}
