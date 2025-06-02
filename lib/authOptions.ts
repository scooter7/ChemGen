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
      async authorize(credentials, req) {
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
          // Add any other user properties you want in the session
          // and are present in your Prisma User model and NextAuth User type
        } as NextAuthUser; // Type assertion
      }
    })
    // You can add other providers here later (e.g., Google, GitHub)
  ],
  session: {
    strategy: 'jwt', // Using JWT for session strategy
  },
  pages: {
    signIn: '/login', // Redirect users to '/login' if they need to sign in
    // error: '/auth/error', // Optional: Error code passed in query string as ?error=
    // newUser: '/auth/new-user' // Optional: New users will be directed here on first sign in (leave out for now)
  },
  callbacks: {
    async jwt({ token, user, account, profile, isNewUser }) {
      // The `user` object is passed on sign-in.
      // `account` and `profile` are passed when using OAuth providers.
      if (user) {
        token.id = user.id;
        // You can add other properties from `user` to `token` here if needed
        // For example, if you have a 'role' in your Prisma User model:
        // if ((user as any).role) { token.role = (user as any).role; }
      }
      return token;
    },
    async session({ session, token, user }) {
      // `token` is the JWT token from the `jwt` callback.
      // `user` is the user data, for database strategy it's from the database, for jwt strategy it's from the token.
      // Here, we ensure the session.user object gets the id from the token.
      if (session.user && token.id) {
        (session.user as NextAuthUser & { id: string }).id = token.id as string;
        // If you added 'role' to the token in the jwt callback, you can add it to session here:
        // if (token.role) { (session.user as any).role = token.role; }
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET, // Secret for signing JWTs
  debug: process.env.NODE_ENV === 'development', // Enable debug messages in development
};