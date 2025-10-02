export default function imageLoader({ src, width, quality }) {
  const isExternal = src.startsWith("http://") || src.startsWith("https://");
  const isSvg = src.endsWith(".svg");

  // SVGs don't need optimization, serve them directly
  if (isSvg) {
    return src;
  }

  // In production, handle external images differently
  if (process.env.NODE_ENV === "production") {
    if (isExternal) {
      // For external images from known slow/problematic domains, use image proxy
      if (src.includes("static.traveltek.net")) {
        // Cap width at 1920px to prevent large images from exceeding proxy size limit
        // This avoids 413 errors when srcset requests very large sizes (e.g., 3840w)
        const maxWidth = 1920;
        const cappedWidth = Math.min(width, maxWidth);
        // Pass width parameter to proxy for resizing
        return `/api/image-proxy?url=${encodeURIComponent(src)}&w=${cappedWidth}&q=${quality || 75}`;
      }
      // For other external images, return original URL
      return src;
    }
    // For local images in production, serve them directly without optimization
    // This avoids 404 errors when Next.js image optimization isn't available
    return src;
  }

  // In development, use Next.js optimization for local images
  if (isExternal) {
    return src;
  }

  // For local images (non-SVG) in development, use Next.js optimization
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`;
}
