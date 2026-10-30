import { notFound, permanentRedirect } from 'next/navigation';
import ProductClient from './ProductClient';
import ProductInitialContent from '@/components/ProductInitialContent';
import { fetchSeoProduct, isPublicProduct, SEO_SITE_URL } from '@/lib/seoCatalog';
import { getInitialProductSummary } from '@/lib/productSeo';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await fetchSeoProduct(id);
  if (!isPublicProduct(product) || product.vendor?.settings?.publishInMarketplace === false) notFound();
  if (product.slug && id !== product.slug) permanentRedirect(`${SEO_SITE_URL}/productos/${encodeURIComponent(product.slug)}`);
  return <ProductClient params={params} initialContent={<ProductInitialContent product={getInitialProductSummary(product, 'MundoBeat', SEO_SITE_URL)} storeName="MundoBeat" baseUrl={SEO_SITE_URL} />} />;
}
