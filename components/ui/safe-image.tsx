'use client';

import * as React from 'react';
import Image, { type ImageProps } from 'next/image';

const ALLOWED_REMOTE_HOSTS = new Set<string>([
  'images.pexels.com',
  'kybgrsqqvejbvjediowo.supabase.co',
  'supabase.co',
]);

try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const host = new URL(supabaseUrl).hostname;
    if (host) ALLOWED_REMOTE_HOSTS.add(host);
  }
} catch {
  // ignore
}

function looksLikeHostPath(src: string): boolean {
  return /^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(src);
}

function normalizeRemoteSrc(src: string): string {
  if (!src) return src;
  const s = src.trim();
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (looksLikeHostPath(s)) return `https://${s}`;
  return s;
}

function isRemoteUrl(src: string): boolean {
  if (!src) return false;
  return (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('//') ||
    looksLikeHostPath(src)
  );
}

function isSupabaseUrl(src: string): boolean {
  if (!src) return false;
  try {
    const u = new URL(src);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const supaHost = new URL(supabaseUrl).hostname;
      if (u.hostname === supaHost) return true;
    }
    return u.hostname.endsWith('.supabase.co') || u.hostname.endsWith('.supabase.in');
  } catch {
    return false;
  }
}
function isSafeForNextImageRemote(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('data:') || src.startsWith('blob:')) return false;
  try {
    const u = new URL(src);
    return ALLOWED_REMOTE_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function toProxyUrl(src: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(src)}`;
}

type SafeImageProps = Omit<ImageProps, 'src'> & {
  src: string;
  preferNextImageForRemote?: boolean;
};

export function SafeImage({
  src,
  alt,
  fill,
  className,
  // Default OFF: only allowlisted remote images (Supabase storage, Pexels) are
  // routed through next/image when a caller opts in. Non-allowlisted hosts use
  // the raw <img> proxy path. This keeps remote storefront images rendering
  // reliably across hosts (incl. Render, where the image optimizer can fail).
  preferNextImageForRemote = false,
  ...rest
}: SafeImageProps) {
  const normalized = React.useMemo(() => normalizeRemoteSrc(String(src ?? '')), [src]);

  const isLocal = normalized.startsWith('/');
  const isData = normalized.startsWith('data:') || normalized.startsWith('blob:');
  const isSvg = /\.svg(\?|$)/i.test(normalized);
  const isRemote = isRemoteUrl(normalized);
  // Only raster remote images benefit from the resizing proxy.
  const canOptimize = isRemote && !isData && !isSvg;

  const anyRest = rest as any;
  const q =
    typeof anyRest.quality === 'number' && anyRest.quality >= 30 && anyRest.quality <= 95
      ? anyRest.quality
      : 68;
  const numericWidth = typeof anyRest.width === 'number' ? anyRest.width : Number(anyRest.width) || 0;

  // Build a responsive, optimized source set through our image proxy, which
  // resizes + compresses to WebP/AVIF (Supabase serves the raw multi-MB
  // originals, so this is the single biggest speed win). Falls back to the
  // original URL on error, so images can never go blank.
  const { primarySrc, computedSrcSet } = React.useMemo(() => {
    const proxied = (w: number) =>
      `/api/image-proxy?url=${encodeURIComponent(normalized)}&w=${w}&q=${q}`;
    if (!canOptimize) {
      return { primarySrc: normalized, computedSrcSet: undefined as string | undefined };
    }
    const RESPONSIVE_WIDTHS = [64, 96, 128, 160, 200, 256, 320, 384, 480, 640, 750, 828, 1080, 1200, 1600];
    let widths: number[];
    let base: number;
    if (numericWidth > 0) {
      const hi = Math.min(numericWidth * 2, 1600);
      widths = Array.from(new Set([numericWidth, hi])).filter((w) => w > 0);
      base = hi;
    } else {
      widths = RESPONSIVE_WIDTHS;
      base = 828;
    }
    return {
      primarySrc: proxied(base),
      computedSrcSet: widths.map((w) => `${proxied(w)} ${w}w`).join(', '),
    };
  }, [canOptimize, normalized, numericWidth, q]);

  const [imgSrc, setImgSrc] = React.useState<string>(primarySrc);
  const [imgSrcSet, setImgSrcSet] = React.useState<string | undefined>(computedSrcSet);
  React.useEffect(() => {
    setImgSrc(primarySrc);
    setImgSrcSet(computedSrcSet);
  }, [primarySrc, computedSrcSet]);

  const didFallbackRef = React.useRef(false);

  // Local static assets (og.png, icons, etc.) stay on next/image.
  if (isLocal) {
    const { unoptimized, ...imgRest } = rest as any;
    return (
      <Image
        src={normalized}
        alt={alt}
        fill={fill}
        className={className}
        unoptimized={unoptimized}
        {...imgRest}
      />
    );
  }

  const {
    width,
    height,
    loading,
    quality: _quality,
    priority,
    placeholder,
    blurDataURL,
    loader,
    unoptimized,
    onLoadingComplete,
    onError,
    sizes,
    srcSet: _srcSet,
    fetchPriority,
    ...imgRest
  } = rest as any;

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    try {
      onError?.(e);
    } catch {
      // ignore
    }
    // On failure, drop the proxy + srcSet and load the original URL directly.
    if (!didFallbackRef.current && normalized) {
      didFallbackRef.current = true;
      setImgSrcSet(undefined);
      setImgSrc(normalized);
    }
  };

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={imgSrc}
      srcSet={imgSrcSet}
      sizes={imgSrcSet ? sizes || '100vw' : sizes}
      alt={alt}
      loading={priority ? 'eager' : loading ?? 'lazy'}
      fetchPriority={fetchPriority ?? (priority ? 'high' : undefined)}
      decoding="async"
      referrerPolicy="no-referrer"
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      {...imgRest}
      onError={handleError}
      className={fill ? `absolute inset-0 h-full w-full ${className ?? ''}` : className}
    />
  );
}
