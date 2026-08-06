// components/admin/seo/shared.tsx
//
// Shared pieces for the admin SEO manager (/admin/seo):
// types, mappers, small display components. The scoring logic itself
// lives in @/lib/seo/audit.

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, XCircle, Globe, ListChecks } from 'lucide-react';
import { auditSeo, stripHtml, DESC_MAX, type SeoAudit } from '@/lib/seo/audit';

/* ================= TYPES ================= */

export type SeoItem = {
  id: string;
  kind: 'product' | 'category';
  name: string;
  slug: string | null;
  sub: string | null; // SKU for products
  image: string | null;
  sourceDesc: string | null; // raw product description used for auto-fill
  price: number | null;
  tags: unknown;
  categoryName: string | null;
  isActive: boolean | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  updatedAt: string | null;
  publicPath: string;
};

export type StatusFilter = 'all' | 'good' | 'needs' | 'poor' | 'missing';
export type SortMode = 'worst' | 'best' | 'recent';

/* ================= CONSTANTS ================= */

export const PAGE_SIZE = 20;
export const SCAN_CHUNK = 1000;
export const SCAN_MAX = 5000;

export const SETUP_SQL = `ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;`;

/* ================= HELPERS ================= */

export function firstImage(images: any): string | null {
  if (!images) return null;
  if (Array.isArray(images)) return images.find(Boolean) ?? null;
  if (typeof images === 'string') {
    const s = images.trim();
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.find(Boolean) ?? null;
      } catch {}
    }
    if (s.includes(',')) return s.split(',').map((x) => x.trim()).find(Boolean) ?? null;
    return s || null;
  }
  return null;
}

export const safeErrorMessage = (e: any) =>
  e?.message || e?.error_description || e?.details || e?.hint || 'Something went wrong. Please try again.';

export function isMissingColumnError(e: any) {
  const msg = String(e?.message || e?.details || '').toLowerCase();
  return msg.includes('seo_') && (msg.includes('does not exist') || msg.includes('column') || msg.includes('schema cache'));
}

export function mapProduct(p: any, catMap: Record<string, string>): SeoItem {
  return {
    id: p.id,
    kind: 'product',
    name: p.name || 'Untitled product',
    slug: p.slug || null,
    sub: p.sku || null,
    image: firstImage(p.images),
    sourceDesc: p.description || null,
    price: Number(p.price ?? p.base_price ?? 0) || null,
    tags: p.tags,
    categoryName: (p.category_id && catMap[p.category_id]) || null,
    isActive: p.is_active,
    seoTitle: p.seo_title || null,
    seoDescription: p.seo_description || null,
    seoKeywords: p.seo_keywords || null,
    updatedAt: p.updated_at || null,
    publicPath: `/products/${p.slug || ''}`,
  };
}

export function mapCategory(c: any): SeoItem {
  return {
    id: c.id,
    kind: 'category',
    name: c.name || 'Untitled category',
    slug: c.slug || null,
    sub: null,
    image: c.image_url || null,
    sourceDesc: null,
    price: null,
    tags: null,
    categoryName: c.name || null,
    isActive: c.is_active,
    seoTitle: c.seo_title || null,
    seoDescription: c.seo_description || null,
    seoKeywords: c.seo_keywords || null,
    updatedAt: null,
    publicPath: `/${c.slug || ''}`,
  };
}

/** Exactly what Google will show as the title (custom override or automatic). */
export function effectiveTitleOf(item: SeoItem): string {
  return (item.seoTitle || '').trim() || item.name;
}

/** Exactly what Google will show as the description (custom override or automatic). */
export function effectiveDescOf(item: SeoItem): string {
  const custom = (item.seoDescription || '').trim();
  if (custom) return custom;
  if (item.kind === 'product') {
    return stripHtml(String(item.sourceDesc || '')).slice(0, DESC_MAX) || `Buy ${item.name} at Spraxe Bangladesh.`;
  }
  return `Browse ${item.name} on Spraxe Bangladesh. Fast delivery, warranty support, and secure checkout.`;
}

export function auditOf(item: SeoItem): SeoAudit {
  return auditSeo({
    title: effectiveTitleOf(item),
    description: effectiveDescOf(item),
    keywords: item.seoKeywords,
    name: item.name,
    hasImage: !!item.image,
    hasCustomTitle: !!(item.seoTitle || '').trim(),
    hasCustomDescription: !!(item.seoDescription || '').trim(),
  });
}

export const keyOf = (it: SeoItem) => `${it.kind}:${it.id}`;

export function gradeLabel(grade: SeoAudit['grade']) {
  return grade === 'good' ? 'Good' : grade === 'needs' ? 'Needs work' : 'Poor';
}

/* ================= SMALL COMPONENTS ================= */

export function Counter({ value, limit }: { value: string; limit: number }) {
  const len = value.length;
  const over = len > limit;
  return (
    <span className={`text-xs font-medium ${over ? 'text-amber-600' : 'text-gray-400'}`}>
      {len} / {limit}
      {over ? ' (too long)' : ''}
    </span>
  );
}

function scoreBadgeClasses(grade: SeoAudit['grade']) {
  return grade === 'good'
    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
    : grade === 'needs'
    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
}

export function ScoreBadge({ audit }: { audit: SeoAudit }) {
  const problems = audit.checks.filter((c) => c.status !== 'good');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`flex-shrink-0 w-11 h-8 rounded-md border text-sm font-bold tabular-nums transition-colors ${scoreBadgeClasses(audit.grade)}`}
        >
          {audit.score}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <p className="font-semibold mb-1">
          SEO score {audit.score}/100 — {gradeLabel(audit.grade)}
        </p>
        {problems.length ? (
          <ul className="space-y-1 text-xs">
            {problems.slice(0, 3).map((c) => (
              <li key={c.id}>• {c.tip}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs">Everything looks great.</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: 'green' | 'amber' | 'red' | 'gray' | 'blue';
}) {
  const tones: Record<string, string> = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    gray: 'text-gray-500',
    blue: 'text-blue-900',
  };
  return (
    <Card className="shadow-sm border-gray-200">
      <CardContent className="p-4">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${tones[tone]}`}>
          {icon}
          {label}
        </div>
        <div className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export function GooglePreview({
  title,
  description,
  crumbs,
  origin,
}: {
  title: string;
  description: string;
  crumbs: string;
  origin: string;
}) {
  const host = origin.replace(/^https?:\/\//, '') || 'yourshop.com';
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5" /> Google search preview
      </div>
      <div className="text-xs text-green-700 truncate">
        https://{host} › {crumbs}
      </div>
      <div className="text-lg text-blue-800 leading-snug truncate mt-0.5">
        {title || 'Page title appears here'}
      </div>
      <div className="text-sm text-gray-600 mt-0.5 line-clamp-2">
        {description || 'Page description appears here. Write something that makes people want to click.'}
      </div>
    </div>
  );
}

export function AuditChecklist({ audit }: { audit: SeoAudit }) {
  const color =
    audit.grade === 'good' ? 'text-green-600' : audit.grade === 'needs' ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="rounded-xl border bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" /> Live SEO check
        </div>
        <span className={`text-sm font-bold tabular-nums ${color}`}>{audit.score}/100</span>
      </div>
      <Progress value={audit.score} className="h-2" />
      <ul className="space-y-1.5">
        {audit.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-xs">
            {c.status === 'good' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
            ) : c.status === 'warn' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
            )}
            <span className="text-gray-600">
              <span className="font-medium text-gray-800">{c.label}:</span> {c.tip}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
