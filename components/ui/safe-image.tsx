'use client';

import * as React from 'react';
import Image, { type ImageProps } from 'next/image';
import {
  buildCloudinarySrcSet,
  buildCloudinaryUrl,
  isCloudinaryEnabled,
  isCloudinaryUploadUrl,
} from '@/lib/cloudinary/url';

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

// Responsive widths for srcSet. Small set keeps HTML light while still covering
// thumbnails → full-bleed product/hero images.
const CLOUDINARY_WIDTHS = [96, 256, 512, 828, 1280, 1920];

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
  // the raw <img> path. This keeps storefront images reliable on Render.
  preferNextImageForRemote = false,
  ...rest
}: SafeImageProps) {
  const normalized = React.useMemo(() => normalizeRemoteSrc(String(src ?? '')), [src]);

  const isLocal = normalized.startsWith('/');
  const isData = normalized.startsWith('data:') || normalized.startsWith('blob:');
  const useCloudinary = isCloudinaryEnabled() && isRemoteUrl(normalized) && !isData;

  const remoteOkForNextImage =
    !useCloudinary &&
    preferNextImageForRemote &&
    isRemoteUrl(normalized) &&
    isSafeForNextImageRemote(normalized);

  if (isLocal || remoteOkForNextImage) {
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
    quality,
    priority,
    placeholder,
    blurDataURL,
    loader,
    unoptimized,
    onLoadingComplete,
    onError,
    sizes,
    fetchPriority,
    decoding,
    ...imgRest
  } = rest as any;

  const initial = React.useMemo(() => {
    if (!normalized) return '';
    if (isData) return normalized;
    if (useCloudinary) {
      // Prefer an explicit width when provided; otherwise leave width out of the
      // base src and let srcSet + sizes pick the right derivative.
      return buildCloudinaryUrl(normalized, typeof width === 'number' ? width : undefined);
    }
    if (isRemoteUrl(normalized)) {
      if (isSupabaseUrl(normalized)) return normalized;
      return toProxyUrl(normalized);
    }
    return normalized;
  }, [normalized, useCloudinary, isData, width]);

  const initialSrcSet = React.useMemo(() => {
    if (useCloudinary && !isData && isRemoteUrl(normalized)) {
      return buildCloudinarySrcSet(normalized, CLOUDINARY_WIDTHS);
    }
    return undefined;
  }, [useCloudinary, isData, normalized]);

  const [imgSrc, setImgSrc] = React.useState<string>(initial);
  const [imgSrcSet, setImgSrcSet] = React.useState<string | undefined>(initialSrcSet);
  React.useEffect(() => {
    setImgSrc(initial);
    setImgSrcSet(initialSrcSet);
  }, [initial, initialSrcSet]);

  const didFallbackRef = React.useRef(false);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    try {
      onError?.(e);
    } catch {
      // ignore
    }

    if (!normalized) return;
    if (!isRemoteUrl(normalized)) return;
    if (didFallbackRef.current) return;
    didFallbackRef.current = true;

    if (useCloudinary && (imgSrc.includes('res.cloudinary.com') || imgSrcSet)) {
      setImgSrcSet(undefined);
      if (isCloudinaryUploadUrl(normalized)) setImgSrc(normalized);
      else setImgSrc(isSupabaseUrl(normalized) ? normalized : toProxyUrl(normalized));
      return;
    }

    const isProxied = imgSrc.startsWith('/api/image-proxy');
    setImgSrc(isProxied ? normalized : toProxyUrl(normalized));
  };

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={imgSrc}
      srcSet={imgSrcSet}
      sizes={imgSrcSet ? (sizes ?? (fill ? '100vw' : undefined)) : sizes}
      alt={alt}
      loading={priority ? 'eager' : loading ?? 'lazy'}
      decoding={decoding ?? 'async'}
      fetchPriority={priority ? 'high' : fetchPriority}
      referrerPolicy="no-referrer"
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      {...imgRest}
      onError={handleError}
      className={fill ? `absolute inset-0 h-full w-full ${className ?? ''}` : className}
    />
  );
}
