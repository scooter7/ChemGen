// app/api/source-materials/[materialId]/process/route.ts

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { initPrisma }               from '@/lib/prismaInit';
import { chunkText }                from '@/lib/textChunker';
import { createClient }             from '@supabase/supabase-js';
import pdfParse                     from 'pdf-parse';

const prisma = initPrisma();

export async function POST(
  request: NextRequest,
  context: any // Using 'any' to bypass the build error, consistent with other routes.
): Promise<NextResponse> {
  const { materialId } = context.params;

  if (!materialId) {
    return NextResponse.json({ success: false, error: 'Material ID is required.' }, { status: 400 });
  }

  // 1. Fetch the SourceMaterial record to get its storage path
  const sourceMaterial = await prisma.sourceMaterial.findUnique({
    where: { id: materialId },
  });

  if (!sourceMaterial) {
    return NextResponse.json({ success: false, error: 'SourceMaterial not found' }, { status: 404 });
  }
  
  if (!sourceMaterial.storagePath) {
    return NextResponse.json({ success: false, error: 'SourceMaterial has no storage path' }, { status: 400 });
  }

  // 2. Attempt to download and parse the file
  let text: string;
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration error: URL or key is missing.');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Download from Supabase
    const { data: file, error: downloadError } = await supabase
      .storage
      .from('source-materials')
      .download(sourceMaterial.storagePath);

    if (downloadError || !file) {
      throw downloadError ?? new Error(`Failed to download file from Supabase: ${sourceMaterial.storagePath}`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);
    text = result.text;
  } catch (error: unknown) {
    // If ANY error occurs during download or parsing, mark as FAILED
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error.';
    console.error(`Failed to process material ${materialId}:`, errorMessage);

    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'FAILED' },
    });

    return NextResponse.json({ success: false, error: `PDF processing failed: ${errorMessage}` }, { status: 500 });
  }

  // 3. If parsing was successful, chunk the text and save to the database
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
    // Handle database transaction errors
    const errorMessage = dbError instanceof Error ? dbError.message : 'Database transaction failed.';
    console.error(`Database error for material ${materialId}:`, errorMessage);

    await prisma.sourceMaterial.update({
      where: { id: materialId },
      data: { status: 'FAILED' },
    });
    
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}