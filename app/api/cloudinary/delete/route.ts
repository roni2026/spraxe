import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Turn a Cloudinary delivery URL into its public_id (no version, no extension).
// e.g. https://res.cloudinary.com/<c>/image/upload/v123/spraxe/foo/bar.jpg -> spraxe/foo/bar
function publicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'res.cloudinary.com') return null;
    const marker = '/upload/';
    const i = u.pathname.indexOf(marker);
    if (i === -1) return null;
    let rest = u.pathname.slice(i + marker.length); // v123/spraxe/foo/bar.jpg  (may include transforms)
    // Drop any leading transformation segment(s) and the version segment.
    const parts = rest.split('/');
    while (parts.length && /^v\d+$/.test(parts[0]) === false && parts[0].includes(',')) parts.shift(); // transforms
    if (parts.length && /^v\d+$/.test(parts[0])) parts.shift(); // version
    rest = parts.join('/');
    return rest.replace(/\.[a-zA-Z0-9]+$/, '');
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!apiKey || !apiSecret || !cloudName) {
    return NextResponse.json({ error: 'Cloudinary env vars missing.' }, { status: 500 });
  }

  try {
    const supabase = createServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const target = String(body.target || '');
  const publicId = target.startsWith('http') ? publicIdFromUrl(target) : target;
  if (!publicId) return NextResponse.json({ ok: false, skipped: 'not a cloudinary asset' });

  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');

  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: 'POST',
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: res.ok, result: json?.result ?? null, publicId });
}
