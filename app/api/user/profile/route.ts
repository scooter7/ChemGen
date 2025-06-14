// app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import type { DefaultSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { PrismaClient, User } from '@prisma/client';

// Augment the next-auth module to include the 'id' property
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const userId = session.user.id;

    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        department: true,
        title: true,
        languages: true,
        recruitmentRegion: true,
      },
    });

    if (!userProfile) {
      return NextResponse.json({ message: 'User profile not found.' }, { status: 404 });
    }

    return NextResponse.json(userProfile, { status: 200 });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    let errorMessage = 'An unexpected error occurred while fetching the profile.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Error fetching user profile.', error: errorMessage },
      { status: 500 }
    );
  }
}

interface UpdateProfileData {
  name?: string;
  department?: string;
  title?: string;
  languages?: string[];
  recruitmentRegion?: string;
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json() as UpdateProfileData;

    const { name, department, title, languages, recruitmentRegion } = body;

    if (languages && !Array.isArray(languages)) {
        return NextResponse.json({ message: 'Languages must be an array of strings.' }, { status: 400 });
    }
    if (languages && languages.some(lang => typeof lang !== 'string')) {
        return NextResponse.json({ message: 'Each language must be a string.' }, { status: 400 });
    }

    const updatedData: Partial<User> = {};
    if (name !== undefined) updatedData.name = name;
    if (department !== undefined) updatedData.department = department;
    if (title !== undefined) updatedData.title = title;
    if (languages !== undefined) updatedData.languages = languages;
    if (recruitmentRegion !== undefined) updatedData.recruitmentRegion = recruitmentRegion;

    if (Object.keys(updatedData).length === 0) {
        return NextResponse.json({ message: 'No update data provided.' }, { status: 400 });
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updatedData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        department: true,
        title: true,
        languages: true,
        recruitmentRegion: true,
      }
    });

    return NextResponse.json(
      { message: 'Profile updated successfully!', user: updatedUser },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error updating user profile:', error);
    let errorMessage = 'An unexpected error occurred while updating the profile.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: 'Error updating user profile.', error: errorMessage },
      { status: 500 }
    );
  }
}