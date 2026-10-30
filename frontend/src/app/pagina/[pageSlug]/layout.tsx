import type { Metadata } from 'next';
import { ReactNode } from 'react';
import {
  buildPageWebPageJsonLd,
  getPageDescription,
  getPageTitle,
} from '@/lib/pageSeo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BASE_URL = getSiteUrl();
const MARKETPLACE_NAME = 'MundoBeat';

type Props = {
  params: Promise<{ pageSlug: string }>;
  children: ReactNode;
};

async function fetchPage(pageSlug: string) {
  try {
    const res = await fetch(`${API_URL}/pages/public/marketplace/${encodeURIComponent(pageSlug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function getPageUrl(page: any, fallback: string) {
  const slug = page?.slug || fallback;
  return `${BASE_URL}/pagina/${slug}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pageSlug } = await params;
  const page = await fetchPage(pageSlug);

  if (!page) {
    return {
      title: 'Pagina no encontrada | MundoBeat',
      robots: { index: false, follow: true },
    };
  }

  const url = getPageUrl(page, pageSlug);
  const title = getPageTitle(page, MARKETPLACE_NAME);
  const description = getPageDescription(page, MARKETPLACE_NAME);

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
      siteName: MARKETPLACE_NAME,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function MarketplacePageLayout({ children, params }: Props) {
  const { pageSlug } = await params;
  const page = await fetchPage(pageSlug);

  if (!page) return <>{children}</>;

  const url = getPageUrl(page, pageSlug);
  const description = getPageDescription(page, MARKETPLACE_NAME);
  const jsonLd = buildPageWebPageJsonLd(page, {
    url,
    storeName: MARKETPLACE_NAME,
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
