import { Metadata } from 'next';
import {
  buildProductBreadcrumbJsonLd,
  buildProductJsonLd,
  buildProductSeoDescription,
  buildProductSeoTitle,
  getProductImages,
  getProductSlug,
  serializeProductJsonLd,
} from '@/lib/productSeo';

import { fetchSeoProduct as fetchProduct, fetchSeoVendor as fetchVendor, storeSeoBase, isPublicProduct, SEO_SITE_URL as BASE_URL } from '@/lib/seoCatalog';

function getProductUrl(product: any, vendor: any, slug: string, fallback: string) {
  const productSlug = getProductSlug(product, fallback);
  return `${storeSeoBase(vendor, slug)}/productos/${productSlug}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;

  const [product, vendor] = await Promise.all([
    fetchProduct(id),
    fetchVendor(slug),
  ]);

  if (!isPublicProduct(product) || !vendor || vendor.isActive === false || (product.vendorId || product.vendor?.id) !== vendor.id) {
    return {
      title: 'Producto no encontrado | MundoBeat',
      robots: { index: false, follow: true },
    };
  }

  const storeName = vendor?.storeName || slug;
  const productUrl = getProductUrl(product, vendor, slug, id);
  const images = getProductImages(product, BASE_URL);
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
      type: 'website',
      images: [{ url: images[0], width: 800, height: 800, alt: product.title }],
      siteName: storeName,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [images[0]],
    },
  };
}

export default async function ProductDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const [product, vendor] = await Promise.all([fetchProduct(id), fetchVendor(slug)]);

  if (!isPublicProduct(product) || !vendor || vendor.isActive === false || (product.vendorId || product.vendor?.id) !== vendor.id) return <>{children}</>;

  const storeName = vendor?.storeName || slug;
  const productUrl = getProductUrl(product, vendor, slug, id);
  const images = getProductImages(product, BASE_URL);
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
