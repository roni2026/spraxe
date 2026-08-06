// lib/seo/audit.ts
//
// Shared, dependency-free on-page SEO helpers.
// Used by the admin SEO manager (/admin/seo) for scoring, live audits,
// and bulk auto-optimization. Pure functions — safe on client and server.

export const TITLE_MIN = 30;
export const TITLE_MAX = 60;
export const TITLE_HARD_MAX = 70;
export const DESC_MIN = 70;
export const DESC_MAX = 160;
export const DESC_HARD_MAX = 170;

export type SeoCheckStatus = 'good' | 'warn' | 'bad';

export type SeoCheck = {
  id: string;
  label: string;
  status: SeoCheckStatus;
  tip: string;
};

export type SeoAuditInput = {
  /** The effective title Google will see (override or fallback). */
  title: string;
  /** The effective description Google will see (override or fallback). */
  description: string;
  /** Comma-separated keywords or array. */
  keywords?: string | string[] | null;
  /** The item's own name — used to check the title contains it. */
  name?: string | null;
  /** Whether a shareable image exists (OG image / product photo). */
  hasImage?: boolean;
  /** Whether a custom SEO title override is set. */
  hasCustomTitle?: boolean;
  /** Whether a custom meta description override is set. */
  hasCustomDescription?: boolean;
};

export type SeoAudit = {
  score: number; // 0–100
  grade: 'good' | 'needs' | 'poor';
  checks: SeoCheck[];
};

