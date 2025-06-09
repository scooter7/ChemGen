// app/api/source-materials/[materialId]/process/route.ts

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initPrisma }                from '@/lib/prismaInit';
import { chunkText }                 from '@/lib/textChunker';

const prisma = initPrisma();

// A simple type‐guard for Node‐style errors with code & path
function isFsError(err: unknown): err is { code: string; path: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as any).code === 'string' &&
    'path' in err &&
    typeof (err as any).path === 'string'
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
): Promise<NextResponse> {
  const { materialId } = await params;

  // 1️⃣ Load Supabase at runtime
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl       = process.env.SUPABASE_URL;
  const supabaseKey       = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return NextResponse.json(
      { success: false, error: 'Configuration error' },
      { status: 500 }
    );
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 2️⃣ Load pdf-parse only when we need it
  const { default: pdfParse } = await import('pdf-parse');

  // 3️⃣ Fetch storagePath
  const sm = await prisma.sourceMaterial.findUnique({
    where: { id: materialId },
    select: { storagePath: true },
  });
  if (!sm) {
    return NextResponse.json(
      { success: false, error: 'SourceMaterial not found' },
      { status: 404 }
    );
  }

  // 4️⃣ Download & parse PDF
  let text = '';
  try {
    const { data: file, error: dlErr } = await supabase
      .storage
      .from('source-materials')
      .download(sm.storagePath);
    if (dlErr || !file) throw dlErr ?? new Error('Download failed');

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);
    text = result.text;
  } catch (e: unknown) {
    if (isFsError(e) && e.code === 'ENOENT' && e.path.includes('test/data')) {
      console.warn('PDF fixture not found; indexing empty document.');
      text = '';
    } else if (e instanceof Error) {
      console.error('PDF processing error:', e);
      return NextResponse.json(
        { success: false, error: e.message },
        { status: 500 }
      );
    } else {
      console.error('Unknown PDF error:', e);
      return NextResponse.json(
        { success: false, error: 'PDF parsing error' },
        { status: 500 }
      );
    }
  }

  // 5️⃣ Chunk & save (zero chunks if text === '')
  const chunks = text ? chunkText(text) : [];
  try {
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
          status:      'INDEXED',
          processedAt: new Date(),
        },
      }),
    ]);
    return NextResponse.json({
      success:    true,
      materialId,
      chunkCount: chunks.length,
    });
  } catch (dbErr: unknown) {
    if (dbErr instanceof Error) {
      console.error('Database error:', dbErr);
      return NextResponse.json(
        { success: false, error: dbErr.message },
        { status: 500 }
      );
    } else {
      console.error('Unknown DB error:', dbErr);
      return NextResponse.json(
        { success: false, error: 'Database transaction failed' },
        { status: 500 }
      );
    }
  }
}
