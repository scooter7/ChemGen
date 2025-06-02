// app/(app)/layout.tsx
import React from 'react';
import Sidebar from '@/app/_components/layout/Sidebar'; // UNCOMMENTED - Adjust path if needed
import Header from '@/app/_components/layout/Header';   // UNCOMMENTED - Adjust path if needed
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/authOptions";
// import { redirect } from "next/navigation";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Optional: Server-side check to protect this layout
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //  redirect('/login');
  // }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      <Sidebar /> {/* UNCOMMENTED and placed here */}
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header /> {/* UNCOMMENTED and placed here */}
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-gray-50 dark:bg-gray-800/50">
          {children}
        </main>
      </div>
    </div>
  );
}