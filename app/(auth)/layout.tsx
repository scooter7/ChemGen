// app/(auth)/layout.tsx
import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        {/* You could add a logo or app name here */}
        {/* For example: <h1 className="text-2xl font-bold text-center mb-6">My App's Name</h1> */}
        {/* The example above would use a normal apostrophe ' if needed. */}
        {children}
      </div>
    </div>
  );
}