export function stripHtml(s: string): string {
  return (s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Truncate at a word boundary so generated text never cuts mid-word. */
export function smartTruncate(s: string, max: number): string {
  const t = (s || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

function normalizeKeywords(keywords?: string | string[] | null): string[] {
  if (!keywords) return [];
  const arr = Array.isArray(keywords) ? keywords : keywords.split(',');
  return arr.map((k) => String(k).trim()).filter(Boolean);
}

/**
 * Score a page's on-page SEO from 0–100 and explain every point
 * so a non-technical admin knows exactly what to fix.
 */
export function auditSeo(input: SeoAuditInput): SeoAudit {
  const title = (input.title || '').trim();
  const description = (input.description || '').trim();
  const keywords = normalizeKeywords(input.keywords);
  const name = (input.name || '').trim();
  const checks: SeoCheck[] = [];

  // --- Title (25 pts) ---
  const tLen = title.length;
  let titleStatus: SeoCheckStatus = 'bad';
  let titleTip = 'Missing title — search engines will guess one.';
  if (tLen >= TITLE_MIN && tLen <= TITLE_MAX) {
    titleStatus = 'good';
    titleTip = `Great length (${tLen} characters).`;
  } else if (tLen > 0 && tLen <= TITLE_HARD_MAX) {
    titleStatus = 'warn';
    titleTip =
      tLen < TITLE_MIN
        ? `A bit short (${tLen}). Aim for ${TITLE_MIN}–${TITLE_MAX} characters.`
        : `Slightly long (${tLen}). Aim for ${TITLE_MIN}–${TITLE_MAX} characters.`;
  } else if (tLen > TITLE_HARD_MAX) {
    titleTip = `Too long (${tLen}) — Google will cut it off. Stay under ${TITLE_HARD_MAX}.`;
  }
  checks.push({ id: 'title-length', label: 'Title length', status: titleStatus, tip: titleTip });

  // --- Description (30 pts) ---
  const dLen = description.length;
  let descStatus: SeoCheckStatus = 'bad';
  let descTip = 'Missing description — Google will pick random text from the page.';
  if (dLen >= DESC_MIN && dLen <= DESC_MAX) {
    descStatus = 'good';
    descTip = `Great length (${dLen} characters).`;
  } else if (dLen >= 40 && dLen <= DESC_HARD_MAX) {
    descStatus = 'warn';
    descTip =
      dLen < DESC_MIN
        ? `A bit short (${dLen}). Aim for ${DESC_MIN}–${DESC_MAX} characters.`
        : `Slightly long (${dLen}). Aim for ${DESC_MIN}–${DESC_MAX} characters.`;
  } else if (dLen > 0) {
    descTip =
      dLen < 40
        ? `Too short (${dLen}) — write at least one full sentence.`
        : `Too long (${dLen}) — Google will cut it off. Stay under ${DESC_HARD_MAX}.`;
  }
  checks.push({ id: 'desc-length', label: 'Description length', status: descStatus, tip: descTip });

  // --- Name inside title (10 pts) ---
  const nameInTitle =
    !!name && title.toLowerCase().includes(name.toLowerCase().slice(0, Math.min(name.length, 24)));
  checks.push({
    id: 'name-in-title',
    label: 'Name appears in title',
    status: nameInTitle ? 'good' : 'warn',
    tip: nameInTitle
      ? 'The title clearly names this item.'
      : 'Include the exact item name in the title so shoppers recognize it.',
  });

  // --- Title & description differ (10 pts) ---
  const differ = !!title && !!description && !description.toLowerCase().startsWith(title.toLowerCase().slice(0, 30));
  checks.push({
    id: 'title-desc-differ',
    label: 'Description is not a copy of the title',
    status: differ ? 'good' : title && description ? 'warn' : 'bad',
    tip: differ
      ? 'Title and description say different things — good.'
      : 'Don’t repeat the title as the description; add inviting detail instead.',
  });

  // --- Keywords (10 pts) ---
  checks.push({
    id: 'keywords',
    label: 'Keywords set',
    status: keywords.length >= 3 ? 'good' : keywords.length > 0 ? 'warn' : 'warn',
    tip:
      keywords.length >= 3
        ? `${keywords.length} keywords set.`
        : keywords.length > 0
        ? 'Add a few more keywords (3–6 is ideal), separated by commas.'
        : 'Add 3–6 search phrases customers would type, separated by commas.',
  });

  // --- Image (15 pts) ---
  checks.push({
    id: 'image',
    label: 'Shareable image available',
    status: input.hasImage ? 'good' : 'bad',
    tip: input.hasImage
      ? 'An image will show when this page is shared or listed.'
      : 'No image found — add one so search results and social shares look right.',
  });

  // --- Custom overrides (10 pts) ---
  const overrides = (input.hasCustomTitle ? 1 : 0) + (input.hasCustomDescription ? 1 : 0);
  checks.push({
    id: 'overrides',
    label: 'Custom SEO text set',
    status: overrides === 2 ? 'good' : overrides === 1 ? 'warn' : 'warn',
    tip:
      overrides === 2
        ? 'Custom title and description are controlling the search listing.'
        : 'Using automatic text. Writing your own usually gets more clicks.',
  });

  const weights: Record<string, number> = {
    'title-length': 25,
    'desc-length': 30,
    'name-in-title': 10,
    'title-desc-differ': 5,
    keywords: 10,
    image: 15,
    overrides: 5,
  };
  const ratio: Record<SeoCheckStatus, number> = { good: 1, warn: 0.55, bad: 0 };
  const score = Math.round(
    checks.reduce((sum, c) => sum + (weights[c.id] || 0) * ratio[c.status], 0)
  );

  return {
    score,
    grade: score >= 80 ? 'good' : score >= 50 ? 'needs' : 'poor',
    checks,
  };
}

/* ============== Auto-generation helpers ============== */

export type AutoSeoSource = {
  name?: string | null;
  description?: string | null;
  price?: number | null;
  categoryName?: string | null;
  tags?: unknown;
};

/** Generate a search-friendly title, e.g. "Anker USB-C Hub — Price in Bangladesh". */
export function buildAutoTitle(src: AutoSeoSource): string {
  const name = (src.name || '').trim();
  if (!name) return '';
  const suffix = ' — Price in Bangladesh';
  return smartTruncate(name, TITLE_MAX - suffix.length) + suffix;
}

/** Generate an inviting meta description from whatever product info exists. */
export function buildAutoDescription(src: AutoSeoSource): string {
  const name = (src.name || '').trim();
  const cleanDesc = stripHtml(String(src.description || ''));
  const price = Number(src.price);
  const priceBit = Number.isFinite(price) && price > 0 ? ` Price ৳${price.toLocaleString('en-US')}.` : '';

  let base = cleanDesc;
  // If the product text is too thin to stand on its own, use a sales sentence.
  if (base.length < DESC_MIN) {
    const lead = `Buy ${name} online in Bangladesh at Spraxe.${priceBit}`;
    const tail = ' Fast delivery, warranty support and secure checkout.';
    base = cleanDesc ? `${lead} ${smartTruncate(cleanDesc, DESC_MAX - lead.length - tail.length)}${tail}` : `${lead}${tail}`;
  }
  if (base.length < DESC_MIN && priceBit && !base.includes('৳')) {
    base = `${base.replace(/\.?\s*$/, '.')}${priceBit}`;
  }
  return smartTruncate(base, DESC_MAX);
}

/** Build 4–6 comma-separated keywords from name, category and tags. */
export function buildAutoKeywords(src: AutoSeoSource): string {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (k: string) => {
    const key = k.trim().toLowerCase();
    if (key && key.length > 2 && !seen.has(key)) {
      seen.add(key);
      out.push(k.trim());
    }
  };

  const name = (src.name || '').trim();
  if (name) {
    push(name);
    push(`${smartTruncate(name, 40)} price in BD`);
  }
  if (src.categoryName) push(`${src.categoryName} Bangladesh`);
  if (Array.isArray(src.tags)) {
    for (const t of src.tags.slice(0, 3)) push(String(t));
  }
  push('buy online Bangladesh');

  return out.slice(0, 6).join(', ');
}
