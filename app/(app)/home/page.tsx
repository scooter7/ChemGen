"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ContentCreationForm from "@/app/_components/marketing-content/ContentCreationForm";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg font-heading">Loading Home...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg font-heading">Redirecting to login...</p>
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <div className="space-y-8">
        <div className="bg-[#112D36] shadow-xl rounded-lg p-6 md:p-8">
          <div className="flex flex-wrap justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-heading text-chemgen-light">
              Welcome, {session?.user?.name || session?.user?.email || "User"}!
            </h1>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-5 py-2.5 bg-[#18313A] hover:bg-[#1B3A44] text-chemgen-light font-body font-normal rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400 mt-4 sm:mt-0"
            >
              Sign Out
            </button>
          </div>
          <p className="text-chemgen-light font-body font-light">
            Use the form below to generate your marketing content.
          </p>
        </div>
        <ContentCreationForm />
      </div>
    );
  }

  return null;
}