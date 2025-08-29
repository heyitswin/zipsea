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
    // Bypass Next.js image optimization for external images in production
    ...(process.env.NODE_ENV === 'production' && {
      unoptimized: false, // Keep optimization for local images
      loader: 'custom',
      loaderFile: './lib/imageLoader.js',
    }),
    // Device and image sizes for optimization
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Add formats for better compatibility (development only)
    ...(process.env.NODE_ENV !== 'production' && {
      formats: ['image/webp'],
    }),
    // Cache settings
    minimumCacheTTL: 60,
    // Security settings
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
  // Proxy API requests to backend to avoid CORS and SSL issues
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.BACKEND_URL || 'https://zipsea-production.onrender.com/api/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
