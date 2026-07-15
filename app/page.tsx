import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import HomePageClient from '@/components/home/home-page-client';
import { createServerSupabase } from '@/lib/supabase/server';
import { isBuildTime } from '@/lib/isBuildTime';

// Prevent streaming issues on Render — render fully server-side
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata: Metadata = {
  title: 'Spraxe — Shop Online in Bangladesh',
  description:
    'Shop quality products at great prices with fast delivery across Bangladesh.',
  alternates: { canonical: '/' },
};

const TARGET_CATEGORIES = [
  "Women\u2019s Fashion",
  "Man\u2019s Fashion",
  "Laptop & Computer Accessories",
  "Gadgets",
  "Headphone",
  "Watches",
  "CCTV Camera",
  "Home Appliances",
  "Home Electronics",
  "Home Decor & Textile",
];

type HomeData = {
  featuredProducts: any[];
  newArrivals: any[];
  categories: any[];
  featuredImages: any[];
  bestSellers: any[];
  soldMap: Record<string, number>;
  homeMidBanner: any;
};

const EMPTY_HOME_DATA: HomeData = {
  featuredProducts: [],
  newArrivals: [],
  categories: [],
  featuredImages: [],
  bestSellers: [],
  soldMap: {},
  homeMidBanner: null,
};

/**
 * Fetch all homepage data in one shot.
 *
 * Performance:
 * - Every independent query (products, categories, featured images, new
 *   arrivals, mid banner AND best sellers) runs in a single Promise.all so we
 *   pay one network round-trip window instead of several sequential ones.
 * - The whole result is memoized via unstable_cache with a short revalidate
 *   window, so repeated homepage requests are served from the Next data cache
 *   instead of hammering Supabase on every hit. Public catalog data tolerates a
 *   few minutes of staleness, and a transient failure throws (so it is never
 *   cached) and falls back to an empty render.
 */
const getHomeData = unstable_cache(
  async (): Promise<HomeData> => {
    const supabase = createServerSupabase();

    const [
      productsRes,
      categoriesRes,
      featuredRes,
      newArrivalsRes,
      bannerRes,
      soldRes,
    ] = await Promise.all([
      supabase
        .from('products')
        .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex')
        .eq('is_active', true)
        .is('color_name', null)
        .eq('is_featured', true)
        .limit(12),
      supabase
        .from('categories')
        .select('id,name,slug,parent_id,image_url,sort_order,is_active')
        .eq('is_active', true)
        .limit(200),
      supabase
        .from('featured_images')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('products')
        .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex,created_at')
        .eq('is_active', true)
        .is('color_name', null)
        .order('created_at', { ascending: false })
        .limit(16),
      supabase
        .from('site_settings')
        .select('key,value')
        .eq('key', 'home_mid_banner')
        .maybeSingle(),
      supabase.rpc('get_best_sellers', { limit_count: 12 }),
    ]);

    const featuredProducts = (productsRes.data || []) as any[];
    const allCategories = (categoriesRes.data || []) as any[];
    const featuredImages = (featuredRes.data || []) as any[];
    const newArrivals = (newArrivalsRes.data || []) as any[];
    const homeMidBanner = (bannerRes.data as any)?.value ?? null;

    const sortMap = new Map(TARGET_CATEGORIES.map((name, i) => [name.toLowerCase(), i]));
    const categories = allCategories
      .filter((cat) =>
        TARGET_CATEGORIES.some((t) => t.toLowerCase() === String(cat.name || '').toLowerCase())
      )
      .sort((a, b) => {
        const ia = sortMap.get(String(a.name || '').toLowerCase()) ?? 999;
        const ib = sortMap.get(String(b.name || '').toLowerCase()) ?? 999;
        return ia - ib;
      });

    let bestSellers: any[] = [];
    const soldMap: Record<string, number> = {};

    try {
      if (soldRes.error) {
        const fallback = await supabase
          .from('products')
          .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex')
          .eq('is_active', true)
          .is('color_name', null)
          .order('total_sales', { ascending: false })
          .limit(12);
        bestSellers = (fallback.data || []) as any[];
      } else {
        const rows = (soldRes.data || []) as Array<{ product_id: string; sold_qty: number }>;
        const topIds = rows.map((r) => {
          soldMap[r.product_id] = Number(r.sold_qty || 0);
          return r.product_id;
        });

        if (topIds.length) {
          const topProducts = await supabase
            .from('products')
            .select('id,name,slug,category_id,price,base_price,retail_price,images,stock_quantity,is_featured,total_sales,color_group_id,color_name,color_hex')
            .in('id', topIds)
            .eq('is_active', true)
            .is('color_name', null);

          const map = new Map((topProducts.data || []).map((p: any) => [p.id, p]));
          bestSellers = topIds.map((id) => map.get(id)).filter(Boolean) as any[];
        }
      }
    } catch {
      // best sellers failed — continue without them
    }

    return {
      featuredProducts,
      newArrivals,
      categories,
      featuredImages,
      bestSellers,
      soldMap,
      homeMidBanner,
    };
  },
  ['home-page-data-v1'],
  { revalidate: 300, tags: ['home'] }
);

export default async function HomePage() {
  let data: HomeData = EMPTY_HOME_DATA;

  if (!isBuildTime) {
    try {
      data = await getHomeData();
    } catch (err) {
      console.error('[home] render error:', err);
      data = EMPTY_HOME_DATA;
    }
  }

  return (
    <HomePageClient
      initialProducts={data.featuredProducts as any}
      initialNewArrivals={data.newArrivals as any}
      initialCategories={data.categories as any}
      initialFeaturedImages={data.featuredImages}
      initialBestSellers={data.bestSellers as any}
      initialBestSellerSoldMap={data.soldMap}
      initialHomeMidBanner={data.homeMidBanner}
    />
  );
}
