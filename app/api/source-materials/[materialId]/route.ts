// app/api/source-materials/[materialId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import type { DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { initPrisma } from '@/lib/prismaInit';
import { createClient } from '@supabase/supabase-js';

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
  console.error("CRITICAL: Supabase environment variables not set for [materialId] route.");
}
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

const BUCKET_NAME = 'source-materials';

export async function DELETE(
  _req: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ message: 'Supabase client not configured on server.' }, { status: 500 });
  }

  const { materialId } = context.params;

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    if (!materialId) {
      return NextResponse.json({ message: 'Material ID is required.' }, { status: 400 });
    }

    const sourceMaterialToDelete = await prisma.sourceMaterial.findUnique({
      where: { id: materialId },
    });

    if (!sourceMaterialToDelete) {
      return NextResponse.json({ message: 'Source material not found.' }, { status: 404 });
    }

    if (sourceMaterialToDelete.userId !== userId) {
      return NextResponse.json({ message: 'Forbidden: You do not own this material.' }, { status: 403 });
    }

    if (sourceMaterialToDelete.storagePath) {
      const { error: deleteStorageError } = await supabaseAdmin
        .storage
        .from(BUCKET_NAME)
        .remove([sourceMaterialToDelete.storagePath]);

      if (deleteStorageError) {
        console.error('Error deleting file from Supabase Storage:', deleteStorageError.message);
      }
    }

    await prisma.sourceMaterial.delete({
      where: { id: materialId },
    });

    return NextResponse.json({ message: 'Source material deleted successfully.' }, { status: 200 });

  } catch (error) {
    let errorMessage = 'An unexpected error occurred while deleting the material.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Failed to delete material.', error: errorMessage }, { status: 500 });
  }
}