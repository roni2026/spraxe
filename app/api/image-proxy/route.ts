import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

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

// On-disk cache for optimized outputs so we only run sharp once per
// (url,width,format). /tmp persists for the container lifetime on Render.
const CACHE_DIR = path.join(os.tmpdir(), 'spraxe-img-cache');
const IMMUTABLE = 'public, max-age=31536000, immutable';

function cacheKey(url: string, width: number, fmt: string, q: number) {
  return createHash('sha1').update(`${url}|${width}|${fmt}|${q}`).digest('hex') + '.' + fmt;
}

async function readCache(file: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
}

async function writeCache(file: string, buf: Buffer): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(file, buf);
  } catch {
    // Cache write is best-effort; ignore failures.
  }
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

  // Parse optimization params.
  let width = Number(req.nextUrl.searchParams.get('w'));
  if (!Number.isFinite(width) || width <= 0) width = 0;
  width = Math.min(Math.round(width), 2000);

  let quality = Number(req.nextUrl.searchParams.get('q'));
  if (!Number.isFinite(quality) || quality < 30 || quality > 95) quality = 68;

  const accept = req.headers.get('accept') || '';
  const wantsAvif = accept.includes('image/avif');
  const targetFmt = wantsAvif ? 'avif' : 'webp';

  // Serve from disk cache when possible (only for optimized/resizable requests).
  const key = width > 0 ? cacheKey(u.toString(), width, targetFmt, quality) : '';
  const cacheFile = key ? path.join(CACHE_DIR, key) : '';
  if (cacheFile) {
    const cached = await readCache(cacheFile);
    if (cached) {
      return new NextResponse(cached, {
        status: 200,
        headers: {
          'Content-Type': `image/${targetFmt}`,
          'Cache-Control': IMMUTABLE,
          'Vary': 'Accept',
          'X-Img-Cache': 'HIT',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  // Abort slow upstreams so the client-side fallback fires quickly.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const upstream = await fetch(u.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

    const contentType = (upstream.headers.get('content-type') || 'image/jpeg').toLowerCase();
    const inputBuffer = Buffer.from(await upstream.arrayBuffer());

    // Reject non-image responses (hotlink blockers often return HTML pages).
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 404 });
    }

    // Reject the tiny 1x1 tracking/placeholder GIF that some hosts return.
    if (inputBuffer.byteLength <= 64) {
      return NextResponse.json({ error: 'Expired or empty image' }, { status: 404 });
    }

    // Optimize when a target width is requested and the source is a resizable
    // raster. SVG/GIF are passed through untouched (animation / vector safety).
    const isSvg = contentType.includes('svg');
    const isGif = contentType.includes('gif');

    if (width > 0 && !isSvg && !isGif) {
      try {
        const pipeline = sharp(inputBuffer, { failOn: 'none' })
          .rotate() // respect EXIF orientation
          .resize({ width, withoutEnlargement: true });

        const outBuffer =
          targetFmt === 'avif'
            ? await pipeline.avif({ quality: Math.min(quality, 62), effort: 3 }).toBuffer()
            : await pipeline.webp({ quality }).toBuffer();

        if (cacheFile) void writeCache(cacheFile, outBuffer);

        return new NextResponse(outBuffer, {
          status: 200,
          headers: {
            'Content-Type': `image/${targetFmt}`,
            'Cache-Control': IMMUTABLE,
            'Vary': 'Accept',
            'X-Img-Cache': 'MISS',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch {
        // sharp failed — fall through and return the original bytes so images
        // are never blank (worst case: unoptimized, but visible).
      }
    }

    return new NextResponse(inputBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': IMMUTABLE,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
