'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SafeImage } from '@/components/ui/safe-image';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Copy,
  Check,
  Database,
  Globe,
} from 'lucide-react';

/* ================= TYPES ================= */

type SeoProduct = {
  id: string;
  name: string | null;
  slug: string | null;
  sku: string | null;
  images: any;
  description: string | null;
  is_active: boolean | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  updated_at: string | null;
};

/* ================= CONSTANTS ================= */

const PAGE_SIZE = 20;
const TITLE_LIMIT = 60;
const DESC_LIMIT = 160;

const SETUP_SQL = `ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;`;

/* ================= HELPERS ================= */

function stripHtml(s: string) {
  return (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function firstImage(images: any): string | null {
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

const safeErrorMessage = (e: any) =>
  e?.message || e?.error_description || e?.details || e?.hint || 'Something went wrong. Please try again.';

function isMissingColumnError(e: any) {
  const msg = String(e?.message || e?.details || '').toLowerCase();
  return msg.includes('seo_') && (msg.includes('does not exist') || msg.includes('column') || msg.includes('schema cache'));
}

function Counter({ value, limit }: { value: string; limit: number }) {
  const len = value.length;
  const over = len > limit;
  return (
    <span className={`text-xs font-medium ${over ? 'text-amber-600' : 'text-gray-400'}`}>
      {len} / {limit}
      {over ? ' (too long)' : ''}
    </span>
  );
}

/* ================= GOOGLE PREVIEW ================= */

function GooglePreview({
  title,
  description,
  slug,
  origin,
}: {
  title: string;
  description: string;
  slug: string | null;
  origin: string;
}) {
  const host = origin.replace(/^https?:\/\//, '') || 'yourshop.com';
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5" /> Google search preview
      </div>
      <div className="text-xs text-green-700 truncate">
        https://{host} › products › {slug || 'product'}
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

/* ================= PAGE ================= */

export default function AdminSeoPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [products, setProducts] = useState<SeoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  // Editor dialog
  const [editing, setEditing] = useState<SeoProduct | null>(null);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [saving, setSaving] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    setOrigin(window.location.origin);
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('products')
        .select(
          'id,name,slug,sku,images,description,is_active,seo_title,seo_description,seo_keywords,updated_at',
          { count: 'exact' }
        )
        .order('updated_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (debouncedSearch) {
        const q = debouncedSearch.replace(/[%,()]/g, ' ').trim();
        if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,slug.ilike.%${q}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      if (!isMountedRef.current) return;

      setNeedsSetup(false);
      setProducts((data || []) as SeoProduct[]);
      setTotalCount(count || 0);
    } catch (e: any) {
      console.error(e);
      if (!isMountedRef.current) return;
      if (isMissingColumnError(e)) {
        setNeedsSetup(true);
        setProducts([]);
        setTotalCount(0);
      } else {
        toast({ title: 'Could not load products', description: safeErrorMessage(e), variant: 'destructive' });
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [page, debouncedSearch, toast]);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchProducts();
  }, [user, profile, fetchProducts, router]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const optimizedCount = useMemo(
    () => products.filter((p) => (p.seo_title || '').trim() || (p.seo_description || '').trim()).length,
    [products]
  );

  const openEditor = (p: SeoProduct) => {
    setEditing(p);
    setSeoTitle(p.seo_title || '');
    setSeoDescription(p.seo_description || '');
    setSeoKeywords(p.seo_keywords || '');
  };

  const autoFill = () => {
    if (!editing) return;
    if (!seoTitle.trim() && editing.name) setSeoTitle(editing.name.slice(0, TITLE_LIMIT + 20));
    if (!seoDescription.trim()) {
      const desc = stripHtml(String(editing.description || ''));
      setSeoDescription(
        (desc || `Buy ${editing.name || 'this product'} online at the best price in Bangladesh.`).slice(0, DESC_LIMIT + 20)
      );
    }
  };

  const saveSeo = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const payload = {
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        seo_keywords: seoKeywords.trim() || null,
      };
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) throw error;

      if (isMountedRef.current) {
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...payload } : p)));
        setEditing(null);
      }
      toast({
        title: 'SEO saved',
        description: `"${editing.name || 'Product'}" will appear in search engines with the new details shortly.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Save failed', description: safeErrorMessage(e), variant: 'destructive' });
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  const copySetupSql = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Please select and copy the text manually.', variant: 'destructive' });
    }
  };

  const effectiveTitle = (seoTitle.trim() || editing?.name || '').slice(0, 70);
  const effectiveDesc =
    seoDescription.trim() || stripHtml(String(editing?.description || '')).slice(0, DESC_LIMIT) || '';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <Header />

      <main className="w-full max-w-6xl mx-auto px-3 md:px-4 py-8 flex-1 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Search className="w-7 h-7 text-blue-900" />
              On-Page SEO
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Control how each product appears in Google and other search engines.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading} type="button">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/admin">
              <Button variant="outline" size="sm" type="button">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </Link>
          </div>
        </div>

        {/* One-time database setup banner */}
        {needsSetup && (
          <Card className="border-amber-300 bg-amber-50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-amber-900 flex items-center gap-2">
                <Database className="w-5 h-5" />
                One-time setup needed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-amber-900">
              <p>
                Your database needs three small SEO columns before this page can work. Copy the text below,
                then go to <Link href="/admin/sql-runner" className="font-semibold underline">Admin → SQL Runner</Link>,
                paste it in, and press Run. After that, come back here and press Refresh.
              </p>
              <pre className="bg-white border border-amber-200 rounded-lg p-3 text-xs overflow-x-auto text-gray-800">
{SETUP_SQL}
              </pre>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="bg-white" onClick={copySetupSql} type="button">
                  {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? 'Copied' : 'Copy setup SQL'}
                </Button>
                <Link href="/admin/sql-runner">
                  <Button size="sm" className="bg-blue-900 hover:bg-blue-800" type="button">
                    Open SQL Runner
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search + stats */}
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search products by name, SKU, or link…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge className="bg-green-50 text-green-700 border border-green-200">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {optimizedCount} optimized on this page
              </Badge>
              <Badge variant="outline">{totalCount} products total</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Product list */}
        <Card className="shadow-sm border-gray-200 overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b">
            <CardTitle className="text-base font-semibold text-gray-800">Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 bg-white rounded-md border animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 && !needsSetup ? (
              <div className="p-10 text-center text-gray-500">
                {debouncedSearch ? 'No products match your search.' : 'No products found.'}
              </div>
            ) : (
              <div className="divide-y">
                {products.map((p) => {
                  const img = firstImage(p.images);
                  const optimized = (p.seo_title || '').trim() || (p.seo_description || '').trim();
                  return (
                    <div key={p.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                      <div className="w-14 h-14 rounded-lg border bg-white overflow-hidden flex-shrink-0 relative">
                        {img ? (
                          <SafeImage src={img} alt={p.name || 'Product'} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                            No img
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-gray-900 truncate">{p.name || 'Untitled product'}</div>
                          {optimized ? (
                            <Badge className="bg-green-50 text-green-700 border border-green-200">Optimized</Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Needs SEO
                            </Badge>
                          )}
                          {p.is_active === false && <Badge variant="outline">Hidden</Badge>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          /products/{p.slug || '—'} {p.sku ? ` • SKU: ${p.sku}` : ''}
                        </div>
                        {optimized ? (
                          <div className="text-xs text-gray-400 mt-0.5 truncate">
                            SEO title: {p.seo_title || '(auto)'} • Description:{' '}
                            {p.seo_description ? `${p.seo_description.slice(0, 60)}…` : '(auto)'}
                          </div>
                        ) : null}
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => openEditor(p)}
                        type="button"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit SEO
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t bg-gray-50/50">
              <div className="text-xs text-gray-500">
                Page {page + 1} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  type="button"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page >= totalPages - 1 || loading}
                  onClick={() => setPage((p) => p + 1)}
                  type="button"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        <p className="text-xs text-gray-400">
          Tip: search engines can take a few days to show your updated titles and descriptions after you save them.
        </p>
      </main>

      {/* ================= EDIT DIALOG ================= */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>SEO for “{editing?.name || 'Product'}”</DialogTitle>
            <DialogDescription>
              This text is shown in Google when people find this product. Leave a field empty to use the
              automatic text instead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <GooglePreview
              title={effectiveTitle}
              description={effectiveDesc}
              slug={editing?.slug || null}
              origin={origin}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="seo-title">Meta title</Label>
                <Counter value={seoTitle} limit={TITLE_LIMIT} />
              </div>
              <Input
                id="seo-title"
                placeholder={editing?.name || 'e.g. Men’s Cotton T-Shirt — Best Price in Bangladesh'}
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                maxLength={120}
              />
              <p className="text-xs text-gray-400">
                Up to {TITLE_LIMIT} characters is ideal. Include the product name and a keyword people search for.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="seo-description">Meta description</Label>
                <Counter value={seoDescription} limit={DESC_LIMIT} />
              </div>
              <Textarea
                id="seo-description"
                rows={3}
                placeholder="e.g. Shop soft, breathable cotton t-shirts for men in Bangladesh. Free delivery inside Dhaka, cash on delivery available."
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                maxLength={300}
              />
              <p className="text-xs text-gray-400">
                Up to {DESC_LIMIT} characters is ideal. Make it inviting — this is your ad text in search results.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-keywords">Keywords (optional)</Label>
              <Input
                id="seo-keywords"
                placeholder="e.g. cotton t-shirt, mens fashion, t-shirt price in bd"
                value={seoKeywords}
                onChange={(e) => setSeoKeywords(e.target.value)}
                maxLength={250}
              />
              <p className="text-xs text-gray-400">Separate keywords with commas.</p>
            </div>

            <Button variant="outline" size="sm" onClick={autoFill} type="button" className="w-full">
              <Wand2 className="w-4 h-4 mr-2" />
              Auto-fill empty fields from product info
            </Button>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving} type="button">
              Cancel
            </Button>
            <Button
              className="bg-blue-900 hover:bg-blue-800"
              onClick={saveSeo}
              disabled={saving}
              type="button"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save SEO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
