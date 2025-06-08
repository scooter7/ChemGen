// app/api/source-materials/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import type { DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { initPrisma } from '@/lib/prismaInit';

// Augment the next-auth module to include the 'id' property
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
  console.error("CRITICAL_CONFIG_ERROR: Supabase URL or Service Role Key is not set in .env file for /api/source-materials/upload route.");
}

const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRoleKey!);

const BUCKET_NAME = 'source-materials';

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ message: 'Supabase client not configured on server due to missing environment variables.' }, { status: 500 });
  }

  try {
    const session = await getServerSession(authOptions);
    
    console.log('SESSION_IN_UPLOAD_ROUTE:', JSON.stringify(session, null, 2));

    if (!session || !session.user || !session.user.id) {
      console.error('Unauthorized attempt to upload: No valid session or user ID.');
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log('Attempting to create SourceMaterial for userId:', userId); 

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const description = formData.get('description') as string | null;

    if (!file) {
      return NextResponse.json({ message: 'No file provided.' }, { status: 400 });
    }

    const originalFileName = file.name;
    const fileExtension = originalFileName.split('.').pop() || 'bin';
    const nameWithoutExtension = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
    const uniqueFilenameSuffix = nanoid(8);
    const filePathInBucket = `${userId}/${nameWithoutExtension}_${uniqueFilenameSuffix}.${fileExtension}`;

    console.log(`Uploading to Supabase Storage: ${BUCKET_NAME}/${filePathInBucket}`);
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .upload(filePathInBucket, file, {
        cacheControl: '3600',
        upsert: false, 
      });

    console.log('Supabase Storage uploadData:', JSON.stringify(uploadData, null, 2));
    console.log('Supabase Storage uploadError:', JSON.stringify(uploadError, null, 2));

    if (uploadError) {
      console.error('Supabase Storage explicit upload error:', uploadError);
      throw new Error(uploadError.message || 'Failed to upload file to Supabase Storage.');
    }

    if (!uploadData || !uploadData.path) {
        console.error('Supabase Storage upload failed: No data or path returned from Supabase despite no explicit error.', uploadData);
        throw new Error('Supabase Storage upload failed: Critical - no data or path returned.');
    }
    
    console.log(`File uploaded to Supabase. Path: ${uploadData.path}. Creating Prisma record for userId: ${userId}`);
    const newSourceMaterial = await prisma.sourceMaterial.create({
      data: {
        userId: userId,
        fileName: originalFileName,
        fileType: file.type,
        storagePath: uploadData.path, 
        description: description || null,
        fileSize: file.size,
        status: 'UPLOADED',
      },
    });
    console.log('Prisma record created for SourceMaterial ID:', newSourceMaterial.id);

    return NextResponse.json(
      { 
        message: 'File uploaded and record created successfully!', 
        sourceMaterial: newSourceMaterial 
      }, 
      { status: 201 }
    );

  } catch (error) {
    console.error('File upload route processing error:', error);
    let errorMessage = 'An unexpected error occurred during file upload processing.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: 'File upload processing failed.', error: errorMessage }, { status: 500 });
  }
}