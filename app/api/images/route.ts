// app/api/images/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions'; // Adjust path if needed
import { initPrisma } from '@/lib/prismaInit';
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    const userId = session.user.id;

    const imageResources = await prisma.imageResource.findMany({
      where: { userId: userId },
      orderBy: {
        uploadedAt: 'desc', // Show newest first
      },
      select: { // Select only the fields needed for the list display
        id: true,
        fileName: true,
        fileType: true,
        publicUrl: true, // Important for displaying the image
        aiGeneratedDescription: true,
        uploadedAt: true,
        width: true,
        height: true,
        fileSize: true,
      },
    });

    return NextResponse.json(imageResources, { status: 200 });

  } catch (error) {
    console.error('Error fetching image resources:', error);
    let errorMessage = 'An unexpected error occurred while fetching image resources.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Error fetching image resources.', error: errorMessage },
      { status: 500 }
    );
  }
}