// app/(app)/dashboard/page.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react"; // Import useEffect
import ContentCreationForm from "@/app/_components/marketing-content/ContentCreationForm";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Only run this effect if the status is not 'loading'
    // and the user is unauthenticated.
    if (status === "unauthenticated") {
      router.replace('/login');
    }
  }, [status, router]); // Dependencies for the effect

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg">Loading dashboard...</p>
      </div>
    );
  }

  // If unauthenticated and useEffect hasn't redirected yet, 
  // you might still show a loading/redirecting message or null
  // to prevent rendering the main content briefly.
  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg">Redirecting to login...</p>
      </div>
    );
  }
  
  // Only render the main dashboard content if authenticated
  if (status === "authenticated") {
    return (
      <div className="space-y-8">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
          <div className="flex flex-wrap justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Welcome, {session?.user?.name || session?.user?.email || "User"}!
            </h1>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 mt-4 sm:mt-0"
            >
              Sign Out
            </button>
          </div>
          <p className="text-gray-700 dark:text-gray-300">
            Use the form below to generate your marketing content.
          </p>
        </div>

        <ContentCreationForm /> 
        
      </div>
    );
  }

  // Fallback if status is somehow not loading, authenticated, or unauthenticated
  // Though this state should ideally not be reached with NextAuth's status types.
  return null; 
}