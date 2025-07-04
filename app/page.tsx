// app/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") {
      // Do nothing while loading session status
      return;
    }

    if (status === "authenticated") {
      router.replace("/home"); // User is logged in, go to home
    } else {
      router.replace("/login"); // User is not logged in, go to login
    }
  }, [session, status, router]);

  // Optional: Show a loading state or a blank page while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Loading...</p> {/* Or your custom loading spinner */}
    </div>
  );
}