import type { Metadata } from "next";
import { ReactNode } from "react";
import {
  buildCategoryCollectionJsonLd,
  formatCategoryName,
  getMarketplaceCategorySeo,
} from "@/lib/categorySeo";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const BASE_URL = getSiteUrl();
const MARKETPLACE_NAME = "MundoBeat";

type Props = {
  params: Promise<{ categorySlug: string }>;
  children: ReactNode;
};

function toList(data: any) {
  return Array.isArray(data) ? data : data?.categories || data?.data || [];
}

async function fetchCategory(categorySlug: string) {
  try {
    const res = await fetch(`${API_URL}/categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const categories = toList(await res.json());
    return categories.find((category: any) => category?.slug === categorySlug) || null;
  } catch {
    return null;
  }
}

function getCategoryUrl(categorySlug: string) {
  return `${BASE_URL}/categoria/${categorySlug}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await fetchCategory(categorySlug);
  const url = getCategoryUrl(category?.slug || categorySlug);
  const seo = getMarketplaceCategorySeo(category, categorySlug);

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url,
      type: "website",
      siteName: MARKETPLACE_NAME,
      images: [{ url: `${BASE_URL}/og-default.jpg`, width: 1200, height: 630, alt: seo.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [`${BASE_URL}/og-default.jpg`],
    },
  };
}

export default async function CategoryLayout({ children, params }: Props) {
  const { categorySlug } = await params;
  const category = await fetchCategory(categorySlug);
  const slug = category?.slug || categorySlug;
  const url = getCategoryUrl(slug);
  const seo = getMarketplaceCategorySeo(category, categorySlug);
  const jsonLd = buildCategoryCollectionJsonLd({
    name: `${formatCategoryName(seo.name)} en Chile`,
    description: seo.description,
    url,
    storeName: MARKETPLACE_NAME,
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
