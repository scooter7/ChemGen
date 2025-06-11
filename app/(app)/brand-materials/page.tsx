// app/(app)/brand-materials/page.tsx
"use client"; // This is CRITICAL. It makes this component client-side.

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// This dynamic import with ssr:false is the key to preventing build errors.
// It tells Next.js to not render the component on the server at all.
const BrandMaterialsClientPage = dynamic(
  () => import('./BrandMaterialsClientPage'),
  { 
    ssr: false, 
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
