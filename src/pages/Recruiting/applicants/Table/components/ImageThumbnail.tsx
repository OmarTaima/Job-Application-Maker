// components/ImageThumbnail.tsx
import { useState, useEffect } from 'react';

// Simple in-memory cache for compressed thumbnails
const thumbnailCache: Map<string, string> = new Map();

async function createCompressedDataUrl(
  src: string,
  maxBytes = 5120
): Promise<string> {
  if (!src) return src;
  if (thumbnailCache.has(src)) return thumbnailCache.get(src) as string;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    let resolved = false;

    const finish = (result: string) => {
      if (resolved) return;
      resolved = true;
      try {
        thumbnailCache.set(src, result);
      } catch (e) {}
      resolve(result);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(src);
        
        // Scale down to a reasonable thumbnail size
        const MAX_DIM = 160;
        let { width, height } = img;
        const ratio = Math.max(width / MAX_DIM, height / MAX_DIM, 1);
        canvas.width = Math.max(32, Math.round(width / ratio));
        canvas.height = Math.max(32, Math.round(height / ratio));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const tryQualities = (qualities: number[]) => {
          for (const q of qualities) {
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', q);
              const b64 = dataUrl.split(',')[1] || '';
              const bytes = Math.ceil((b64.length * 3) / 4);
              if (bytes <= maxBytes) return dataUrl;
            } catch (e) {
              // toDataURL may throw on cross-origin images
              return null;
            }
          }
          return null;
        };

        let dataUrl = tryQualities([
          0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1,
        ]);
        
        if (dataUrl) return finish(dataUrl);

        // Progressively downscale and retry
        let w = canvas.width;
        let h = canvas.height;
        while ((w > 32 || h > 32) && !dataUrl) {
          w = Math.max(24, Math.floor(w * 0.75));
          h = Math.max(24, Math.floor(h * 0.75));
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          dataUrl = tryQualities([0.6, 0.4, 0.25, 0.15, 0.1]);
        }

        if (dataUrl) return finish(dataUrl);
        
        // Fallback to original src
        finish(src);
      } catch (e) {
        finish(src);
      }
    };

    img.onerror = () => finish(src);
    
    // Attempt load; if the image is data: or same-origin, this will work
    try {
      img.src = src;
    } catch (e) {
      finish(src);
    }
    
    // Safety timeout: resolve with original after 1500ms
    setTimeout(() => finish(src), 1500);
  });
}

interface ImageThumbnailProps {
  src?: string | null;
  alt?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | number;
  showFallback?: boolean;
  fallbackIcon?: React.ReactNode;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export function ImageThumbnail({
  src,
  alt,
  className = '',
  size = 'md',
  showFallback = true,
  fallbackIcon,
  onLoad,
  onError,
}: ImageThumbnailProps) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Get fallback character from alt text
  const getFallbackChar = () => {
    if (!alt) return '-';
    const firstChar = alt.charAt(0);
    // Check if it's an Arabic letter (Unicode range 0x0600-0x06FF)
    if (/[\u0600-\u06FF]/.test(firstChar)) {
      return firstChar;
    }
    return firstChar.toUpperCase();
  };

  // Get size classes
  const getSizeClasses = () => {
    if (typeof size === 'number') {
      return {
        container: `h-${size} w-${size}`,
        fontSize: `${Math.max(12, Math.floor(size * 0.4))}px`,
      };
    }
    
    switch (size) {
      case 'sm':
        return { container: 'h-8 w-8', fontSize: '12px' };
      case 'lg':
        return { container: 'h-12 w-12', fontSize: '18px' };
      case 'md':
      default:
        return { container: 'h-10 w-10', fontSize: '14px' };
    }
  };

  const sizeClasses = getSizeClasses();

  useEffect(() => {
    let mounted = true;
    setHasError(false);
    setIsLoading(true);
    
    if (!src) {
      setThumb(null);
      setIsLoading(false);
      mounted && onLoad?.();
      return () => {
        mounted = false;
      };
    }
    
    // If it's already a data URL, use it directly
    if (typeof src === 'string' && src.startsWith('data:')) {
      setThumb(src);
      setIsLoading(false);
      mounted && onLoad?.();
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const compressed = await createCompressedDataUrl(src as string, 5120);
        if (mounted) {
          setThumb(compressed || (src as string));
          setIsLoading(false);
          onLoad?.();
        }
      } catch (e) {
        console.warn('Failed to compress image:', e);
        if (mounted) {
          setThumb(src as string);
          setIsLoading(false);
          setHasError(true);
          onError?.(e as Error);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [src, onLoad, onError]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`${sizeClasses.container} animate-pulse rounded-full bg-gray-200 dark:bg-gray-700 ${className}`}
      />
    );
  }

  // Fallback state (no image or error)
  if (!thumb || hasError) {
    if (!showFallback) return null;
    
    if (fallbackIcon) {
      return (
        <div
          className={`flex ${sizeClasses.container} items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 ${className}`}
        >
          {fallbackIcon}
        </div>
      );
    }
    
    return (
      <div
        className={`flex ${sizeClasses.container} items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400 ${className}`}
        style={{ fontSize: sizeClasses.fontSize }}
      >
        {getFallbackChar()}
      </div>
    );
  }

  // Image loaded successfully
  return (
    <img
      loading="lazy"
      src={thumb}
      alt={alt || ''}
      className={`h-full w-full rounded-full object-cover ${className}`}
      onError={() => {
        setHasError(true);
        setThumb(null);
      }}
    />
  );
}

// Export utility function for external use if needed
export { createCompressedDataUrl, thumbnailCache };

export default ImageThumbnail;