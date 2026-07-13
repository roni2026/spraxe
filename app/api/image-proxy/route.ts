import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// 30 days server revalidation (Next.js fetch cache) + 1 year browser cache
const REVALIDATE_SECONDS = 60 * 60 * 24 * 30;

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Obvious local/internal targets
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '0.0.0.0' || h === '127.0.0.1' || h === '::1') return true;

  // Block private IPv4 ranges if a literal IP is provided
  const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h);
  if (ipv4) {
    const parts = h.split('.').map((n) => Number(n));
    if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) {
    return new Response('Missing url', { status: 400 });
  }

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return new Response('Invalid url', { status: 400 });
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return new Response('Unsupported protocol', { status: 400 });
  }

  if (isPrivateHost(u.hostname)) {
    return new Response('Forbidden', { status: 403 });
  }

  // Fetch server-side to bypass hotlink blocks + mixed-content issues.
  // Next's fetch cache will store this response on disk in production.
  let upstream: Response;
  try {
    upstream = await fetch(u.toString(), {
      cache: 'force-cache',
      next: { revalidate: REVALIDATE_SECONDS },
      headers: {
        // Some hosts block unknown agents; a generic UA helps.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: u.origin + '/',
      },
    });
  } catch {
    return new Response('Upstream fetch failed', { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response('Not found', { status: 404 });
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg';

  // Get the body as an array buffer first to ensure we can return it reliably
  const bodyBuffer = await upstream.arrayBuffer();

  return new Response(bodyBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // Cache aggressively in the browser; server revalidates separately.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
