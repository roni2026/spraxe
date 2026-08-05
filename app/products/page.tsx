import type { Metadata } from 'next';
import { Suspense } from 'react';
import ProductsPageClient from '@/components/products/products-page-client';
import {
  getListingCategories,
  getProductFilterOptions,
  getFilteredProducts,
  priceKeyFromParam,
} from '@/lib/listing-data.server';

// Cache listings briefly for speed while still staying fresh.
// Public Supabase reads don't depend on user-specific cookies.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'All Products',
  description: 'Browse Spraxe products. Filter by category, price, supplier and tags.',
  alternates: { canonical: '/products' },
};

type SearchParams = Record<string, string | string[] | undefined>;

function safeInt(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function safeCsvList(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((x) => decodeURIComponent(x).trim())
    .filter(Boolean);
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const category = typeof searchParams.category === 'string' ? searchParams.category : undefined;
  const search = typeof searchParams.search === 'string' ? searchParams.search : '';
  const price = priceKeyFromParam(typeof searchParams.price === 'string' ? searchParams.price : undefined);
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'newest';
  const inStockOnly = searchParams.stock === '1';
  const featuredOnly = searchParams.featured === '1';
  const suppliers = safeCsvList(typeof searchParams.suppliers === 'string' ? searchParams.suppliers : undefined);
  const tags = safeCsvList(typeof searchParams.tags === 'string' ? searchParams.tags : undefined);
  const perPage = [12, 24, 48].includes(safeInt(typeof searchParams.per === 'string' ? searchParams.per : undefined, 12))
    ? safeInt(typeof searchParams.per === 'string' ? searchParams.per : undefined, 12)
    : 12;
  const page = safeInt(typeof searchParams.page === 'string' ? searchParams.page : undefined, 1);

  try {
    // Cached: categories are invariant across requests.
    const categories = await getListingCategories();

    const getCategoryIdsForFilter = (catId: string): string[] => {
      const current = categories.find((c) => c.id === catId);
      if (!current) return [catId];
      if (!current.parent_id) {
        const children = categories.filter((c) => c.parent_id === current.id).map((c) => c.id);
        return children.length ? [current.id, ...children] : [current.id];
      }
      return [current.id];
    };

    const categoryIds = category ? getCategoryIdsForFilter(category) : null;

    // Cached filter options + cached, filtered product page — fetched in parallel.
    const [{ supplierOptions, tagOptions }, { products, count }] = await Promise.all([
      getProductFilterOptions(),
      getFilteredProducts({
        categoryIds,
        search,
        price,
        sort,
        inStockOnly,
        featuredOnly,
        suppliers,
        tags,
        page,
        perPage,
      }),
    ]);

    return (
      <Suspense fallback={null}>
        <ProductsPageClient
          initialProducts={products as any}
          initialTotalProducts={count}
          initialCategories={categories as any}
          initialSupplierOptions={supplierOptions}
          initialTagOptions={tagOptions}
        />
      </Suspense>
    );
  } catch (e) {
    console.error('[products] server render failed', e);
    return (
      <Suspense fallback={null}>
        <ProductsPageClient
          initialProducts={[] as any}
          initialTotalProducts={0}
          initialCategories={[] as any}
          initialSupplierOptions={[]}
          initialTagOptions={[]}
        />
      </Suspense>
    );
  }
}
