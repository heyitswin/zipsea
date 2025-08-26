# Zipsea Frontend Deployment Guide

## Image Loading Issues Fix

This document outlines the solution for 502 Bad Gateway errors when loading external images through Next.js Image optimization API on Render deployment.

## Problem

- Next.js Image component was causing 502 Bad Gateway errors for external images from `static.traveltek.net`
- URLs like `/_next/image?url=https%3A%2F%2Fstatic.traveltek.net%2Fcruisepics%2Flocal_shipimages%2F[image].jpg` were failing
- Images worked fine in development but failed in production on Render

## Solution Implemented

### 1. Enhanced Next.js Configuration

Updated `next.config.ts` with:
- Proper `remotePatterns` configuration for external images
- Production-optimized image settings
- Content security policy for better image handling
- Reduced cache TTL for external images

### 2. Custom OptimizedImage Component

Created `/lib/OptimizedImage.tsx` with:
- Automatic fallback system (Next.js → Image Proxy → Direct Image)
- Error handling for failed image optimization
- Maintains all Next.js Image component features
- Graceful degradation for production environments

### 3. Image Proxy API

Created `/app/api/image-proxy/route.ts` with:
- Proxies external images through Next.js API routes
- Domain whitelist security (`static.traveltek.net`)
- Proper caching headers
- Error handling and timeouts

### 4. Multiple Deployment Options

#### Option A: Use Current Configuration
- Deploy with the updated `next.config.ts`
- External images will fallback to direct loading if Next.js optimization fails

#### Option B: Use Production-Specific Configuration
- Run `npm run build:production` instead of `npm run build` on Render
- This uses `next.config.production.ts` which disables image optimization for external images

## Render Deployment Instructions

### Environment Variables (Optional)
```
NODE_ENV=production
NEXT_PUBLIC_ALLOWED_IMAGE_DOMAINS=static.traveltek.net
```

### Build Command Options

**Standard Build (Recommended):**
```bash
npm run build
```

**Production Build (Alternative):**
```bash
npm run build:production
```

### Files Modified/Created

1. **Modified:**
   - `/next.config.ts` - Enhanced image configuration
   - `/app/page.tsx` - Updated to use OptimizedImage component
   - `/package.json` - Added production build script

2. **Created:**
   - `/lib/OptimizedImage.tsx` - Custom image component with fallbacks
   - `/app/api/image-proxy/route.ts` - Image proxy API
   - `/next.config.production.ts` - Alternative config for production
   - `/lib/imageLoader.js` - Custom image loader
   - `/.env.example` - Environment variable examples

## Testing

1. **Local Development:**
   ```bash
   npm run dev
   ```
   
2. **Production Build Test:**
   ```bash
   npm run build
   npm start
   ```

3. **Production Config Test:**
   ```bash
   npm run build:production
   npm start
   ```

## Monitoring

After deployment, monitor:
1. Browser developer console for image loading errors
2. Network tab for 502 responses on image requests
3. Server logs for image proxy API calls

## Fallback Behavior

The OptimizedImage component uses this fallback chain:
1. **Next.js Image Optimization** (preferred)
2. **Image Proxy API** (if Next.js fails)
3. **Direct Image Loading** (final fallback)

This ensures images will always load, even if Next.js optimization fails on Render.

## Best Practices for Production

1. Always use the OptimizedImage component for external images
2. Set appropriate cache headers for better performance
3. Monitor image loading performance in production
4. Consider using a CDN for external images if performance becomes an issue

## Troubleshooting

If images still fail after deployment:

1. Check browser console for specific error messages
2. Test the image proxy API directly: `/api/image-proxy?url=https://static.traveltek.net/path/to/image.jpg`
3. Verify that `static.traveltek.net` is accessible from Render's servers
4. Consider switching to the production build configuration that bypasses Next.js optimization entirely