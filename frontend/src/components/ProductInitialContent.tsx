import { buildProductSeoDescription, getProductImages, getProductPrice } from '@/lib/productSeo';

export default function ProductInitialContent({ product, storeName, baseUrl }: { product: any; storeName: string; baseUrl: string }) {
  const inStock = Number(product.stock) > 0;
  return <main className="mx-auto max-w-6xl px-5 py-8" aria-label="Ficha del producto">
    <p className="mb-5 text-sm text-gray-600">{storeName}</p>
    <div className="grid gap-8 md:grid-cols-2">
      <img src={getProductImages(product, baseUrl)[0]} alt={product.title} width={700} height={700} className="aspect-square w-full object-contain" fetchPriority="high" />
      <div><h1 className="text-3xl font-bold">{product.title}</h1>
        <p className="mt-5 text-2xl font-bold">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(getProductPrice(product))}</p>
        <p className={`my-4 font-medium ${inStock ? 'text-emerald-700' : 'text-gray-600'}`}>{inStock ? 'Disponible' : 'Agotado'}</p>
        <p className="leading-relaxed text-gray-700">{buildProductSeoDescription(product, storeName)}</p>
      </div>
    </div>
  </main>;
}
