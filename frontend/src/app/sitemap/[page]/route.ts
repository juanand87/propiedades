import { NextResponse } from 'next/server';
import buildSeoSitemap from '@/lib/buildSeoSitemap';
import { sitemapXml, SITEMAP_PAGE_SIZE } from '@/lib/sitemapXml';

export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!/^[1-9]\d*\.xml$/.test(page)) return new NextResponse('Sitemap no encontrado', { status: 404 });
  const number = Number(page.slice(0, -4));
  if (!Number.isSafeInteger(number)) return new NextResponse('Sitemap no encontrado', { status: 404 });
  try {
    const entries = await buildSeoSitemap();
    const chunk = entries.slice((number - 1) * SITEMAP_PAGE_SIZE, number * SITEMAP_PAGE_SIZE);
    if (!chunk.length) return new NextResponse('Sitemap no encontrado', { status: 404 });
    return new NextResponse(sitemapXml(chunk), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch { return new NextResponse('Catálogo temporalmente no disponible', { status: 503, headers: { 'Retry-After': '300' } }); }
}
