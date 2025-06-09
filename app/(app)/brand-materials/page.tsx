// app/(app)/brand-materials/page.tsx
"use client"; // This is the critical line that fixes the build error.

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Now that this is a Client Component, we can legally use ssr: false.
// This ensures the BrandMaterialsClientPage and its dependencies (pdfjs-dist)
// are never executed on the server during the build process.
const BrandMaterialsClientPage = dynamic(
  () => import('./BrandMaterialsClientPage'),
  { 
    ssr: false, // This is the key to preventing the build error.
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <p className="ml-3 text-lg text-gray-600">Loading Brand Materials...</p>
      </div>
    )
  }
);

export default function BrandMaterialsPage() {
  return <BrandMaterialsClientPage />;
}
