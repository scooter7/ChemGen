// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fuwufnydpnwubneipbzk.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  
  /**
   * Use the 'standalone' output mode.
   * This will automatically trace and include all necessary files,
   * including the ffmpeg and ffprobe binaries from node_modules,
   * in the final deployment package. This is the most reliable method.
   */
  output: "standalone",
};

export default nextConfig;