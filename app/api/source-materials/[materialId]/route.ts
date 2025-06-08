// app/api/source-materials/[materialId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions'; // Adjust path if needed
import { initPrisma } from '@/lib/prismaInit';
import { createClient } from '@supabase/supabase-js';
import { type DefaultSession } from 'next-auth';

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
// Ensure supabaseAdmin is initialized only if env vars are present
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

const BUCKET_NAME = 'source-materials';

export async function DELETE(
  _req: NextRequest, // The request object is not used, so it's prefixed with _
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

    // 1. Fetch SourceMaterial to verify ownership and get storagePath
    const sourceMaterialToDelete = await prisma.sourceMaterial.findUnique({
      where: { id: materialId },
    });

    if (!sourceMaterialToDelete) {
      return NextResponse.json({ message: 'Source material not found.' }, { status: 404 });
    }

    // Verify ownership
    if (sourceMaterialToDelete.userId !== userId) {
      return NextResponse.json({ message: 'Forbidden: You do not own this material.' }, { status: 403 });
    }

    // 2. Delete from Supabase Storage
    // The storagePath is the path *within* the bucket.
    if (sourceMaterialToDelete.storagePath) {
      console.log(`Attempting to delete from Supabase Storage: ${BUCKET_NAME}/${sourceMaterialToDelete.storagePath}`);
      const { error: deleteStorageError } = await supabaseAdmin
        .storage
        .from(BUCKET_NAME)
        .remove([sourceMaterialToDelete.storagePath]); // remove expects an array of paths

      if (deleteStorageError) {
        // Log the error but proceed to delete from DB if desired, or handle more strictly
        console.error('Error deleting file from Supabase Storage:', deleteStorageError.message);
        // Depending on policy, you might choose to not delete the DB record if storage deletion fails.
        // For now, we'll proceed to delete the DB record even if the file was somehow already gone from storage.
        // A more robust solution might involve a soft delete or retry mechanism for storage.
      } else {
        console.log(`Successfully deleted from Supabase Storage: ${sourceMaterialToDelete.storagePath}`);
      }
    } else {
        console.warn(`SourceMaterial record ${materialId} has no storagePath. Skipping Supabase Storage deletion.`);
    }

    // 3. Delete from Prisma database
    // This will also cascade delete associated DocumentChunks due to the schema relation
    await prisma.sourceMaterial.delete({
      where: { id: materialId },
    });
    console.log(`Successfully deleted SourceMaterial record ${materialId} from database.`);

    return NextResponse.json({ message: 'Source material deleted successfully.' }, { status: 200 });

  } catch (error) {
    console.error(`Error deleting material ${materialId}:`, error);
    let errorMessage = 'An unexpected error occurred while deleting the material.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ message: 'Failed to delete material.', error: errorMessage }, { status: 500 });
  }
}

// You could also add GET (for a single material) or PUT (for updating description, etc.) handlers here later.
// export async function GET(req: NextRequest, context: { params: { materialId: string } }) { ... }
// export async function PUT(req: NextRequest, context: { params: { materialId: string } }) { ... }