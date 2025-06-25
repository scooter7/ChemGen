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
  
  // Add this webpack config to handle the ffmpeg packages
  webpack: (config, { isServer }) => {
    // This is to prevent Webpack from bundling the ffmpeg-static and
    // ffprobe-installer packages, which are not designed to be bundled.
    if (isServer) {
      config.externals = [...config.externals, 'ffmpeg-static', '@ffprobe-installer/ffprobe'];
    }

    return config;
  },
};

export default nextConfig;