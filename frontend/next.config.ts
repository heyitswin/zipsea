import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.traveltek.net",
        port: "",
        pathname: "/**",
      },
    ],
    // Bypass Next.js image optimization for external images in production
    ...(process.env.NODE_ENV === "production" && {
      unoptimized: false, // Keep optimization for local images
      loader: "custom",
      loaderFile: "./lib/imageLoader.js",
    }),
    // Device and image sizes for optimization
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Add formats for better compatibility (development only)
    ...(process.env.NODE_ENV !== "production" && {
      formats: ["image/webp"],
    }),
    // Cache settings
    minimumCacheTTL: 60,
    // Security settings
    dangerouslyAllowSVG: false,
  },
  // Fix workspace root detection for monorepo
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Production optimizations
  ...(process.env.NODE_ENV === "production" && {
    output: "standalone",
    compress: true,
    poweredByHeader: false,
  }),
  // Webpack configuration for better chunk handling
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Improve chunk loading reliability
      config.output.crossOriginLoading = "anonymous";

      // Better chunk naming for cache busting
      config.output.chunkFilename = "static/chunks/[name].[contenthash].js";
    }
    return config;
  },
  // Redirects for SEO optimization
  async redirects() {
    return [
      // Redirect privacy-policy to privacy
      {
        source: "/privacy-policy",
        destination: "/privacy",
        permanent: true,
      },
      // Remove trailing slashes for consistency
      {
        source: "/:path+/",
        destination: "/:path+",
        permanent: true,
      },
      // Handle partytown (remove if not needed)
      {
        source: "/~partytown/:path*",
        destination: "/",
        permanent: false,
      },
      {
        source: "/~partytown",
        destination: "/",
        permanent: false,
      },
    ];
  },
  // Proxy API requests to backend to avoid CORS and SSL issues
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination:
          process.env.BACKEND_URL ||
          "https://zipsea-production.onrender.com/api/v1/:path*",
      },
    ];
  },
  // Security headers including CSP for Missive chat
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://webchat.missiveapp.com https://*.clerk.accounts.dev https://clerk.zipsea.com https://challenges.cloudflare.com https://us-assets.i.posthog.com https://www.googletagmanager.com",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://webchat.missiveapp.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data:",
              "connect-src 'self' https://zipsea-production.onrender.com https://api.zipsea.com https://auth.missiveapp.com https://webchat.missiveapp.com https://*.twilio.com wss://*.twilio.com https://*.rollbar.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.zipsea.com https://us.i.posthog.com https://us-assets.i.posthog.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google.com https://*.googleadservices.com https://*.googlesyndication.com https://*.doubleclick.net",
              "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://webchat.missiveapp.com https://www.googletagmanager.com https://*.google.com https://*.doubleclick.net https://*.googleadservices.com",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
