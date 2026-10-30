import { headers } from 'next/headers';
import { MetadataRoute } from 'next';
import { fetchSeoJson, fetchSeoProducts, SEO_API_URL as API_URL, SEO_SITE_URL as BASE_URL, storeSeoBase } from '@/lib/seoCatalog';
import { getProductImages } from '@/lib/productSeo';

async function fetchJson(url: string) {
  return fetchSeoJson(url.slice(API_URL.length));
}

function normalizeHost(host: string) {
  return host.split(':')[0].replace(/^www\./, '').toLowerCase();
}

function isMarketplaceHost(host: string) {
  const hostname = normalizeHost(host);
  return !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'mundobeat.cl' ||
    hostname.includes('vercel.app');
}

async function getRequestContext() {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '';
  const protocol = requestHeaders.get('x-forwarded-proto') || 'https';
  const hostname = normalizeHost(host);

  if (isMarketplaceHost(host)) {
    return { type: 'marketplace' as const, baseUrl: BASE_URL, vendor: null as any };
  }

  if (hostname.endsWith('.mundobeat.cl')) {
    const slug = hostname.replace('.mundobeat.cl', '');
    const vendor = await fetchJson(`
      ${API_URL}/vendors/slug/${encodeURIComponent(slug)}
    `.replace(/\s+/g, ''));

    if (vendor?.id) {
      return { type: 'store' as const, baseUrl: storeSeoBase(vendor, vendor.slug || slug), vendor };
    }
  }

  const vendor = await fetchJson(`
    ${API_URL}/vendors/domain/${encodeURIComponent(hostname)}
  `.replace(/\s+/g, ''));

  if (vendor?.id) {
    return { type: 'store' as const, baseUrl: storeSeoBase(vendor, vendor.slug), vendor };
  }

  throw new Error('Unknown store domain');
}

function toList(data: any) {
  return Array.isArray(data) ? data : data?.products || data?.categories || data?.vendors || data?.data || [];
}

function productPath(product: any) {
  const productSlug = product.slug || product.id;
  return productSlug ? `/productos/${encodeURIComponent(productSlug)}` : null;
}

function pagePath(page: any) {
  if (!page?.slug || page.isHomepage) return null;
  return `/pagina/${page.slug}`;
}

async function addPublicPages(urls: MetadataRoute.Sitemap, baseUrl: string, vendorSlug: string, priority = 0.55) {
  const pages = toList(await fetchJson(`${API_URL}/pages/public/${encodeURIComponent(vendorSlug)}/all`));
  for (const page of pages) {
    const path = pagePath(page);
    if (!path) continue;
    urls.push({
      url: `${baseUrl}${path}`,
      lastModified: page.updatedAt ? new Date(page.updatedAt) : undefined,
      changeFrequency: 'monthly',
      priority,
    });
  }
}

async function addMarketplaceUrls(urls: MetadataRoute.Sitemap, baseUrl: string) {
  urls.push(
    { url: baseUrl, lastModified: undefined, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/productos`, lastModified: undefined, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/catalogo`, lastModified: undefined, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/politicas-de-cambios-y-devoluciones`, changeFrequency: 'monthly', priority: 0.5 },
  );

  const categories = toList(await fetchJson(`${API_URL}/categories`));
  for (const category of categories) {
    if (!category.slug) continue;
    urls.push({
      url: `${baseUrl}/categoria/${category.slug}`,
      lastModified: category.updatedAt ? new Date(category.updatedAt) : undefined,
      changeFrequency: 'weekly',
      priority: 0.75,
    });
  }


  const products = await fetchSeoProducts({ marketplaceOnly: 'true' });
  for (const product of products) {
    const path = productPath(product);
    if (!path) continue;
    urls.push({
      url: `${baseUrl}${path}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : undefined,
      changeFrequency: 'weekly',
      priority: 0.7,
      images: getProductImages(product, baseUrl),
    });
  }

  await addPublicPages(urls, baseUrl, 'marketplace');
}

async function addStoreUrls(urls: MetadataRoute.Sitemap, baseUrl: string, vendor: any) {
  urls.push(
    { url: baseUrl, lastModified: vendor.updatedAt ? new Date(vendor.updatedAt) : undefined, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/productos`, lastModified: undefined, changeFrequency: 'daily', priority: 0.9 },
  );

  const categories = toList(await fetchJson(`${API_URL}/vendors/${vendor.id}/categories`));
  for (const category of categories) {
    if (!category.slug) continue;
    urls.push({
      url: `${baseUrl}/categoria/${category.slug}`,
      lastModified: category.updatedAt ? new Date(category.updatedAt) : undefined,
      changeFrequency: 'weekly',
      priority: 0.75,
    });
  }

  const products = await fetchSeoProducts({ vendorId: vendor.id });
  for (const product of products) {
    const path = productPath(product);
    if (!path) continue;
    urls.push({
      url: `${baseUrl}${path}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
      images: getProductImages(product, baseUrl),
    });
  }

  await addPublicPages(urls, baseUrl, vendor.slug, 0.6);
}

export default async function buildSeoSitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];
  const context = await getRequestContext();

  if (context.type === 'store' && context.vendor?.id) {
    await addStoreUrls(urls, context.baseUrl, context.vendor);
  } else {
    await addMarketplaceUrls(urls, context.baseUrl);
  }

  return urls;
}
