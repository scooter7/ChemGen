// app/api/content-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { initPrisma } from '@/lib/prismaInit';

const prisma = initPrisma();

// GET handler to fetch history for the logged-in user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const history = await prisma.contentGeneration.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(history, { status: 200 });
  } catch (error) {
    console.error('Error fetching content history:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Error fetching content history', error: errorMessage }, { status: 500 });
  }
}

// POST handler to save a new history item
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json();
    const {
      promptText,
      audience,
      mediaType,
      generatedBodyHtml,
      justification,
    } = body;

    if (!promptText || !generatedBodyHtml) {
      return NextResponse.json({ message: 'Missing required fields for history' }, { status: 400 });
    }

    const newHistoryItem = await prisma.contentGeneration.create({
      data: {
        userId,
        promptText,
        audience,
        mediaType,
        generatedBodyHtml,
        justification,
      },
    });

    return NextResponse.json(newHistoryItem, { status: 201 });
  } catch (error) {
    console.error('Error saving content history:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Error saving content history', error: errorMessage }, { status: 500 });
  }
}