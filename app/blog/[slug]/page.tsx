import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabasePublicRead, getSiteUrl } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SafeImage } from '@/components/ui/safe-image';
import { BlogContent } from '@/components/blog/blog-content';

// Fetch fresh posts so updates appear immediately.
export const revalidate = 0;

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  try {
    const supabase = createServerSupabasePublicRead();
    const { data } = await supabase
      .from('blogs')
      .select('title,excerpt,slug,cover_image_url,published_at,created_at')
      .eq('slug', params.slug)
      .eq('is_published', true)
      .maybeSingle();

    if (!data) {
      return {
        title: 'Blog Post',
        alternates: { canonical: `/blog/${params.slug}` },
      };
    }

    const description = data.excerpt || undefined;
    const image = data.cover_image_url || undefined;
    const published = data.published_at || data.created_at || undefined;

    return {
      title: data.title,
      description,
      alternates: { canonical: `/blog/${data.slug}` },
      openGraph: {
        title: data.title,
        description,
        type: 'article',
        images: image ? [{ url: image }] : undefined,
        publishedTime: published,
      },
      twitter: {
        card: 'summary_large_image',
        title: data.title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {
      title: 'Blog Post',
      alternates: { canonical: `/blog/${params.slug}` },
    };
  }
}

export default async function BlogPostPage({ params }: { params: Params }) {
  let data: any = null;
  let supabaseOk = true;
  try {
    const supabase = createServerSupabasePublicRead();
    const res = await supabase
      .from('blogs')
      .select('id,title,slug,excerpt,content,cover_image_url,published_at,created_at,updated_at')
      .eq('slug', params.slug)
      .eq('is_published', true)
      .maybeSingle();
    data = res.data;
  } catch {
    supabaseOk = false;
  }

  if (!supabaseOk) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
        <Header />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-10 max-w-4xl">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
              Blog database is not configured yet. Configure Supabase env vars to view posts.
            </div>
            <div className="mt-4">
              <Link href="/blog" className="text-sm font-semibold text-blue-900 hover:underline">
                ← Back to Blog
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!data) return notFound();

  const content = String(data.content || '');
  const date = data.published_at || data.created_at;

  // Article structured data so the post can appear in Google news/blog carousels.
  const site = getSiteUrl();
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.excerpt || undefined,
    image: data.cover_image_url ? [data.cover_image_url] : undefined,
    datePublished: date || undefined,
    dateModified: data.updated_at || date || undefined,
    mainEntityOfPage: `${site}/blog/${data.slug}`,
    author: { '@type': 'Organization', name: 'Spraxe Bangladesh', url: site },
    publisher: {
      '@type': 'Organization',
      name: 'Spraxe Bangladesh',
      url: site,
      logo: { '@type': 'ImageObject', url: `${site}/apple-touch-icon.png` },
    },
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-10 max-w-4xl">
          <div className="mb-6">
            <Link href="/blog" className="text-sm font-semibold text-blue-900 hover:underline">
              ← Back to Blog
            </Link>
          </div>

          <article className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            {data.cover_image_url ? (
              <div className="relative aspect-[16/9] bg-gray-100">
                <SafeImage
                  src={data.cover_image_url}
                  alt={data.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 800px"
                  className="object-cover"
                />
              </div>
            ) : null}

            <div className="p-6 md:p-10">
              <div className="text-xs text-gray-500 mb-3">
                {date ? new Date(date).toLocaleDateString() : null}
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
                {data.title}
              </h1>
              {data.excerpt ? <p className="text-gray-600 mt-3">{data.excerpt}</p> : null}

              <div className="mt-8">
                <BlogContent content={content} />
              </div>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
