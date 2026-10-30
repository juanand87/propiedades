import type { Metadata } from 'next';
import { ReactNode } from 'react';
import {
  buildPageWebPageJsonLd,
  getPageDescription,
  getPageTitle,
} from '@/lib/pageSeo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BASE_URL = getSiteUrl();

type Props = {
  params: Promise<{ slug: string; pageSlug: string }>;
  children: ReactNode;
};

async function fetchJson(url: string) {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchPage(vendorSlug: string, pageSlug: string) {
  return fetchJson(`${API_URL}/pages/public/${encodeURIComponent(vendorSlug)}/${encodeURIComponent(pageSlug)}`);
}

async function fetchVendor(slug: string) {
  return fetchJson(`${API_URL}/vendors/slug/${encodeURIComponent(slug)}`);
}

function getStoreBaseUrl(vendor: any, slug: string) {
  if (vendor?.customDomain && vendor?.customDomainVerified) {
    const domain = String(vendor.customDomain).replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${domain}`;
  }
  return `${BASE_URL}/tiendas/${slug}`;
}

function getPageUrl(page: any, vendor: any, slug: string, fallback: string) {
  const pageSlug = page?.slug || fallback;
  return `${getStoreBaseUrl(vendor, slug)}/pagina/${pageSlug}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const [page, vendor] = await Promise.all([fetchPage(slug, pageSlug), fetchVendor(slug)]);

  const storeName = vendor?.storeName || slug || 'MundoBeat';

  if (!page) {
    return {
      title: `Pagina no encontrada | ${storeName}`,
      robots: { index: false, follow: true },
    };
  }

  const url = getPageUrl(page, vendor, slug, pageSlug);
  const title = getPageTitle(page, storeName);
  const description = getPageDescription(page, storeName);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: storeName,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function StorePageLayout({ children, params }: Props) {
  const { slug, pageSlug } = await params;
  const [page, vendor] = await Promise.all([fetchPage(slug, pageSlug), fetchVendor(slug)]);

  if (!page) return <>{children}</>;

  const storeName = vendor?.storeName || slug || 'MundoBeat';
  const url = getPageUrl(page, vendor, slug, pageSlug);
  const description = getPageDescription(page, storeName);
  const jsonLd = buildPageWebPageJsonLd(page, {
    url,
    storeName,
    description,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
import { getSiteUrl } from '@/lib/siteUrl';
