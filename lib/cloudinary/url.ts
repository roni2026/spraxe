// Shared Cloudinary delivery helpers (safe for client + server).
// Used by SafeImage and by gallery preloaders so we never re-download full originals.

const CLOUDINARY_CLOUD = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '').trim();

export function isCloudinaryEnabled(): boolean {
  return CLOUDINARY_CLOUD.length > 0;
}

export function isCloudinaryUploadUrl(src: string): boolean {
  try {
    const u = new URL(src);
    return u.hostname === 'res.cloudinary.com' && u.pathname.includes('/image/upload/');
  } catch {
    return false;
  }
}

/**
 * Build a delivery URL with f_auto/q_auto/c_limit (and optional width).
 * - Native upload URLs: inject transform after /image/upload/
 * - Other remote URLs: Cloudinary Fetch
 * - If Cloudinary is not configured: return the original URL unchanged
 */
export function buildCloudinaryUrl(originalUrl: string, width?: number): string {
  if (!originalUrl) return originalUrl;
  if (!CLOUDINARY_CLOUD) return originalUrl;

  const transforms = ['f_auto', 'q_auto', 'c_limit'];
  if (width && Number.isFinite(width)) transforms.push(`w_${Math.round(width)}`);
  const t = transforms.join(',');

  if (isCloudinaryUploadUrl(originalUrl)) {
    // Avoid double-injecting transforms if a caller already transformed the URL.
    if (/\/image\/upload\/[^/]*f_auto/.test(originalUrl)) {
      if (width && !/\/w_\d+/.test(originalUrl)) {
        return originalUrl.replace(/\/image\/upload\/([^/]+)\//, (m, existing) => {
          if (String(existing).includes(`w_${Math.round(width)}`)) return m;
          return `/image/upload/${existing},w_${Math.round(width)}/`;
        });
      }
      return originalUrl;
    }
    return originalUrl.replace('/image/upload/', `/image/upload/${t}/`);
  }

  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/${t}/${encodeURIComponent(originalUrl)}`;
}

export function buildCloudinarySrcSet(originalUrl: string, widths: number[]): string {
  return widths.map((w) => `${buildCloudinaryUrl(originalUrl, w)} ${w}w`).join(', ');
}

/** Decode-friendly preload for a list of image URLs (browser only). */
export function preloadImages(urls: string[], width = 828): void {
  if (typeof window === 'undefined') return;
  const seen = new Set<string>();
  for (const raw of urls) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    try {
      const img = new window.Image();
      img.decoding = 'async';
      img.src = buildCloudinaryUrl(raw, width);
    } catch {
      // ignore
    }
  }
}
