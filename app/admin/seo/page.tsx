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
import { Checkbox } from '@/components/ui/checkbox';
import { SafeImage } from '@/components/ui/safe-image';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
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
  Wand2,
  Copy,
  Check,
  Database,
  Globe,
  ExternalLink,
  Sparkles,
  Gauge,
  FileText,
} from 'lucide-react';
import {
  buildAutoTitle,
  buildAutoDescription,
  buildAutoKeywords,
  stripHtml,
  auditSeo,
  TITLE_MAX,
  DESC_MAX,
  type SeoAudit,
} from '@/lib/seo/audit';
import {
  SeoItem,
  StatusFilter,
  SortMode,
  PAGE_SIZE,
  SCAN_CHUNK,
  SCAN_MAX,
  SETUP_SQL,
  safeErrorMessage,
  isMissingColumnError,
  mapProduct,
  mapCategory,
  effectiveDescOf,
  auditOf,
  keyOf,
  Counter,
  ScoreBadge,
  StatCard,
  GooglePreview,
  AuditChecklist,
} from '@/components/admin/seo/shared';

export default function AdminSeoPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const [productItems, setProductItems] = useState<SeoItem[]>([]);
  const [categoryItems, setCategoryItems] = useState<SeoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsSetup, setProductsSetup] = useState(false);
  const [categoriesSetup, setCategoriesSetup] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('worst');
  const [page, setPage] = useState(0);
  const [origin, setOrigin] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedRobots, setCopiedRobots] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ running: boolean; done: number; total: number }>({
    running: false,
    done: 0,
    total: 0,
  });

  // Editor dialog
  const [editing, setEditing] = useState<SeoItem | null>(null);
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

  /* ---------- data loading ---------- */

  const loadAll = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      // 1) Categories — also used to enrich product keyword suggestions.
      let catMap: Record<string, string> = {};
      const catRes = await supabase
        .from('categories')
        .select('id,name,slug,image_url,is_active,sort_order,seo_title,seo_description,seo_keywords')
        .order('sort_order', { ascending: true })
        .limit(2000);

      if (catRes.error) {
        if (isMissingColumnError(catRes.error)) {
          const retry = await supabase
            .from('categories')
            .select('id,name,slug,image_url,is_active,sort_order')
            .order('sort_order', { ascending: true })
            .limit(2000);
          if (retry.error) throw retry.error;
          if (!isMountedRef.current) return;
          setCategoriesSetup(true);
          const rows = retry.data || [];
          catMap = Object.fromEntries(rows.map((c: any) => [c.id, c.name]));
          setCategoryItems(
            rows.map((c: any) => ({ ...mapCategory(c), seoTitle: null, seoDescription: null, seoKeywords: null }))
          );
        } else {
          throw catRes.error;
        }
      } else {
        if (!isMountedRef.current) return;
        setCategoriesSetup(false);
        const rows = catRes.data || [];
        catMap = Object.fromEntries(rows.map((c: any) => [c.id, c.name]));
        setCategoryItems(rows.map(mapCategory));
      }

      // 2) Products — full scan in chunks so stats, filters and bulk tools
      //    work across the whole catalog, not just one page.
      const all: any[] = [];
      let from = 0;
      let setupHit = false;
      while (all.length < SCAN_MAX) {
        const r = await supabase
          .from('products')
          .select(
            'id,name,slug,sku,images,description,is_active,seo_title,seo_description,seo_keywords,price,base_price,tags,category_id,updated_at'
          )
          .order('updated_at', { ascending: false })
          .range(from, from + SCAN_CHUNK - 1);

        if (r.error) {
          if (isMissingColumnError(r.error)) {
            setupHit = true;
            break;
          }
          throw r.error;
        }
        const rows = r.data || [];
        all.push(...rows);
        if (rows.length < SCAN_CHUNK) break;
        from += SCAN_CHUNK;
      }

      if (!isMountedRef.current) return;
      if (setupHit) {
        setProductsSetup(true);
        setProductItems([]);
      } else {
        setProductsSetup(false);
        setProductItems(all.map((p) => mapProduct(p, catMap)));
      }
    } catch (e: any) {
      console.error(e);
      if (isMountedRef.current) {
        toast({ title: 'Could not load SEO data', description: safeErrorMessage(e), variant: 'destructive' });
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/');
      return;
    }
    loadAll();
  }, [user, profile, loadAll, router]);

  /* ---------- derived data ---------- */

  const items = tab === 'products' ? productItems : categoryItems;

  const audits = useMemo(() => {
    const m = new Map<string, SeoAudit>();
    for (const it of items) m.set(it.id, auditOf(it));
    return m;
  }, [items]);

  const stats = useMemo(() => {
    let good = 0,
      needs = 0,
      poor = 0,
      missing = 0,
      sum = 0;
    for (const it of items) {
      const a = audits.get(it.id);
      if (!a) continue;
      sum += a.score;
      if (a.grade === 'good') good++;
      else if (a.grade === 'needs') needs++;
      else poor++;
      if (!(it.seoTitle || '').trim() && !(it.seoDescription || '').trim()) missing++;
    }
    return {
      total: items.length,
      avg: items.length ? Math.round(sum / items.length) : 0,
      good,
      needs,
      poor,
      missing,
    };
  }, [items, audits]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((it) => {
      if (q) {
        const hay = `${it.name} ${it.slug || ''} ${it.sub || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === 'all') return true;
      if (statusFilter === 'missing') {
        return !(it.seoTitle || '').trim() && !(it.seoDescription || '').trim();
      }
      return audits.get(it.id)?.grade === statusFilter;
    });
    const score = (it: SeoItem) => audits.get(it.id)?.score ?? 0;
    if (sortMode === 'worst') return [...list].sort((a, b) => score(a) - score(b));
    if (sortMode === 'best') return [...list].sort((a, b) => score(b) - score(a));
    return [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [items, search, statusFilter, sortMode, audits]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, sortMode, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  /* ---------- selection & bulk auto-fill ---------- */

  const allShownSelected = filtered.length > 0 && filtered.every((it) => selected.has(keyOf(it)));

  const toggleAllShown = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) filtered.forEach((it) => next.delete(keyOf(it)));
      else filtered.forEach((it) => next.add(keyOf(it)));
      return next;
    });
  };

  const toggleOne = (it: SeoItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = keyOf(it);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  /** Generate SEO text for every empty field of the given items — never overwrites existing text. */
  const bulkAutoFill = async (targets: SeoItem[]) => {
    if (bulk.running) return;
    const work = targets
      .map((it) => {
        const payload: Record<string, string> = {};
        if (!(it.seoTitle || '').trim()) payload.seo_title = buildAutoTitle({ name: it.name });
        if (!(it.seoDescription || '').trim())
          payload.seo_description = buildAutoDescription({
            name: it.name,
            description: it.sourceDesc,
            price: it.price,
          });
        if (!(it.seoKeywords || '').trim())
          payload.seo_keywords = buildAutoKeywords({
            name: it.name,
            categoryName: it.categoryName,
            tags: it.tags,
          });
        return Object.keys(payload).length ? { it, payload } : null;
      })
      .filter(Boolean) as Array<{ it: SeoItem; payload: Record<string, string> }>;

    if (!work.length) {
      toast({ title: 'Nothing to fill', description: 'Every item in this selection already has all SEO fields filled in.' });
      return;
    }

    setBulk({ running: true, done: 0, total: work.length });
    let ok = 0;
    let failed = 0;
    const updates: Record<string, Record<string, string>> = {};

    for (let i = 0; i < work.length; i++) {
      const { it, payload } = work[i];
      const { error } = await supabase
        .from(it.kind === 'product' ? 'products' : 'categories')
        .update(payload)
        .eq('id', it.id);
      if (error) failed++;
      else {
        ok++;
        updates[keyOf(it)] = payload;
      }
      setBulk({ running: true, done: i + 1, total: work.length });
    }

    const applyUpdates = (prev: SeoItem[]) =>
      prev.map((p) => {
        const u = updates[keyOf(p)];
        return u
          ? {
              ...p,
              seoTitle: u.seo_title ?? p.seoTitle,
              seoDescription: u.seo_description ?? p.seoDescription,
              seoKeywords: u.seo_keywords ?? p.seoKeywords,
            }
          : p;
      });
    setProductItems(applyUpdates);
    setCategoryItems(applyUpdates);

    setBulk({ running: false, done: 0, total: 0 });
    setSelected(new Set());
    toast({
      title: failed ? `Auto-fill finished with ${failed} problem${failed > 1 ? 's' : ''}` : 'Auto-fill complete',
      description: `Filled empty SEO fields on ${ok} item${ok === 1 ? '' : 's'}. Any text you had already written was left untouched.`,
      variant: failed ? 'destructive' : 'default',
    });
  };

  /* ---------- editor ---------- */

  const openEditor = (it: SeoItem) => {
    setEditing(it);
    setSeoTitle(it.seoTitle || '');
    setSeoDescription(it.seoDescription || '');
    setSeoKeywords(it.seoKeywords || '');
  };

  const autoFillEditor = () => {
    if (!editing) return;
    if (!seoTitle.trim()) setSeoTitle(buildAutoTitle({ name: editing.name }));
    if (!seoDescription.trim())
      setSeoDescription(
        buildAutoDescription({ name: editing.name, description: editing.sourceDesc, price: editing.price })
      );
    if (!seoKeywords.trim())
      setSeoKeywords(
        buildAutoKeywords({ name: editing.name, categoryName: editing.categoryName, tags: editing.tags })
      );
  };

  const editorAudit = useMemo<SeoAudit | null>(() => {
    if (!editing) return null;
    const fallbackDesc =
      editing.kind === 'product'
        ? stripHtml(String(editing.sourceDesc || '')).slice(0, DESC_MAX) || `Buy ${editing.name} at Spraxe Bangladesh.`
        : `Browse ${editing.name} on Spraxe Bangladesh. Fast delivery, warranty support, and secure checkout.`;
    return auditSeo({
      title: seoTitle.trim() || editing.name,
      description: seoDescription.trim() || fallbackDesc,
      keywords: seoKeywords,
      name: editing.name,
      hasImage: !!editing.image,
      hasCustomTitle: !!seoTitle.trim(),
      hasCustomDescription: !!seoDescription.trim(),
    });
  }, [editing, seoTitle, seoDescription, seoKeywords]);

  const saveSeo = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const payload = {
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        seo_keywords: seoKeywords.trim() || null,
      };
      const { error } = await supabase
        .from(editing.kind === 'product' ? 'products' : 'categories')
        .update(payload)
        .eq('id', editing.id);
      if (error) throw error;

      const apply = (prev: SeoItem[]) =>
        prev.map((p) =>
          p.id === editing.id && p.kind === editing.kind
            ? { ...p, seoTitle: payload.seo_title, seoDescription: payload.seo_description, seoKeywords: payload.seo_keywords }
            : p
        );
      setProductItems(apply);
      setCategoryItems(apply);
      setEditing(null);
      toast({
        title: 'SEO saved',
        description: `“${editing.name}” will appear in search engines with the new details shortly.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Save failed', description: safeErrorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /* ---------- copy helpers ---------- */

  const copyText = async (text: string, setFlag: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Please select and copy the text manually.', variant: 'destructive' });
    }
  };

  const robotsText = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /seller/\nDisallow: /dashboard/\nDisallow: /cart\nDisallow: /wishlist\nDisallow: /track-order\nDisallow: /login\nDisallow: /register\n\nSitemap: ${origin || 'https://your-domain.com'}/sitemap.xml`;

  const effectiveTitle = (seoTitle.trim() || editing?.name || '').slice(0, 70);
  const effectiveDesc = seoDescription.trim() || (editing ? effectiveDescOf(editing) : '');
  const previewCrumbs =
    editing?.kind === 'category' ? editing.slug || 'category' : `products › ${editing?.slug || 'product'}`;

  /* ---------- render ---------- */

  return (
    <TooltipProvider>
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
                Control how every product and category appears in Google, and fix weak listings in bulk.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadAll} disabled={loading || bulk.running} type="button">
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
          {(productsSetup || categoriesSetup) && (
            <Card className="border-amber-300 bg-amber-50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-amber-900 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  One-time setup needed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-amber-900">
                <p>
                  Your database is missing SEO columns for{' '}
                  {productsSetup && categoriesSetup
                    ? 'products and categories'
                    : productsSetup
                    ? 'products'
                    : 'categories'}
                  . Copy the text below, then go to{' '}
                  <Link href="/admin/sql-runner" className="font-semibold underline">
                    Admin → SQL Runner
                  </Link>
                  , paste it in, and press Run. After that, come back here and press Refresh.
                </p>
                <pre className="bg-white border border-amber-200 rounded-lg p-3 text-xs overflow-x-auto text-gray-800">
                  {SETUP_SQL}
                </pre>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white"
                    onClick={() => copyText(SETUP_SQL, setCopiedSql)}
                    type="button"
                  >
                    {copiedSql ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copiedSql ? 'Copied' : 'Copy setup SQL'}
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

          {/* Health summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard
              label="Average score"
              value={`${stats.avg}/100`}
              icon={<Gauge className="w-3.5 h-3.5" />}
              tone={stats.avg >= 80 ? 'green' : stats.avg >= 50 ? 'amber' : 'red'}
            />
            <StatCard label="Good" value={stats.good} icon={<CheckCircle2 className="w-3.5 h-3.5" />} tone="green" />
            <StatCard label="Needs work" value={stats.needs} icon={<Gauge className="w-3.5 h-3.5" />} tone="amber" />
            <StatCard label="Poor" value={stats.poor} icon={<Gauge className="w-3.5 h-3.5" />} tone="red" />
            <StatCard label="No custom SEO" value={stats.missing} icon={<Wand2 className="w-3.5 h-3.5" />} tone="gray" />
          </div>

          {/* Tabs */}
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as 'products' | 'categories');
              setSelected(new Set());
            }}
          >
            <TabsList>
              <TabsTrigger value="products">Products ({productItems.length})</TabsTrigger>
              <TabsTrigger value="categories">Categories ({categoryItems.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search + filter + sort + bulk */}
          <Card className="shadow-sm border-gray-200">
            <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder={tab === 'products' ? 'Search by name, SKU, or link…' : 'Search categories…'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All items</SelectItem>
                    <SelectItem value="good">Good (80+)</SelectItem>
                    <SelectItem value="needs">Needs work (50–79)</SelectItem>
                    <SelectItem value="poor">Poor (&lt;50)</SelectItem>
                    <SelectItem value="missing">No custom SEO</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worst">Worst score first</SelectItem>
                    <SelectItem value="best">Best score first</SelectItem>
                    <SelectItem value="recent">Recently updated</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={bulk.running || loading || filtered.length === 0}
                  onClick={() => bulkAutoFill(filtered)}
                >
                  {bulk.running ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-2" />
                  )}
                  {bulk.running ? `Filling ${bulk.done}/${bulk.total}…` : 'Auto-fill all shown'}
                </Button>
              </div>
            </CardContent>

            {/* Selection action bar */}
            {selected.size > 0 && (
              <div className="px-4 pb-4">
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                  <span className="text-sm font-medium text-blue-900">
                    {selected.size} item{selected.size === 1 ? '' : 's'} selected
                  </span>
                  <Button
                    size="sm"
                    className="bg-blue-900 hover:bg-blue-800"
                    type="button"
                    disabled={bulk.running}
                    onClick={() => bulkAutoFill(items.filter((it) => selected.has(keyOf(it))))}
                  >
                    {bulk.running ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    {bulk.running ? `Filling ${bulk.done}/${bulk.total}…` : 'Auto-fill empty fields'}
                  </Button>
                  <Button size="sm" variant="ghost" type="button" disabled={bulk.running} onClick={() => setSelected(new Set())}>
                    Clear selection
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Item list */}
          <Card className="shadow-sm border-gray-200 overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b py-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allShownSelected}
                  onCheckedChange={toggleAllShown}
                  aria-label="Select all shown"
                  disabled={filtered.length === 0}
                />
                <CardTitle className="text-base font-semibold text-gray-800">
                  {tab === 'products' ? 'Products' : 'Categories'}
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {filtered.length} shown · score out of 100 on the right
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 bg-white rounded-md border animate-pulse" />
                  ))}
                </div>
              ) : pageItems.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  {search || statusFilter !== 'all' ? 'Nothing matches your search or filter.' : 'Nothing found.'}
                </div>
              ) : (
                <div className="divide-y">
                  {pageItems.map((it) => {
                    const audit = audits.get(it.id);
                    const topIssue = audit?.checks.find((c) => c.status !== 'good');
                    const k = keyOf(it);
                    return (
                      <div key={k} className="p-4 flex items-center gap-3 hover:bg-gray-50">
                        <Checkbox
                          checked={selected.has(k)}
                          onCheckedChange={() => toggleOne(it)}
                          aria-label={`Select ${it.name}`}
                        />
                        <div className="w-14 h-14 rounded-lg border bg-white overflow-hidden flex-shrink-0 relative">
                          {it.image ? (
                            <SafeImage src={it.image} alt={it.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                              No img
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-medium text-gray-900 truncate">{it.name}</div>
                            {(it.seoTitle || '').trim() || (it.seoDescription || '').trim() ? (
                              <Badge className="bg-green-50 text-green-700 border border-green-200">Custom SEO</Badge>
                            ) : (
                              <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Automatic text</Badge>
                            )}
                            {it.isActive === false && <Badge variant="outline">Hidden</Badge>}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 truncate">
                            {it.publicPath}
                            {it.sub ? ` • SKU: ${it.sub}` : ''}
                          </div>
                          {topIssue && (
                            <div className="text-xs text-amber-600 mt-0.5 truncate">
                              {topIssue.label}: {topIssue.tip}
                            </div>
                          )}
                        </div>

                        {audit && <ScoreBadge audit={audit} />}

                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0 hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => openEditor(it)}
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
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    type="button"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    type="button"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Indexing & search engine tools */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-900" />
                Indexing &amp; search engine tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-500">
                Your sitemap and robots file are generated automatically and always up to date. Use these shortcuts to
                check them or tell search engines about your shop.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href={`${origin}/sitemap.xml`} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" type="button">
                    <FileText className="w-4 h-4 mr-2" /> View sitemap.xml
                  </Button>
                </a>
                <a href={`${origin}/robots.txt`} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" type="button">
                    <FileText className="w-4 h-4 mr-2" /> View robots.txt
                  </Button>
                </a>
                <Button variant="outline" size="sm" type="button" onClick={() => copyText(robotsText, setCopiedRobots)}>
                  {copiedRobots ? (
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 mr-2" />
                  )}
                  {copiedRobots ? 'Copied' : 'Copy robots.txt'}
                </Button>
                <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" type="button">
                    <ExternalLink className="w-4 h-4 mr-2" /> Google Search Console
                  </Button>
                </a>
                <a href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" type="button">
                    <ExternalLink className="w-4 h-4 mr-2" /> Bing Webmaster Tools
                  </Button>
                </a>
              </div>
              <p className="text-xs text-gray-400">
                Tip: in Google Search Console, add your sitemap address ({origin || 'https://your-domain.com'}
                /sitemap.xml) under “Sitemaps” so Google always finds your newest pages quickly.
              </p>
            </CardContent>
          </Card>

          <p className="text-xs text-gray-400">
            Tip: search engines can take a few days to show your updated titles and descriptions after you save them.
          </p>
        </main>

        {/* ================= EDIT DIALOG ================= */}
        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                SEO for “{editing?.name || (editing?.kind === 'category' ? 'Category' : 'Product')}”
              </DialogTitle>
              <DialogDescription>
                This text is shown in Google when people find this page. Leave a field empty to use the automatic text
                instead.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <GooglePreview
                title={effectiveTitle}
                description={effectiveDesc}
                crumbs={previewCrumbs}
                origin={origin}
              />

              {editorAudit && <AuditChecklist audit={editorAudit} />}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-title">Meta title</Label>
                  <Counter value={seoTitle} limit={TITLE_MAX} />
                </div>
                <Input
                  id="seo-title"
                  placeholder={editing?.name || 'e.g. Anker USB-C Hub — Price in Bangladesh'}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  maxLength={120}
                />
                <p className="text-xs text-gray-400">
                  Up to {TITLE_MAX} characters is ideal. Include the name and a phrase people search for.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-description">Meta description</Label>
                  <Counter value={seoDescription} limit={DESC_MAX} />
                </div>
                <Textarea
                  id="seo-description"
                  rows={3}
                  placeholder="e.g. Shop the Anker 7-in-1 USB-C hub in Bangladesh. Fast delivery inside Dhaka, warranty support and cash on delivery available."
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  maxLength={300}
                />
                <p className="text-xs text-gray-400">
                  Up to {DESC_MAX} characters is ideal. Make it inviting — this is your ad text in search results.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-keywords">Keywords (optional)</Label>
                <Input
                  id="seo-keywords"
                  placeholder="e.g. usb-c hub, macbook adapter, usb hub price in bd"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                  maxLength={250}
                />
                <p className="text-xs text-gray-400">Separate keywords with commas. 3–6 phrases is ideal.</p>
              </div>

              <Button variant="outline" size="sm" onClick={autoFillEditor} type="button" className="w-full">
                <Wand2 className="w-4 h-4 mr-2" />
                Auto-fill empty fields from {editing?.kind === 'category' ? 'category' : 'product'} info
              </Button>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <a
                href={`${origin}${editing?.publicPath || ''}`}
                target="_blank"
                rel="noreferrer"
                className="mr-auto"
              >
                <Button variant="ghost" size="sm" type="button">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View public page
                </Button>
              </a>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving} type="button">
                Cancel
              </Button>
              <Button className="bg-blue-900 hover:bg-blue-800" onClick={saveSeo} disabled={saving} type="button">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save SEO'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
