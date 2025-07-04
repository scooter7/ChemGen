import type { Metadata } from "next";
import "./globals.css";
import AuthSessionProvider from "./_components/AuthSessionProvider";
import { inter, schibstedGrotesk } from "./fonts";

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
    <html lang="en" className={`dark ${inter.variable} ${schibstedGrotesk.variable}`}>
      <body className="font-body bg-chemgen-dark text-chemgen-light">
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}