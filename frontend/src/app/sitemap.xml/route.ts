import { NextResponse } from 'next/server';
import buildSeoSitemap from '@/lib/buildSeoSitemap';
import { sitemapXml, sitemapIndexXml, SITEMAP_PAGE_SIZE } from '@/lib/sitemapXml';

export async function GET() {
  try {
    const entries = await buildSeoSitemap();
    const content = entries.length > SITEMAP_PAGE_SIZE ? sitemapIndexXml(entries[0].url.replace(/\/$/, ''), entries.length) : sitemapXml(entries);
    return new NextResponse(content, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch { return new NextResponse('Catálogo temporalmente no disponible', { status: 503, headers: { 'Retry-After': '300' } }); }
}
