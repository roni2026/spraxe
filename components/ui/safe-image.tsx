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
  preferNextImageForRemote = false,
  ...rest
}: SafeImageProps) {
  const normalized = React.useMemo(() => normalizeRemoteSrc(String(src ?? '')), [src]);

  const isLocal = normalized.startsWith('/');

  const remoteOkForNextImage =
    preferNextImageForRemote && isRemoteUrl(normalized) && isSafeForNextImageRemote(normalized);

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
    ...imgRest
  } = rest as any;

  // Route remote images through proxy to avoid hotlink blocks.
  // BUT: Skip proxy for Supabase URLs (our own storage, no hotlink blocks, and
  // proxying them can cause issues with large images or auth-required buckets).
  // Strategy:
  // - Supabase URLs + data/blob: load directly (our own storage, fast, no hotlink blocks)
  // - All other remote URLs (gstatic, pexels, random CDNs): route through the
  //   server-side /api/image-proxy. Many hosts (esp. Google gstatic) block direct
  //   browser hotlinking even with no-referrer, but server-side fetch works fine.
  //   On proxy failure we fall back to a direct load.
  const initial = React.useMemo(() => {
    if (!normalized) return '';
    if (normalized.startsWith('data:') || normalized.startsWith('blob:')) return normalized;
    if (isRemoteUrl(normalized)) {
      if (isSupabaseUrl(normalized)) return normalized;
      return toProxyUrl(normalized);
    }
    return normalized;
  }, [normalized]);

  const [imgSrc, setImgSrc] = React.useState<string>(initial);
  React.useEffect(() => {
    setImgSrc(initial);
  }, [initial]);

  const didProxyRef = React.useRef(false);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    try {
      onError?.(e);
    } catch {
      // ignore
    }

    if (!normalized) return;
    if (!isRemoteUrl(normalized)) return;

    // Fallback chain: if the proxied URL failed, try loading the original
    // directly; if a direct URL failed, try the proxy. Only one retry.
    if (!didProxyRef.current) {
      didProxyRef.current = true;
      const isProxied = imgSrc.startsWith('/api/image-proxy');
      setImgSrc(isProxied ? normalized : toProxyUrl(normalized));
    }
  };

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={imgSrc}
      alt={alt}
      loading={loading ?? 'lazy'}
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
