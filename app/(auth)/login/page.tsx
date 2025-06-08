// app/(auth)/login/page.tsx
import React, { Suspense } from 'react';
import LoginForm from './LoginForm';

// A simple loading component to show while the login form is loading
function Loading() {
    return (
        <div className="bg-white dark:bg-gray-800 p-8 shadow-md rounded-lg animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mx-auto mb-6"></div>
            <div className="space-y-6">
                <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
        </div>
    );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LoginForm />
    </Suspense>
  );
}