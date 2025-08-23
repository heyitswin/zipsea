import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.traveltek.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
