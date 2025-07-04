// app/api/source-materials/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import type { DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { initPrisma } from '@/lib/prismaInit';
import { chunkText } from '@/lib/textChunker';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

const prisma = initPrisma();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("CRITICAL_CONFIG_ERROR: Supabase URL or Service Role Key is not set.");
}

const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!);
const BUCKET_NAME = 'source-materials';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
    }
    const userId = session.user.id;
    
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const description = formData.get('description') as string | null;
    const extractedText = formData.get('extractedText') as string | null;

    if (!file) {
      return NextResponse.json({ message: 'No file provided.' }, { status: 400 });
    }

    const uniqueSuffix = nanoid(8);
    const filePathInBucket = `${userId}/${file.name}-${uniqueSuffix}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .upload(filePathInBucket, file);

    if (uploadError) {
      throw new Error(uploadError.message || 'Failed to upload file to Supabase.');
    }

    const newSourceMaterial = await prisma.$transaction(async (tx) => {
      // THE FIX: Determine status based on whether a processing attempt was made for a PDF
      const wasProcessingAttempted = file.type === 'application/pdf' && extractedText !== null;
      const chunks = extractedText ? chunkText(extractedText) : [];
      
      const material = await tx.sourceMaterial.create({
        data: {
          userId: userId,
          fileName: file.name,
          fileType: file.type,
          storagePath: uploadData.path, 
          description: description,
          fileSize: file.size,
          // If a PDF was processed (even if no text was found), status is INDEXED.
          // Otherwise, it's just UPLOADED.
          status: wasProcessingAttempted ? 'INDEXED' : 'UPLOADED',
          processedAt: wasProcessingAttempted ? new Date() : null,
        },
      });

      if (chunks.length > 0) {
        await tx.documentChunk.createMany({
          data: chunks.map(chunkContent => ({
            sourceMaterialId: material.id,
            content: chunkContent,
          })),
        });
      }

      return material;
    });

    const message = newSourceMaterial.status === 'INDEXED'
      ? 'File uploaded and indexed successfully!'
      : 'File uploaded and stored.';

    return NextResponse.json(
      { message: message, sourceMaterial: newSourceMaterial }, 
      { status: 201 }
    );

  } catch (error) {
    console.error('Unified upload/process error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ message: 'Processing failed.', error: errorMessage }, { status: 500 });
  }
}