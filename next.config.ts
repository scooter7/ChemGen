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
  
  // This is the key change to ensure the binaries are included in the deployment
  experimental: {
    outputFileTracingIncludes: {
      '/api/generate-podcast-audio': ['./node_modules/ffmpeg-static/ffmpeg', './node_modules/ffprobe-static/ffprobe'],
    },
  },
};

export default nextConfig;