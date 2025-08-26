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
    // Disable image optimization for external images in production
    loader: process.env.NODE_ENV === 'production' ? 'custom' : 'default',
    // Custom loader function for production
    ...(process.env.NODE_ENV === 'production' && {
      path: '',
      loaderFile: './lib/imageLoader.js',
    }),
    // Keep optimization for local images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
  },
  // Fix workspace root detection for monorepo
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone',
    compress: true,
    poweredByHeader: false,
  }),
};

export default nextConfig;