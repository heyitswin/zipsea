'use client';

import Image from 'next/image';
import { useState, useCallback } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className = '',
  style,
  priority = false,
  sizes,
  quality = 75,
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);
  const [useDirectImage, setUseDirectImage] = useState(false);
  const [useProxy, setUseProxy] = useState(false);

  const handleImageError = useCallback(() => {
    console.warn(`Image optimization failed for: ${src}`);
    setImageError(true);
    
    const isExternalImage = src.startsWith('http://') || src.startsWith('https://');
    
    if (isExternalImage && !useProxy) {
      // First fallback: try using image proxy
      console.log(`Trying image proxy for: ${src}`);
      setUseProxy(true);
    } else {
      // Second fallback: use direct image
      console.log(`Trying direct image for: ${src}`);
      setUseDirectImage(true);
    }
    
    onError?.();
  }, [src, onError, useProxy]);

  const handleDirectImageError = useCallback(() => {
    console.error(`All image loading methods failed for: ${src}`);
    onError?.();
  }, [src, onError]);

  const isExternalImage = src.startsWith('http://') || src.startsWith('https://');

  // Determine which image source to use
  let finalSrc = src;
  if (useProxy && isExternalImage) {
    finalSrc = `/api/image-proxy?url=${encodeURIComponent(src)}`;
  }

  // For external images that failed Next.js optimization, use direct img tag
  if (imageError && (useDirectImage || useProxy)) {
    return (
      <img
        src={finalSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={{
          ...style,
          objectFit: fill ? 'cover' : undefined,
          ...(fill && { position: 'absolute', inset: 0, width: '100%', height: '100%' })
        }}
        onError={handleDirectImageError}
        onLoad={onLoad}
        loading={priority ? 'eager' : 'lazy'}
      />
    );
  }

  // Use Next.js Image component for optimization when possible
  const imageProps = {
    src,
    alt,
    className,
    style,
    priority,
    quality,
    placeholder,
    blurDataURL,
    onError: handleImageError,
    onLoad,
    sizes,
  };

  if (fill) {
    return (
      <Image
        {...imageProps}
        fill
      />
    );
  }

  return (
    <Image
      {...imageProps}
      width={width || 0}
      height={height || 0}
    />
  );
}