'use client';

// ---------------------------------------------------------------------------
// Cloudinary browser upload/delete helpers
// ---------------------------------------------------------------------------
// Uploads go straight from the browser to Cloudinary using a short-lived
// signature minted by our server (/api/cloudinary/sign), so the API secret
// never touches the client and large file bytes never pass through our Next
// server (important on Render's limited tiers). Deletes are proxied through
// /api/cloudinary/delete, which is auth-gated server-side.

export type CloudinaryUploadResult = { url: string; publicId: string };

/**
 * Upload a single image File to Cloudinary and return its secure URL + public id.
 * `folder` is a short logical bucket name (e.g. "product-images", "support").
 */
export async function uploadToCloudinary(
  file: File,
  folder: string,
): Promise<CloudinaryUploadResult> {
  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  });
  if (!signRes.ok) {
    const msg = await signRes.text().catch(() => '');
    throw new Error(`Could not authorize upload (${signRes.status}). ${msg}`.trim());
  }
  const { signature, timestamp, apiKey, cloudName, folder: signedFolder } = await signRes.json();
  if (!apiKey || !cloudName) throw new Error('Cloudinary is not configured on the server.');

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  if (signedFolder) form.append('folder', signedFolder);

  const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!up.ok) {
    const t = await up.text().catch(() => '');
    throw new Error(`Cloudinary upload failed (${up.status}). ${t}`.trim());
  }
  const j = await up.json();
  if (!j.secure_url) throw new Error('Cloudinary did not return an image URL.');
  return { url: j.secure_url as string, publicId: j.public_id as string };
}

/**
 * Delete an image from Cloudinary by public id or by a Cloudinary delivery URL.
 * Best-effort: never throws (removal must not block the UI). Silently ignores
 * non-Cloudinary URLs.
 */
export async function deleteFromCloudinary(publicIdOrUrl: string): Promise<void> {
  if (!publicIdOrUrl) return;
  if (publicIdOrUrl.startsWith('http') && !publicIdOrUrl.includes('res.cloudinary.com')) return;
  try {
    await fetch('/api/cloudinary/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: publicIdOrUrl }),
    });
  } catch {
    // best effort — an orphaned asset is harmless
  }
}
