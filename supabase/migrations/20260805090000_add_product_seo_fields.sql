-- On-page SEO fields for products, managed from the admin panel (/admin/seo).
-- When filled in, these override the auto-generated meta title / description /
-- keywords on each product page for better search engine listings.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text;
