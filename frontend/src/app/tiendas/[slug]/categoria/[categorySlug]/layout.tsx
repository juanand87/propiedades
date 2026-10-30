import type { Metadata } from "next";
import { ReactNode } from "react";
import { SEO_API_URL, storeSeoBase } from '@/lib/seoCatalog';
import { serializeProductJsonLd } from '@/lib/productSeo';
import {
  buildCategoryCollectionJsonLd,
  formatCategoryName,
  getStoreCategorySeo,
} from "@/lib/categorySeo";

const API_URL = SEO_API_URL;
const BASE_URL = getSiteUrl();

type Props = {
  params: Promise<{ slug: string; categorySlug: string }>;
  children: ReactNode;
};

function toList(data: any) {
  return Array.isArray(data) ? data : data?.categories || data?.data || [];
}

async function fetchJson(url: string) {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchVendor(slug: string) {
  return fetchJson(`${API_URL}/vendors/slug/${encodeURIComponent(slug)}`);
}

async function fetchCategory(vendorId: string, categorySlug: string) {
  const categories = toList(await fetchJson(`${API_URL}/vendors/${vendorId}/categories`));
  return categories.find((category: any) => category?.slug === categorySlug) || null;
}

function getStoreBaseUrl(vendor: any, slug: string) {
  if (vendor?.customDomain && vendor?.customDomainVerified) {
    const domain = String(vendor.customDomain).replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${domain}`;
  }
  return storeSeoBase(vendor, slug);
}

function getCategoryUrl(vendor: any, slug: string, categorySlug: string) {
  return `${getStoreBaseUrl(vendor, slug)}/categoria/${categorySlug}`;
}

function getImageUrl(vendor: any) {
  if (vendor?.logo) {
    return String(vendor.logo).startsWith("http")
      ? vendor.logo
      : `http://localhost:3001/${vendor.logo}`;
  }
  return `${BASE_URL}/og-default.jpg`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, categorySlug } = await params;
  const vendor = await fetchVendor(slug);
  const category = vendor?.id ? await fetchCategory(vendor.id, categorySlug) : null;
  const storeName = vendor?.storeName || slug || "MundoBeat";
  const finalSlug = category?.slug || categorySlug;
  const url = getCategoryUrl(vendor, slug, finalSlug);
  const seo = getStoreCategorySeo(category, categorySlug, storeName);
  const imageUrl = getImageUrl(vendor);

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: url },
    robots: { index: Boolean(vendor && category), follow: true },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${seo.name} en ${storeName}` }],
      type: "website",
      siteName: storeName,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [imageUrl],
    },
  };
}

export default async function CategoryLayout({ children, params }: Props) {
  const { slug, categorySlug } = await params;
  const vendor = await fetchVendor(slug);
  const category = vendor?.id ? await fetchCategory(vendor.id, categorySlug) : null;
  const storeName = vendor?.storeName || slug || "MundoBeat";
  const finalSlug = category?.slug || categorySlug;
  const url = getCategoryUrl(vendor, slug, finalSlug);
  const seo = getStoreCategorySeo(category, categorySlug, storeName);
  const jsonLd = buildCategoryCollectionJsonLd({
    name: `${formatCategoryName(seo.name)} en ${storeName}`,
    description: seo.description,
    url,
    storeName,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeProductJsonLd(jsonLd) }}
      />
      {children}
    </>
  );
}
import { getSiteUrl } from '@/lib/siteUrl';
