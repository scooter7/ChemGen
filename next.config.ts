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
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      // UPDATED: Replaced the installer package with the static package
      config.externals = [...config.externals, 'ffmpeg-static', 'ffprobe-static'];
    }

    return config;
  },
};

export default nextConfig;