import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '0.0.0.0' || h === '127.0.0.1' || h === '::1') return true;
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
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 });
  }

  if (isPrivateHost(u.hostname)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Abort slow upstreams so the client-side fallback fires quickly instead of
  // hanging on a dead/expiring hotlink (e.g. gstatic thumbnails).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const upstream = await fetch(u.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': u.origin + '/',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const bodyBuffer = await upstream.arrayBuffer();

    // Reject non-image responses (hotlink blockers often return HTML pages).
    if (!contentType.toLowerCase().startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 404 });
    }

    // Reject the tiny 1x1 tracking/placeholder GIF that hosts like Google
    // gstatic return once a cached-thumbnail token has expired. Treating it as
    // a failure lets the component fall back / show its placeholder instead of
    // rendering an invisible pixel.
    if (bodyBuffer.byteLength <= 64) {
      return NextResponse.json({ error: 'Expired or empty image' }, { status: 404 });
    }

    return new NextResponse(bodyBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
