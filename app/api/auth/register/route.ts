// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10; // Standard salt rounds for bcrypt hashing

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    // 1. Validate essential input
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required.' },
        { status: 400 } // Bad Request
      );
    }

    // 2. Validate email format (basic)
    // Consider using a more robust validation library for production
    if (!/\S+@\S+\.\S+/.test(email)) {
        return NextResponse.json(
            { message: 'Invalid email format.' },
            { status: 400 } // Bad Request
        );
    }

    // 3. Validate password length (basic)
    // Consider enforcing more complex password policies for production
    if (password.length < 6) {
        return NextResponse.json(
            { message: 'Password must be at least 6 characters long.' },
            { status: 400 } // Bad Request
        );
    }

    // 4. Check if user already exists (case-insensitive email)
    const lowercasedEmail = email.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: lowercasedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email already exists.' },
        { status: 409 } // Conflict
      );
    }

    // 5. Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 6. Create the new user in the database
    const newUser = await prisma.user.create({
      data: {
        email: lowercasedEmail, // Store email in lowercase
        hashedPassword: hashedPassword,
        name: name || null, // `name` is optional, store as null if not provided
        // emailVerified: null, // If you implement email verification later
        // image: null, // Default profile image if any
      },
    });

    // 7. Return success response (do not return the hashedPassword)
    // It's good practice to return only necessary user information
    return NextResponse.json(
      {
        message: 'User registered successfully!',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        },
      },
      { status: 201 } // Created
    );

  } catch (error) {
    console.error('REGISTRATION_ERROR:', error); // Log the actual error for debugging

    // Provide a generic error message to the client
    return NextResponse.json(
      { message: 'An unexpected error occurred during registration. Please try again later.' },
      { status: 500 } // Internal Server Error
    );
  }
}