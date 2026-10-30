import type { Metadata } from "next";
import { headers } from "next/headers";
import { ReactNode } from "react";
import {
  buildProductBreadcrumbJsonLd,
  buildProductJsonLd,
  buildProductSeoDescription,
  buildProductSeoTitle,
  getProductImages,
  getProductSlug,
  serializeProductJsonLd,
} from "@/lib/productSeo";

import { fetchSeoProduct as fetchProduct, isPublicProduct, SEO_SITE_URL as BASE_URL } from '@/lib/seoCatalog';

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

function isMarketplaceHost(host: string) {
  const hostname = host.split(':')[0].toLowerCase();
  return !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'mundobeat.cl' ||
    hostname === 'www.mundobeat.cl' ||
    hostname.includes('vercel.app');
}

async function getRequestBaseUrl() {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '';
  const protocol = requestHeaders.get('x-forwarded-proto') || 'https';

  if (!host || isMarketplaceHost(host)) return BASE_URL;
  return `${protocol}://${host}`;
}

function getStoreName(product: any, requestBaseUrl: string) {
  return requestBaseUrl === BASE_URL
    ? 'MundoBeat'
    : (product?.vendor?.storeName || product?.vendor?.name || 'MundoBeat');
}

function getProductUrl(product: any, fallback: string, requestBaseUrl: string) {
  return `${requestBaseUrl}/productos/${getProductSlug(product, fallback)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [product, requestBaseUrl] = await Promise.all([fetchProduct(id), getRequestBaseUrl()]);

  if (!isPublicProduct(product) || product.vendor?.settings?.publishInMarketplace === false) {
    return {
      title: "Producto no encontrado",
      robots: { index: false, follow: true },
    };
  }

  const storeName = getStoreName(product, requestBaseUrl);
  const productUrl = getProductUrl(product, id, requestBaseUrl);
  const images = getProductImages(product, requestBaseUrl);
  const title = buildProductSeoTitle(product, storeName);
  const description = buildProductSeoDescription(product, storeName);

  return {
    title,
    description,
    alternates: { canonical: productUrl },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: productUrl,
      type: "website",
      siteName: storeName,
      images: [{ url: images[0], width: 800, height: 800, alt: product.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [images[0]],
    },
  };
}

export default async function MarketplaceProductLayout({ children, params }: Props) {
  const { id } = await params;
  const [product, requestBaseUrl] = await Promise.all([fetchProduct(id), getRequestBaseUrl()]);

  if (!isPublicProduct(product) || product.vendor?.settings?.publishInMarketplace === false) return <>{children}</>;

  const storeName = getStoreName(product, requestBaseUrl);
  const productUrl = getProductUrl(product, id, requestBaseUrl);
  const images = getProductImages(product, requestBaseUrl);
  const jsonLd = buildProductJsonLd(product, {
    url: productUrl,
    images,
    storeName,
  });
  const breadcrumbJsonLd = buildProductBreadcrumbJsonLd(product, {
    baseUrl: productUrl.replace(/\/productos\/.*$/, ''),
    productUrl,
    storeName,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeProductJsonLd(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeProductJsonLd(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
