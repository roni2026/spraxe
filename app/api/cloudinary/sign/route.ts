import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Mint a short-lived signature so the browser can upload directly to Cloudinary.
// Gated to authenticated users (admins/sellers uploading catalog images, and
// customers attaching images to support tickets). The API secret stays server-side.
export async function POST(req: Request) {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!apiKey || !apiSecret || !cloudName) {
    return NextResponse.json(
      { error: 'Cloudinary env vars missing (CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET / NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME).' },
      { status: 500 },
    );
  }

  // Require a logged-in user.
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const raw = typeof body.folder === 'string' ? body.folder : 'uploads';
  const clean = raw.replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 60) || 'uploads';
  const folder = `spraxe/${clean}`;
  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signs the sorted, &-joined params (excluding file/api_key).
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');

  return NextResponse.json({ signature, timestamp, apiKey, cloudName, folder });
}
