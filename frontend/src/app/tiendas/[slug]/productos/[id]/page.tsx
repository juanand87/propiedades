import { notFound, permanentRedirect } from 'next/navigation';
import ProductClient from './ProductClient';
import ProductInitialContent from '@/components/ProductInitialContent';
import { fetchSeoProduct, fetchSeoVendor, isPublicProduct, storeSeoBase } from '@/lib/seoCatalog';
import { getInitialProductSummary } from '@/lib/productSeo';

export default async function StoreProductPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const [product, vendor] = await Promise.all([fetchSeoProduct(id), fetchSeoVendor(slug)]);
  if (!vendor || vendor.isActive === false || !isPublicProduct(product) || (product.vendorId || product.vendor?.id) !== vendor.id) notFound();
  const baseUrl = storeSeoBase(vendor, slug);
  if (product.slug && id !== product.slug) permanentRedirect(`${baseUrl}/productos/${encodeURIComponent(product.slug)}`);
  return <ProductClient params={params} initialContent={<ProductInitialContent product={getInitialProductSummary(product, vendor.storeName || slug, baseUrl)} storeName={vendor.storeName || slug} baseUrl={baseUrl} />} />;
}
