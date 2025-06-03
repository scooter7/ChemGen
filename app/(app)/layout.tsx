// app/(app)/layout.tsx
import React from "react";
import Sidebar from "@/app/_components/layout/Sidebar";
import Header from "@/app/_components/layout/Header";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/authOptions";
// import { redirect } from "next/navigation";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />

      {/* This div will contain the header and the scrollable main content area */}
      <div className="flex flex-1 flex-col overflow-y-hidden">
        {/* Header has a fixed or intrinsic height */}
        <Header />

        {/* Main content area should take remaining space and scroll if needed */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-gray-50 dark:bg-gray-800/50">
          {children}
        </main>
      </div>
    </div>
  );
}
