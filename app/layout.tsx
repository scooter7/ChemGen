// app/layout.tsx (Root Layout)
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Your global styles (Tailwind directives)
import AuthSessionProvider from "./_components/AuthSessionProvider"; // Path to your session provider

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ChemGen Marketing AI",
  description: "AI-powered marketing content generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}