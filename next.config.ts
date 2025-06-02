// next.config.mjs (or next.config.js if your project uses that extension for ESM)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* existing config options here, if any */
  
  images: {
    remotePatterns: [
      {
        protocol: 'https', // Supabase storage URLs are typically HTTPS
        hostname: 'fuwufnydpnwubneipbzk.supabase.co', // Your specific Supabase project hostname
        port: '', // Default for HTTPS (443)
        pathname: '/storage/v1/object/public/**', // Allows images from any public bucket and path
      },
      // You can add more patterns here if you have other external image sources
    ],
  },
};

export default nextConfig;