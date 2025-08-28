export default function imageLoader({ src, width, quality }) {
  const isExternal = src.startsWith('http://') || src.startsWith('https://');
  const isSvg = src.endsWith('.svg');
  
  // SVGs don't need optimization, serve them directly
  if (isSvg) {
    return src;
  }
  
  // In production, handle external images differently
  if (process.env.NODE_ENV === 'production' && isExternal) {
    // For external images from known slow/problematic domains, use image proxy
    if (src.includes('static.traveltek.net')) {
      return `/api/image-proxy?url=${encodeURIComponent(src)}`;
    }
    // For other external images, return original URL
    return src;
  }
  
  // In development, or for local images, use Next.js optimization
  if (isExternal) {
    return src;
  }
  
  // For local images (non-SVG), use Next.js optimization
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`;
}