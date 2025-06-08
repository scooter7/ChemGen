// app/api/source-materials/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import type { DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Prisma, ProcessingStatus } from '@prisma/client';
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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(req.url);
    const statusQuery = searchParams.get('status');

    const whereClause: Prisma.SourceMaterialWhereInput = { userId: userId };

    if (statusQuery && Object.values(ProcessingStatus).includes(statusQuery as ProcessingStatus)) {
      whereClause.status = statusQuery as ProcessingStatus;
    }

    const sourceMaterials = await prisma.sourceMaterial.findMany({
      where: whereClause,
      orderBy: {
        uploadedAt: 'desc',
      },
      select: {
        id: true,
        fileName: true,
        status: true,
      }
    });

    return NextResponse.json(sourceMaterials, { status: 200 });

  } catch (error) {
    console.error('Error fetching source materials:', error);
    let errorMessage = 'An unexpected error occurred while fetching source materials.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Error fetching source materials.', error: errorMessage },
      { status: 500 }
    );
  }
}