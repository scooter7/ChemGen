// app/_components/AuthSessionProvider.tsx
"use client"; // This directive marks this as a Client Component

import { SessionProvider } from "next-auth/react";
import React from "react";

interface Props {
  children: React.ReactNode;
  // If you were passing the session prop from a server component, you'd define it here:
  // session?: any; // Or more specific Session type from next-auth
}

export default function AuthSessionProvider({ children }: Props) {
  return <SessionProvider>{children}</SessionProvider>;
}