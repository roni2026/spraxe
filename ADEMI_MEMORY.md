# Ademi Project Memory

Updated: 2026-08-05T18:30:00.000Z
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

Make the on page seo more advanced with useful functions which are absent.

## What Was Built (2026-08-05)

Upgraded the on-page SEO system (admin manager + actual search output):

- `lib/seo/audit.ts` — shared SEO engine: 0–100 scoring with per-check tips, smart word-boundary truncation, auto-generators for title ("Name — Price in Bangladesh"), description (uses price + delivery/warranty), and keywords. Unit-tested with Node (scores verified: 100/50/28 on good/mid/poor cases).
- `app/admin/seo/page.tsx` (rewritten) + `components/admin/seo/shared.tsx` — SEO manager now has: health summary cards, per-item score badges with issue tooltips, status filter + score sorting, search, checkboxes with bulk "auto-fill empty fields" (never overwrites), a Categories tab (same tools), editor with live SEO checklist + Google preview + view-public-page link, and an indexing tools card (sitemap.xml, robots.txt copy, Search Console / Bing links). Setup SQL banner now covers products + categories.
- `supabase/migrations/20260805120000_add_category_seo_fields.sql` — seo_title/seo_description/seo_keywords for categories. Not yet applied to the live DB; the admin page shows a setup banner with copyable SQL until it is run (same pattern as the earlier product SEO columns).
- `app/[categorySlug]/page.tsx` — category pages use the SEO overrides (separate tiny cached query so nothing breaks before the migration runs).
- `app/products/[slug]/page.tsx` — added Twitter card; Product JSON-LD enriched with url, category path, priceValidUntil, BD shipping (2–5 day transit), 7-day return policy (matches /returns page).
- `app/blog/[slug]/page.tsx` — added OG/Twitter (article) metadata + Article JSON-LD.
- `app/sitemap.ts` — published blog posts are now included.
- `app/faq/page.tsx` — converted to a server component with metadata + FAQPage JSON-LD.
- README gained an "On-Page SEO" section documenting the above.

## Environment Notes

- Node 24 is at /usr/local/bin/node; npm exists at /usr/local/lib/node_modules/npm but the npm registry is unreachable from this machine (blocked network), so `npm install`/`tsc`/`next build` could not be run. New pure-TS logic was tested directly with `node --experimental-strip-types`.

## Conversation Context

[USER 2026-08-05T16:52:59.844Z]
Make the on page seo more advanced with useful functions which are absent.
