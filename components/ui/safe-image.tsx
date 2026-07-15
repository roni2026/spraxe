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

// ---------------------------------------------------------------------------
// Cloudinary Fetch delivery
// ---------------------------------------------------------------------------
// When NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is set, every remote http(s) image is
// delivered through Cloudinary's Fetch pipeline:
//
//   https://res.cloudinary.com/<cloud>/image/fetch/<transforms>/<original-url>
//
// Cloudinary pulls the original from Supabase once, converts it to the best
// modern format for the requesting browser (f_auto -> AVIF/WebP), compresses it
// intelligently (q_auto), only ever downscales (c_limit), and serves every
// subsequent request from its global CDN with a long immutable cache. We build a
// responsive srcSet so the browser downloads only the width it actually needs.
//
// This bypasses next/image entirely for remote images, so it is unaffected by
// the host image optimizer (which misbehaved on Render). If Cloudinary ever
// fails to load an image, we gracefully fall back to the original URL, so an
// image is never blank.
const CLOUDINARY_CLOUD = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '').trim();
const CLOUDINARY_ENABLED = CLOUDINARY_CLOUD.length > 0;

// Widths offered to the browser via srcSet. Kept to a small, well-spread set so
// the browser can still pick a size close to what it needs (thumbnail → hero)
// without bloating the HTML with a dozen long URLs per image.
const CLOUDINARY_WIDTHS = [96, 256, 512, 828, 1280, 1920];

// A native Cloudinary delivery URL already hosted in our account, e.g.
// https://res.cloudinary.com/<cloud>/image/upload/v123/spraxe/...
function isCloudinaryUploadUrl(src: string): boolean {
  try {
    const u = new URL(src);
    return u.hostname === 'res.cloudinary.com' && u.pathname.includes('/image/upload/');
  } catch {
    return false;
  }
}

function buildCloudinaryUrl(originalUrl: string, width?: number): string {
  const transforms = ['f_auto', 'q_auto', 'c_limit'];
  if (width && Number.isFinite(width)) transforms.push(`w_${Math.round(width)}`);
  const t = transforms.join(',');

  // Images already uploaded to Cloudinary: inject the transformation segment
  // right after `/image/upload/` (native delivery, no fetch round-trip).
  if (isCloudinaryUploadUrl(originalUrl)) {
    return originalUrl.replace('/image/upload/', `/image/upload/${t}/`);
  }

  // Any other remote URL (non-migrated, e.g. external blog cover): pull it in
  // and optimize it via Cloudinary Fetch.
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/${t}/${encodeURIComponent(originalUrl)}`;
}

function buildCloudinarySrcSet(originalUrl: string): string {
  return CLOUDINARY_WIDTHS.map((w) => `${buildCloudinaryUrl(originalUrl, w)} ${w}w`).join(', ');
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

  // When Cloudinary is enabled, deliver ALL remote images through it (bypassing
  // next/image), so optimization is consistent and independent of the host
  // optimizer. Local, data and blob images are never sent to Cloudinary.
  const useCloudinary = CLOUDINARY_ENABLED && isRemoteUrl(normalized) && !isData;

  // Route our own Supabase / allowlisted images through next/image so they get
  // automatically resized + compressed (AVIF/WebP). Other hosts (e.g. gstatic
  // hotlinks) still use the raw <img> proxy path below, since they aren't in
  // next.config's remotePatterns and can't be optimized safely.
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
    ...imgRest
  } = rest as any;

  // Route remote images through proxy to avoid hotlink blocks.
  // BUT: Skip proxy for Supabase URLs (our own storage, no hotlink blocks, and
  // proxying them can cause issues with large images or auth-required buckets).
  // Strategy:
  // - Cloudinary enabled + remote URL: deliver via Cloudinary Fetch (f_auto,
  //   q_auto, c_limit) with a responsive srcSet. Falls back to the original on error.
  // - Supabase URLs + data/blob: load directly (our own storage, fast, no hotlink blocks)
  // - All other remote URLs (gstatic, pexels, random CDNs): route through the
  //   server-side /api/image-proxy. Many hosts (esp. Google gstatic) block direct
  //   browser hotlinking even with no-referrer, but server-side fetch works fine.
  //   On proxy failure we fall back to a direct load.
  const initial = React.useMemo(() => {
    if (!normalized) return '';
    if (isData) return normalized;
    if (useCloudinary) return buildCloudinaryUrl(normalized, typeof width === 'number' ? width : undefined);
    if (isRemoteUrl(normalized)) {
      if (isSupabaseUrl(normalized)) return normalized;
      return toProxyUrl(normalized);
    }
    return normalized;
  }, [normalized, useCloudinary, isData, width]);

  const initialSrcSet = React.useMemo(() => {
    if (useCloudinary && !isData && isRemoteUrl(normalized)) return buildCloudinarySrcSet(normalized);
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

    // Fallback chain (one retry):
    // - If Cloudinary failed, drop it and load the original URL directly
    //   (Supabase) or via the proxy (other hosts). Never leaves the image blank.
    // - Otherwise: if a proxied URL failed, try the original; if the original
    //   failed, try the proxy.
    if (useCloudinary && (imgSrc.includes('res.cloudinary.com') || imgSrcSet)) {
      setImgSrcSet(undefined);
      // If the source is already a Cloudinary upload URL, the un-transformed
      // original is guaranteed valid. Supabase URLs load directly; anything
      // else goes through our proxy.
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
      sizes={imgSrcSet ? (sizes ?? '100vw') : sizes}
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
