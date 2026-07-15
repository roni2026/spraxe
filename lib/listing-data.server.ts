// lib/listing-data.server.ts
//
// Shared, cached data helpers for the product listing pages (/products and
// /[categorySlug]). These pages read searchParams, so they render dynamically,
// but the underlying Supabase queries are the real cost. Wrapping them in
// unstable_cache means repeated requests (same filters/sort/page, and the
// invariant category + filter-option lookups) are served from the Next data
// cache instead of hitting the database every time.

import 'server-only';
import { unstable_cache } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';

export type PriceRangeKey =
  | 'all'
  | 'under-500'
  | '500-1000'
  | '1000-2000'
  | '2000-5000'
  | 'over-5000';

const PRICE_OPTIONS: Record<PriceRangeKey, { min?: number; max?: number }> = {
  all: {},
  'under-500': { max: 499.999 },
  '500-1000': { min: 500, max: 1000 },
  '1000-2000': { min: 1000, max: 2000 },
  '2000-5000': { min: 2000, max: 5000 },
  'over-5000': { min: 5000.001 },
};

export function priceKeyFromParam(v: string | undefined): PriceRangeKey {
  const k = v as PriceRangeKey;
  return k && k in PRICE_OPTIONS ? k : 'all';
}

function onlyCleanSearch(s: string) {
  return (s || '').trim().replace(/[%_]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
}

const PRODUCT_SELECT =
  'id,name,slug,category_id,description,sku,supplier_name,tags,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex';

/** All active categories (sidebar + parent/child resolution). Invariant across
 *  requests, so cached with a longer window. */
export const getListingCategories = unstable_cache(
  async (): Promise<any[]> => {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from('categories')
      .select('id,name,slug,parent_id,image_url,sort_order,is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    return (data || []) as any[];
  },
  ['listing-categories-v1'],
  { revalidate: 300, tags: ['categories'] }
);

/** Supplier + tag filter options (global). Invariant across requests. */
export const getProductFilterOptions = unstable_cache(
  async (): Promise<{ supplierOptions: string[]; tagOptions: string[] }> => {
    const supabase = createServerSupabase();
    const rpcRes = await supabase.rpc('get_product_filter_options');
    let supplierOptions: string[] = [];
    let tagOptions: string[] = [];
    if (!rpcRes.error && Array.isArray(rpcRes.data) && rpcRes.data.length > 0) {
      const row: any = rpcRes.data[0];
      supplierOptions = Array.isArray(row?.suppliers) ? row.suppliers.filter(Boolean) : [];
      tagOptions = Array.isArray(row?.tags) ? row.tags.filter(Boolean) : [];
    }
    return { supplierOptions, tagOptions };
  },
  ['product-filter-options-v1'],
  { revalidate: 300, tags: ['filter-options'] }
);

export type FilteredProductsOptions = {
  categoryIds?: string[] | null;
  search?: string;
  price?: PriceRangeKey;
  sort?: string;
  inStockOnly?: boolean;
  featuredOnly?: boolean;
  suppliers?: string[];
  tags?: string[];
  page?: number;
  perPage?: number;
};

/** Paginated, filtered product list. Cached keyed by the full options object
 *  (unstable_cache folds the argument into the cache key), so repeat views of
 *  the same category/filter/sort/page combination skip the database. */
export const getFilteredProducts = unstable_cache(
  async (opts: FilteredProductsOptions): Promise<{ products: any[]; count: number }> => {
    const supabase = createServerSupabase();
    const {
      categoryIds = null,
      search = '',
      price = 'all',
      sort = 'newest',
      inStockOnly = false,
      featuredOnly = false,
      suppliers = [],
      tags = [],
      page = 1,
      perPage = 12,
    } = opts || {};

    const safePage = Math.max(1, page);
    const from = (safePage - 1) * perPage;
    const to = from + perPage - 1;
    const cleanSearch = onlyCleanSearch(search);
    const priceRange = PRICE_OPTIONS[price] || {};

    let query = supabase
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .eq('is_active', true)
      .is('color_name', null)
      .eq('approval_status', 'approved');

    if (categoryIds && categoryIds.length) {
      query =
        categoryIds.length > 1
          ? query.in('category_id', categoryIds)
          : query.eq('category_id', categoryIds[0]);
    }
    if (cleanSearch) query = query.or(`name.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%`);
    if (inStockOnly) query = query.gt('stock_quantity', 0);
    if (featuredOnly) query = query.eq('is_featured', true);
    if (suppliers.length) query = query.in('supplier_name', suppliers);
    if (tags.length) query = query.contains('tags', tags as any);
    if (priceRange.min != null) query = query.gte('price', priceRange.min);
    if (priceRange.max != null) query = query.lte('price', priceRange.max);

    if (sort === 'newest') query = query.order('created_at', { ascending: false });
    if (sort === 'best-selling') query = query.order('total_sales', { ascending: false, nullsFirst: false });
    if (sort === 'price-asc') query = query.order('price', { ascending: true });
    if (sort === 'price-desc') query = query.order('price', { ascending: false });
    if (sort === 'name-asc') query = query.order('name', { ascending: true });
    if (sort === 'name-desc') query = query.order('name', { ascending: false });

    query = query.range(from, to);
    const { data: products, count } = await query;
    return { products: (products || []) as any[], count: count || 0 };
  },
  ['listing-products-v1'],
  { revalidate: 60, tags: ['products'] }
);
