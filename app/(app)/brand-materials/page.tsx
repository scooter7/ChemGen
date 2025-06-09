// app/(app)/brand-materials/page.tsx

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Dynamically import the client-side page with SSR turned off.
// This ensures that the component and its dependencies (like pdfjs-dist)
// are never executed on the server during the build process.
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
)

export default function BrandMaterialsPage() {
  return <BrandMaterialsClientPage />
}