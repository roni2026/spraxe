# Ademi Project Memory

Updated: 2026-08-05T14:51:19.798Z
Project: spraxe-main
Project path: /Users/yeamin/Downloads/spraxe-main

## Purpose

This file preserves the working brief for Ademi runs. Use it to remember earlier user intent, requirements, and follow-up context when the chat message is short.

## Operating Rules

- Treat short user follow-ups as continuations of the same project brief.
- If previous context plus the current request is enough to act, build instead of asking the same clarification again.
- Keep this file current when the user changes the goal, product, audience, copy, design direction, or technical requirements.
- For example, if the user first asks for a landing page and later says "on Algeria", build a landing page about Algeria.

## Current Request

1. Fix Cloudinary upload failing with "could not authorize upload 401" (user no longer uses Supabase storage, only Cloudinary for images).
2. Add an on-page SEO option as a new tab in the admin panel to edit SEO for each individual inventory item, for better search engine listings. User said: no need to build and verify the website after fixing.

## Work Completed

### Fix 1: Cloudinary 401 "Could not authorize upload"
- Root cause: `/api/cloudinary/sign` and `/api/cloudinary/delete` called `supabase.auth.getUser()` with no token on a fresh server client (persistSession: false, no cookies), so it never saw the browser login session and ALWAYS returned 401. Cloudinary itself was never reached; Cloudinary env vars are fine.
- Fix follows the existing working pattern of `/api/place-order` (Bearer token):
  - `lib/cloudinary/client.ts`: added `getAuthHeader()` which reads the session access token from the browser supabase client and sends `Authorization: Bearer <token>` on sign + delete requests.
  - `app/api/cloudinary/sign/route.ts` and `app/api/cloudinary/delete/route.ts`: read the Bearer token from the request header and validate it explicitly via `supabase.auth.getUser(token)`.
- Note: Supabase is still used for login/database (that's required); only image storage moved to Cloudinary.

### Feature 2: On-Page SEO admin tab
- New migration `supabase/migrations/20260805090000_add_product_seo_fields.sql`: adds `seo_title`, `seo_description`, `seo_keywords` text columns to `products`.
- `lib/supabase/types.ts`: Product interface gained the three optional SEO fields.
- New page `app/admin/seo/page.tsx`: searchable/paginated product list (20/page), Optimized vs Needs SEO badges, Edit SEO dialog with live Google search preview, meta title (60-char guide), meta description (160-char guide), keywords, auto-fill-from-product helper. If the DB columns are missing it shows a one-time setup banner with copyable SQL pointing to Admin → SQL Runner. Saves directly to Supabase from the browser (admin RLS policy "Admins can manage all products" allows it).
- `app/admin/page.tsx`: added "On-Page SEO" quick-action link (Search icon) in the Catalog group.
- `app/products/[slug]/page.tsx`: ProductRow + select query include the SEO fields; `generateMetadata` now prefers seo_title/seo_description/seo_keywords and falls back to the previous auto-generated values.
- Product pages are cached with 300s revalidation, so SEO edits go live within ~5 minutes; search engines take days to reflect changes.

## Deployment Notes

- The SQL migration must be applied to the production database for the SEO tab to work (run it via Admin → SQL Runner or Supabase dashboard). The SEO page itself shows the SQL with a copy button if it's missing.
- No build/verification was run per user request; npm/node are at /usr/local/bin (not on default PATH in this shell).

## Conversation Context

[USER 2026-08-05T14:51:19.798Z]
check my project i cannot add any image to my site using cloudinary it is saying could not authorize upload 401. i am no longer using supabase only cloudinary. what is the problem fix it.

[USER follow-up]
i want on page seo option which will show as a new tab in admin panel. from where i can do seo for each individual item of inventory to make better listing accross search engines. no need to build and verify website after fixing.
