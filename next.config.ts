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
  
  // CORRECTED: Moved from 'experimental' to the top level
  outputFileTracingIncludes: {
    '/api/generate-podcast-audio': ['./node_modules/ffmpeg-static/ffmpeg', './node_modules/ffprobe-static/ffprobe'],
  },
};

export default nextConfig;