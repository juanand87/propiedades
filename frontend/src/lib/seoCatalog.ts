import 'server-only';
import { cache } from 'react';
import { getSiteUrl } from './siteUrl';

const configuredApi = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
export const SEO_API_URL = /^https?:\/\/[^/]+$/.test(configuredApi) ? `${configuredApi}/api` : configuredApi;
export const SEO_SITE_URL = getSiteUrl();

export const fetchSeoJson = cache(async (path: string) => {
  const response = await fetch(`${SEO_API_URL}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`SEO catalog unavailable (${response.status})`);
  return response.json();
});
export const fetchSeoProduct = cache((identifier: string) => fetchSeoJson(`/products/${encodeURIComponent(identifier)}`));
export const fetchSeoVendor = cache((slug: string) => fetchSeoJson(`/vendors/slug/${encodeURIComponent(slug)}`));

export function isPublicProduct(product: any) {
  return product?.status === 'active' && product?.vendor?.isActive !== false;
}
export function storeSeoBase(vendor: any, slug: string) {
  if (process.env.NEXT_PUBLIC_STORE_DOMAINS_ENABLED === 'true' && vendor?.customDomain && vendor.customDomainVerified) {
    const url = new URL(`https://${String(vendor.customDomain).replace(/^https?:\/\//, '').replace(/\/$/, '')}`);
    return url.origin;
  }
  return `${SEO_SITE_URL}/tiendas/${encodeURIComponent(slug)}`;
}

export async function fetchSeoProducts(filters: Record<string, string> = {}) {
  const products = new Map<string, any>();
  const limit = 500;
  const pages = new Set<string>();
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({ ...filters, includeOutOfStock: 'true', limit: String(limit), offset: String(offset), sortBy: 'oldest' });
    const response = await fetchSeoJson(`/products?${params}`);
    if (!response) throw new Error('SEO product catalog not found');
    const rows = Array.isArray(response) ? response : response.products || response.data || [];
    const signature = rows.map((product: any) => product.id).join(',');
    if (rows.length && pages.has(signature)) throw new Error('SEO catalog pagination did not advance');
    pages.add(signature);
    for (const product of rows) if (isPublicProduct(product)) products.set(product.id, product);
    offset += rows.length;
    const total = Number(response.total);
    if (!rows.length || (Number.isFinite(total) && offset >= total) || (!Number.isFinite(total) && rows.length < limit)) break;
  }
  return [...products.values()];
}
