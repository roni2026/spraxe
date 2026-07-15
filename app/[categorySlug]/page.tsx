import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ProductsPageClient from '@/components/products/products-page-client';
import { getSiteUrl } from '@/lib/supabase/server';
import {
  getListingCategories,
  getProductFilterOptions,
  getFilteredProducts,
  priceKeyFromParam,
} from '@/lib/listing-data.server';

// Cache category listings briefly for speed while still staying fresh.
export const revalidate = 60;

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

export async function generateMetadata({ params }: { params: { categorySlug: string } }): Promise<Metadata> {
  const site = getSiteUrl();
  try {
    // Reuse the cached category list instead of a dedicated per-request query.
    const categories = await getListingCategories();
    const data = categories.find((c) => c.slug === params.categorySlug);

    const title = data?.name ? String(data.name) : 'Products';
    const canonical = `/${encodeURIComponent(data?.slug || params.categorySlug)}`;
    const image = (data as any)?.image_url || `${site}/og.png`;
    const description = data?.name
      ? `Browse ${data.name} on Spraxe Bangladesh. Fast delivery, warranty support, and secure checkout.`
      : 'Browse products on Spraxe Bangladesh. Fast delivery and warranty support.';

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: `${site}${canonical}`,
        images: [{ url: image }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    };
  } catch {
    // If Supabase is not configured, still return stable metadata.
    const canonical = `/${encodeURIComponent(params.categorySlug)}`;
    return {
      title: 'Products',
      description: 'Browse products on Spraxe Bangladesh.',
      alternates: { canonical },
      openGraph: {
        title: 'Products',
        description: 'Browse products on Spraxe Bangladesh.',
        url: `${site}${canonical}`,
        images: [{ url: `${site}/og.png` }],
      },
      robots: { index: true, follow: true },
    };
  }
}

function buildCategoryChain(categories: any[], current: any) {
  const chain: any[] = [];
  let cur = current;
  let guard = 0;
  while (cur && guard < 10) {
    guard++;
    chain.unshift(cur);
    if (!cur.parent_id) break;
    cur = categories.find((c) => c.id === cur.parent_id);
  }
  return chain;
}

export default async function CategoryProductsPage({
  params,
  searchParams,
}: {
  params: { categorySlug: string };
  searchParams: SearchParams;
}) {
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

    const currentCategory = categories.find((c) => c.slug === params.categorySlug);
    if (!currentCategory) return notFound();

    const site = getSiteUrl();
    const chain = buildCategoryChain(categories, currentCategory);
    const breadcrumbLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
        { '@type': 'ListItem', position: 2, name: 'Products', item: `${site}/products` },
        ...chain.map((c, idx) => ({
          '@type': 'ListItem',
          position: 3 + idx,
          name: c.name,
          item: c.slug ? `${site}/${encodeURIComponent(c.slug)}` : `${site}/products`,
        })),
      ],
    };

    const collectionLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: currentCategory.name,
      url: `${site}/${encodeURIComponent(currentCategory.slug)}`,
      isPartOf: { '@type': 'WebSite', name: 'Spraxe Bangladesh', url: site },
    };

    const getCategoryIdsForFilter = (catId: string): string[] => {
      const current = categories.find((c) => c.id === catId);
      if (!current) return [catId];
      if (!current.parent_id) {
        const children = categories.filter((c) => c.parent_id === current.id).map((c) => c.id);
        return children.length ? [current.id, ...children] : [current.id];
      }
      return [current.id];
    };

    const categoryIds = getCategoryIdsForFilter(currentCategory.id);

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
      <>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
        />
        <Suspense fallback={null}>
          <ProductsPageClient
            initialProducts={products as any}
            initialTotalProducts={count}
            initialCategories={categories as any}
            initialSupplierOptions={supplierOptions}
            initialTagOptions={tagOptions}
            forcedCategoryId={currentCategory.id}
          />
        </Suspense>
      </>
    );
  } catch (e) {
    console.error('[category] server render failed', e);
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
