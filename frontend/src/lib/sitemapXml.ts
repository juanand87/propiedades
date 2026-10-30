import type { MetadataRoute } from 'next';

export const SITEMAP_PAGE_SIZE = 10000;
function xml(value: unknown) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
}
export function sitemapXml(entries: MetadataRoute.Sitemap) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries.map(entry => {
    const date = entry.lastModified ? new Date(entry.lastModified) : null;
    return `<url><loc>${xml(entry.url)}</loc>${date && Number.isFinite(date.getTime()) ? `<lastmod>${date.toISOString()}</lastmod>` : ''}${(entry.images || []).map(image => `<image:image><image:loc>${xml(image)}</image:loc></image:image>`).join('')}</url>`;
  }).join('')}</urlset>`;
}
export function sitemapIndexXml(baseUrl: string, count: number) {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: Math.ceil(count / SITEMAP_PAGE_SIZE) }, (_, i) => `<sitemap><loc>${xml(baseUrl)}/sitemap/${i + 1}.xml</loc></sitemap>`).join('')}</sitemapindex>`;
}
