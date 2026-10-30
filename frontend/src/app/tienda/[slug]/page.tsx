'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, ShoppingCart, X } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { api } from '../../../lib/api';
import { useCart } from '@/contexts/CartContext';
import HeaderType1 from '@/components/headers/HeaderType1';
import HeaderType2 from '@/components/headers/HeaderType2';
import HeaderType3 from '@/components/headers/HeaderType3';
import StoreFooter from '@/components/StoreFooter';
import StoreHeaderBadge from '@/components/headers/StoreHeaderBadge';
import { applyThemeToDocument } from '@/lib/colorThemes';
import MusicPreloader from '@/components/MusicPreloader';
import '../../../app/globals.css';

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

interface Product {
  id: number;
  slug?: string;
  title: string;
  price: number;
  artist?: string;
  format?: string;
  genre?: string;
  condition?: string;
  year?: string | number;
  stock?: number;
  images?: any;
  imageUrl?: string;
  categoryName?: string;
  vendorId: string;
}

interface Store {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  banners?: Array<{
    id: number;
    imageUrl: string;
    linkUrl: string | null;
  }>;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  productCount: number;
}

export default function MarketplaceStorePage() {
  const params = useParams();
  const slug = params.slug as string;
  const { addItem } = useCart();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [marketplaceSettings, setMarketplaceSettings] = useState<any>(null);
  const [addingToCart, setAddingToCart] = useState<number | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewSelectedImage, setPreviewSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        setLoading(true);

        // Fetch marketplace settings for header - usar getVendorSettings en lugar de getVendor
        const settings = await api.getVendorSettings(MARKETPLACE_VENDOR_ID, false);
        setMarketplaceSettings(settings);

        // Apply marketplace theme
        if (settings?.colorTheme) {
          applyThemeToDocument(settings.colorTheme);
        }

        // Fetch store info
        const storeResponse = await api.getVendorBySlug(slug);
        setStore(storeResponse);

        // Fetch vendor categories (activas)
        const vendorCategories = await api.getVendorCategories(storeResponse.id, false);
        console.log('Vendor categories:', vendorCategories);
        
        // Convert to expected format with product counts
        const categoriesWithCounts = vendorCategories.map((cat: any, index: number) => ({
          id: index + 1,
          name: cat.name,
          slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
          productCount: 0 // Will be updated after loading products
        }));

        // Fetch products with proper structure
        const productsResponse = await api.getProducts({ 
          vendorId: storeResponse.id.toString(),
          marketplaceOnly: false 
        });
        
        console.log('Products response:', productsResponse);
        
        // Handle response - could be array or object with products property
        const productsArray = Array.isArray(productsResponse) 
          ? productsResponse 
          : (productsResponse.products || productsResponse.data || []);
        
        console.log('Products array:', productsArray);
        
        // Debug: log first product structure
        if (productsArray.length > 0) {
          console.log('First product structure:', {
            id: productsArray[0].id,
            title: productsArray[0].title,
            categoryName: productsArray[0].categoryName,
            category: productsArray[0].category,
            categories: productsArray[0].categories
          });
        }
        
        setProducts(productsArray);

        // Update category counts based on actual products
        categoriesWithCounts.forEach((category: any) => {
          const count = productsArray.filter((product: any) => {
            const productCategory = product.categoryName || 
                                   product.category?.name || 
                                   product.categories?.[0]?.name || 
                                   '';
            const matches = productCategory.toLowerCase() === category.name.toLowerCase();
            console.log('Category match check:', { 
              productId: product.id, 
              productCategory, 
              categoryName: category.name, 
              matches 
            });
            return matches;
          }).length;
          category.productCount = count;
        });

        // Only include categories with products
        const categoriesWithProducts = categoriesWithCounts.filter((cat: any) => cat.productCount > 0);
        console.log('Categories with products:', categoriesWithProducts);
        setCategories(categoriesWithProducts);
      } catch (error) {
        console.error('Error fetching store data:', error);
        setStore(null);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchStoreData();
    }
  }, [slug]);

  const handleAddToCart = async (product: Product) => {
    try {
      setAddingToCart(product.id);
      
      // Add item to cart using CartContext
      // Use store.id as vendorId (not product.vendorId which might be undefined)
      addItem({
        productId: product.id.toString(),
        title: product.title,
        price: product.price,
        imageUrl: getProductImage(product),
        vendorId: store?.id?.toString() || product.vendorId,
        vendorSlug: store?.slug || slug,
        stock: 999, // Default stock value
      }, false); // false = don't open cart drawer
      
      // Show success feedback
      setTimeout(() => setAddingToCart(null), 1000);
    } catch (error) {
      console.error('Error adding to cart:', error);
      setAddingToCart(null);
    }
  };

  const parseImages = (images: any): any[] => {
    if (!images) return [];
    if (typeof images === 'string') {
      try { return JSON.parse(images); } catch { return [images]; }
    }
    return Array.isArray(images) ? images : [images];
  };

  // Usar la URL directa. Las imágenes de DigitalOcean ya vienen desde CDN y no deben pasar por /_next/image.
  const getImageUrl = (url: string): string => {
    if (!url) return '/placeholder-product.png';
    if (url.startsWith('/')) return url; // local
    return url.replace(/^http:\/\//, 'https://');
  };

  const getProductImage = (product: Product): string => {
    // Parse images if it's a string
    let images = product.images;
    
    if (typeof product.images === 'string') {
      try {
        images = JSON.parse(product.images);
      } catch {
        // If parse fails, try split by comma
        const urls = (product.images as string).split(',').filter(Boolean);
        if (urls.length > 0) {
          return urls[0].trim();
        }
      }
    }
    
    if (Array.isArray(images) && images.length > 0) {
      const firstImage = images[0];
      return typeof firstImage === 'string' ? firstImage : firstImage.url;
    }
    
    if (product.imageUrl) {
      return product.imageUrl;
    }
    
    return '/placeholder-product.png';
  };

  const filteredProducts = products.filter(product => {
    // Get product category from various possible fields
    const productCategoryName = product.categoryName || 
                                (product as any).category?.name || 
                                (product as any).categories?.[0]?.name || 
                                '';
    
    const matchesCategory = selectedCategory === 'all' || 
                           productCategoryName.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const renderHeader = () => {
    if (!marketplaceSettings) return null;

    const vendor = {
      id: MARKETPLACE_VENDOR_ID,
      slug: "marketplace",
      storeName: marketplaceSettings?.storeName || "Marketplace",
      phone: marketplaceSettings?.phone || "",
      email: marketplaceSettings?.email || ""
    };

    const headerType = marketplaceSettings?.headerType 
      ? (typeof marketplaceSettings.headerType === 'number' ? `type${marketplaceSettings.headerType}` : marketplaceSettings.headerType)
      : "type1";

    switch (headerType) {
      case "type1":
        return <HeaderType1 vendor={vendor} config={marketplaceSettings || {}} slug="marketplace" />;
      case "type2":
        return <HeaderType2 vendor={vendor} config={marketplaceSettings || {}} slug="marketplace" />;
      case "type3":
        return <HeaderType3 vendor={vendor} config={marketplaceSettings || {}} slug="marketplace" />;
      default:
        return <HeaderType1 vendor={vendor} config={marketplaceSettings || {}} slug="marketplace" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white/80">
        <MusicPreloader title="Cargando Tienda" storeName={store?.name || (store as any)?.storeName || slug || "MundoBeat.cl"} />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tienda no encontrada</h1>
          <p className="text-gray-600 mb-4">La tienda que buscas no existe</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Volver al marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Marketplace Header */}
      {renderHeader()}

      {/* Store Banner */}
      {store.banners && store.banners.length > 0 && (
        <div className="relative w-full h-48 md:h-64 lg:h-80 bg-gray-100">
          <Image
            src={store.banners[0].imageUrl}
            alt={`Banner de ${store.name}`}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Store Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1300px] mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            {store.logo && (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                <Image
                  src={store.logo}
                  alt={store.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{store.name}</h1>
              <p className="text-gray-600 mt-1">{products.length} productos disponibles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1300px] mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-4">
              <div className="mb-6">
                <StoreHeaderBadge store={store} />
              </div>

              {/* Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar productos
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Categories */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Categorías</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Todos ({products.length})
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.name)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedCategory === category.name
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {category.name} ({category.productCount})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <main className="flex-1">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No se encontraron productos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="group bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
                  >
                    {/* Imagen + botones hover */}
                    <div className="relative aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
                      <div className="absolute inset-0">
                        <Link href={`/productos/${product.slug || product.id}`}>
                          <div className="absolute inset-0 cursor-pointer">
                            <img
                              src={getProductImage(product)}
                              alt={product.title}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        </Link>
                      </div>

                      {/* Desktop: botones en hover deslizándose desde abajo */}
                      <div className="hidden md:flex absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 gap-px">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewProduct(product); }}
                          className="flex-1 bg-gray-800/95 hover:bg-gray-900 text-white font-semibold py-2.5 transition-colors backdrop-blur-sm flex items-center justify-center gap-1.5 text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Vista Previa</span>
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(product); }}
                          disabled={addingToCart === product.id}
                          className="flex-1 text-white font-semibold py-2.5 transition-colors flex items-center justify-center gap-1.5 text-xs disabled:opacity-60"
                          style={{ backgroundColor: addingToCart === product.id ? '#10b981' : (marketplaceSettings?.colorTheme?.primaryColor || 'var(--color-primary, #3b82f6)') }}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>{addingToCart === product.id ? '✓ Agregado' : 'Agregar'}</span>
                        </button>
                      </div>

                      {/* Mobile: botón siempre visible en la parte inferior */}
                      <div className="md:hidden absolute bottom-0 left-0 right-0">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(product); }}
                          disabled={addingToCart === product.id}
                          className="w-full text-white font-medium py-2 transition-colors flex items-center justify-center gap-1 text-xs"
                          style={{ backgroundColor: addingToCart === product.id ? '#10b981' : (marketplaceSettings?.colorTheme?.primaryColor || 'var(--color-primary, #3b82f6)') }}
                        >
                          <ShoppingCart className="w-3 h-3" />
                          <span>{addingToCart === product.id ? '✓' : 'Agregar'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <Link href={`/productos/${product.slug || product.id}`}>
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1 hover:text-blue-600">
                          {product.title}
                        </h3>
                      </Link>
                      <p className="text-base font-bold text-gray-900">
                        {formatPrice(Number(product.price) || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Marketplace Footer */}
      {marketplaceSettings?.footerConfig && (
        <StoreFooter 
          footerConfig={marketplaceSettings.footerConfig}
        />
      )}

      {/* Modal de Vista Previa */}
      {previewProduct && (() => {
        const modalImages = parseImages(previewProduct.images);
        const primaryImgUrl = modalImages.find((img: any) => img?.isPrimary)?.url || modalImages[0]?.url || (typeof modalImages[0] === 'string' ? modalImages[0] : null) || previewProduct.imageUrl || getProductImage(previewProduct);
        const displayImage = previewSelectedImage || primaryImgUrl;
        const primaryColor = marketplaceSettings?.colorTheme?.primaryColor || 'var(--color-primary, #3b82f6)';
        const secondaryColor = marketplaceSettings?.colorTheme?.secondaryColor || 'var(--color-secondary, #2563eb)';
        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setPreviewProduct(null); setPreviewSelectedImage(null); }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
                <h2 className="text-2xl font-bold text-gray-900">Vista Previa</h2>
                <button
                  onClick={() => { setPreviewProduct(null); setPreviewSelectedImage(null); }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Contenido */}
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Galería */}
                  <div className="space-y-4">
                    <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                      {displayImage ? (
                        <img
                          src={getImageUrl(displayImage)}
                          alt={previewProduct.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><span className="text-6xl">🎵</span></div>
                      )}
                    </div>
                    {/* Miniaturas */}
                    {modalImages.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {modalImages.slice(0, 4).map((img: any, idx: number) => {
                          const imgUrl = img?.url || (typeof img === 'string' ? img : null);
                          return imgUrl ? (
                            <div
                              key={idx}
                              onClick={() => setPreviewSelectedImage(imgUrl)}
                              className={`aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 transition-colors cursor-pointer ${
                                (previewSelectedImage || primaryImgUrl) === imgUrl ? 'theme-border' : 'border-gray-200 hover:theme-border'
                              }`}
                            >
                              <img src={getImageUrl(imgUrl)} alt={`${previewProduct.title} ${idx + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col space-y-6">
                    <div>
                      <h3 className="text-3xl font-bold text-gray-900 mb-2">{previewProduct.title}</h3>
                      {previewProduct.artist && (
                        <p className="text-xl text-gray-600">{previewProduct.artist}</p>
                      )}
                    </div>

                    {/* Precio */}
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-bold" style={{ color: primaryColor }}>
                        {formatPrice(Number(previewProduct.price) || 0)}
                      </span>
                      {(previewProduct.stock ?? 1) > 0 ? (
                        <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                          Stock disponible: {previewProduct.stock ?? 1}
                        </span>
                      ) : (
                        <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">Sin stock</span>
                      )}
                    </div>

                    {/* Detalles */}
                    {(previewProduct.format || previewProduct.genre || previewProduct.condition || previewProduct.year) && (
                      <div className="space-y-3 border-t pt-4">
                        {previewProduct.format && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700 w-24">Formato:</span>
                            <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{previewProduct.format}</span>
                          </div>
                        )}
                        {previewProduct.genre && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700 w-24">Género:</span>
                            <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{previewProduct.genre}</span>
                          </div>
                        )}
                        {previewProduct.condition && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700 w-24">Condición:</span>
                            <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{previewProduct.condition}</span>
                          </div>
                        )}
                        {previewProduct.year && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700 w-24">Año:</span>
                            <span className="text-sm text-gray-900">{previewProduct.year}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Botones */}
                    <div className="flex gap-3 pt-4 border-t mt-auto">
                      <Link
                        href={`/productos/${previewProduct.slug || previewProduct.id}`}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                        onClick={() => { setPreviewProduct(null); setPreviewSelectedImage(null); }}
                      >
                        Ver detalles completos
                      </Link>
                      <button
                        onClick={() => { handleAddToCart(previewProduct); setPreviewProduct(null); setPreviewSelectedImage(null); }}
                        disabled={!(previewProduct.stock ?? 1) || (previewProduct.stock ?? 1) <= 0}
                        className="flex-1 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{ background: !(previewProduct.stock ?? 1) || (previewProduct.stock ?? 1) <= 0 ? undefined : `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                      >
                        <ShoppingCart className="w-5 h-5" />
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
