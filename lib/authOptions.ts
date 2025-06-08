// lib/authOptions.ts
import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "jsmith@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials');
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          console.log('No user found with email:', credentials.email);
          return null; // No user found
        }

        // Ensure user.hashedPassword is not null or undefined
        if (!user.hashedPassword) {
            console.log('User does not have a password set (hashedPassword is null). Email:', credentials.email);
            return null;
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.hashedPassword);

        if (!isValidPassword) {
          console.log('Invalid password for user:', credentials.email);
          return null; // Password does not match
        }

        console.log('User authenticated:', user.email);
        // Return user object that will be stored in the session/JWT
        // Ensure it matches the expected structure for NextAuth's User type
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        } as NextAuthUser; // Type assertion
      }
    })
  ],
  session: {
    strategy: 'jwt', // Using JWT for session strategy
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      // The `user` object is passed on sign-in.
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // `token` is the JWT token from the `jwt` callback.
      if (session.user && token.id) {
        (session.user as NextAuthUser & { id: string }).id = token.id as string;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET, // Secret for signing JWTs
  debug: process.env.NODE_ENV === 'development', // Enable debug messages in development
};