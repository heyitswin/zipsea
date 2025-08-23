import type { NextConfig } from "next";
import path from "path";

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
  // Fix workspace root detection for monorepo
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
