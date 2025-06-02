// app/_components/layout/Header.tsx
"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { UserCircle2 } from 'lucide-react'; // <<< ADD THIS IMPORT STATEMENT

// import { Menu } from 'lucide-react'; // For mobile menu toggle later

interface HeaderProps {
  // onMenuButtonClick?: () => void; // For mobile sidebar toggle
}

export default function Header({}: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="bg-white dark:bg-gray-900/30 backdrop-blur-md shadow-sm p-4 sticky top-0 z-40">
      <div className="container mx-auto flex items-center justify-between h-12">
        {/* Left side: Samford University Logo/Text */}
        <div className="text-lg md:text-xl font-bold text-gray-800 dark:text-slate-100">
          <Link href="/dashboard">SAMFORD UNIVERSITY</Link>
        </div>

        {/* Middle: Project Title (visible on larger screens) */}
        <div className="hidden lg:block text-center text-sm text-gray-500 dark:text-slate-400 font-medium">
          The Inspirational and Confident Shepherd
        </div>

        {/* Right side: Carnegie Logo/Text & User Info/Actions */}
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="text-base md:text-lg font-semibold text-gray-800 dark:text-slate-100">
            CARNEGIE
          </div>
          
          {session?.user && (
            <div className="flex items-center">
              {session.user.image ? (
                <img 
                  src={session.user.image} 
                  alt={session.user.name || "User avatar"} 
                  className="h-8 w-8 rounded-full border-2 border-slate-300 dark:border-slate-600 object-cover" 
                />
              ) : (
                <UserCircle2 size={28} className="text-slate-600 dark:text-slate-400" /> 
              )}
            </div>
          )}

          {/* Mobile menu button placeholder */}
          {/* <button
            // onClick={onMenuButtonClick}
            className="md:hidden p-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button> */}
        </div>
      </div>
    </header>
  );
}