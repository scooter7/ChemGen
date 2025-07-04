// app/_components/layout/Header.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-white dark:bg-gray-900/30 backdrop-blur-md shadow-sm p-4 sticky top-0 z-40">
      <div className="container mx-auto flex items-center justify-between h-12">
        {/* Left side: Samford University Logo/Text */}
        <div className="text-lg md:text-xl font-bold text-gray-800 dark:text-slate-100">
          <Link href="/home">SAMFORD UNIVERSITY</Link>
        </div>

        {/* Right side: Carnegie Logo/Text & User Info/Actions */}
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="text-base md:text-lg font-semibold text-gray-800 dark:text-slate-100">
            CARNEGIE
          </div>
          
          {session?.user && (
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}