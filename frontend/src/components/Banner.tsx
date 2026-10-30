'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { getImageUrl } from "@/lib/imageUtils";
import { getProductImageByIndex } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ShoppingCart, X } from "lucide-react";
import { useDeviceType } from "@/hooks/useDeviceType";
import { getProductUrl } from "@/lib/useCustomDomain";
import { useCart } from "@/contexts/CartContext";

interface BannerConfig {
  // Para grid
  columns?: number;
  rows?: number;
  productImages?: Array<{ url: string; productId?: string; product?: any }>;
  transformToSlide?: boolean;
  productFilter?: {
    type: 'all' | 'new' | 'used' | 'category';
    categories?: string[];
  };

  // Para image
  imageUrl?: string;
  linkUrl?: string;
  height?: string;

  // Para title
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  backgroundColor?: string;
  textColor?: string;

  // Para ofertas
  offers?: Array<{ imageUrl?: string; brand?: string; title?: string; salePrice?: string | number; normalPrice?: string | number; badge?: string; linkUrl?: string }>;
  imageHeight?: string;
}

interface BannerProps {
  type: 'grid' | 'image' | 'title' | 'offers';
  config: BannerConfig;
  vendorSlug?: string;
  vendorSettings?: any;
  deviceVisibility?: {
    mobile: boolean;
    tablet: boolean;
    desktop: boolean;
  };
}

export default function Banner({ type, config, vendorSlug, vendorSettings, deviceVisibility }: BannerProps) {
  const deviceType = useDeviceType();

  // Verificar si el banner debe mostrarse en este dispositivo
  if (deviceVisibility) {
    if (deviceType === 'mobile' && deviceVisibility.mobile === false) {
      return null;
    }
    if (deviceType === 'tablet' && deviceVisibility.tablet === false) {
      return null;
    }
    if (deviceType === 'desktop' && deviceVisibility.desktop === false) {
      return null;
    }
  }

  if (type === 'grid') {
    return <GridBanner config={config} vendorSlug={vendorSlug} vendorSettings={vendorSettings} />;
  }

  if (type === 'image') {
    return <ImageBanner config={config} />;
  }

  if (type === 'title') {
    return <TitleBanner config={config} />;
  }

  if (type === 'offers') {
    return <OffersBanner config={config} />;
  }

  return null;
}

// Grid de Imágenes de Productos
function GridBanner({ config, vendorSlug, vendorSettings }: { config: BannerConfig; vendorSlug?: string; vendorSettings?: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<any>(null);
  const [quickViewSelectedImage, setQuickViewSelectedImage] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const { addItem } = useCart();

  console.log('🎨 GridBanner rendered with:', {
    vendorSlug,
    hasVendorSettings: !!vendorSettings,
    imageRolloverEnabled: vendorSettings?.imageRolloverEnabled
  });

  const columns = config.columns || 4;
  const rows = config.rows || 2;
  const totalNeeded = columns * rows;
  const transformToSlide = Boolean(config.transformToSlide);
  const productRequestLimit = transformToSlide ? Math.min(Math.max(totalNeeded * 4, totalNeeded), 60) : totalNeeded;

  useEffect(() => {
    // Si ya hay imágenes configuradas, no cargar productos
    if (config.productImages && config.productImages.length > 0) {
      setHasMoreProducts(false);
      setLoading(false);
      return;
    }

    // Cargar productos automáticamente
    loadProducts(0, false);
  }, [vendorSlug, (config as any).productFilter?.type, (config as any).productFilter?.categories?.join(','), transformToSlide, columns, rows]);

  const loadProducts = async (offset = 0, append = false) => {
    if (!vendorSlug) {
      console.log('🎨 Banner: No vendorSlug provided');
      setLoading(false);
      return;
    }

    try {
      if (append) {
        setLoadingMoreProducts(true);
      } else {
        setLoading(true);
      }
      console.log('🎨 Banner: Loading products for vendor:', vendorSlug);

      // Construir URL base según si es marketplace o tienda específica
      let productsUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/products?limit=${productRequestLimit}&offset=${offset}`;

      if (vendorSlug === 'marketplace') {
        // Para marketplace, usar marketplaceOnly=true
        productsUrl += '&marketplaceOnly=true';
        console.log('🎨 Banner: Loading marketplace products');
      } else {
        // Para tiendas específicas, obtener el vendorId desde el slug
        const vendorResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/vendors/slug/${vendorSlug}`);
        const vendor = await vendorResponse.json();
        console.log('🎨 Banner: Vendor found:', vendor);

        if (!vendor || !vendor.id) {
          console.log('🎨 Banner: No vendor found');
          setLoading(false);
          return;
        }

        productsUrl += `&vendorId=${vendor.id}`;
      }

      // Aplicar filtro según configuración
      const productFilter = (config as any).productFilter;
      console.log('🎨 Banner: Product filter config:', productFilter);

      if (productFilter?.type === 'new') {
        productsUrl += '&condition=new';
      } else if (productFilter?.type === 'used') {
        productsUrl += '&condition=used';
      } else if (productFilter?.type === 'category' && productFilter?.categories?.length > 0) {
        // Filtrar por categorías
        productsUrl += `&categoryId=${productFilter.categories.join(',')}`;
      }

      console.log('🎨 Banner: Fetching products from:', productsUrl);
      const response = await fetch(productsUrl);
      const data = await response.json();
      console.log('🎨 Banner: Products response:', data);
      console.log('🎨 Banner: Response keys:', Object.keys(data));
      const productsList = Array.isArray(data) ? data : (data.products || data.data || []);
      console.log('🎨 Banner: Products list:', productsList.length, 'products');
      console.log('🎨 Banner: First product sample:', productsList[0]);
      setHasMoreProducts(transformToSlide && productsList.length === productRequestLimit);
      setProducts((currentProducts) => append ? [...currentProducts, ...productsList] : productsList);
    } catch (error) {
      console.error('🎨 Banner: Error loading products:', error);
    } finally {
      if (append) {
        setLoadingMoreProducts(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Usar siempre CSS inline para grid columns (más confiable que clases dinámicas)
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: 0
  };

  // Usar imágenes configuradas o productos cargados
  const rawImages = (config.productImages && Array.isArray(config.productImages))
    ? config.productImages.map((img: any) => ({
        url: (img.product ? (getProductImageByIndex(img.product, 0, 'thumb') || img.url) : img.url),
        secondUrl: (img.product ? (getProductImageByIndex(img.product, 1, 'thumb') || '') : ''),
        productId: img.productId,
        product: img.product
      }))
    : (Array.isArray(products) ? products : []).map((p, idx) => {
        const url = getProductImageByIndex(p, 0, 'thumb') || '';
        const secondUrl = getProductImageByIndex(p, 1, 'thumb') || '';
        return {
          url,
          secondUrl,
          productId: p.id,
          product: p // Guardar el producto completo para mostrar info en hover
        };
      });

  const images = rawImages.filter(img => img.url && img.url.trim() !== ''); // Filtrar imágenes vacías

  useEffect(() => {
    setSlideIndex(0);
  }, [transformToSlide, columns, rows, vendorSlug, (config as any).productFilter?.type, (config as any).productFilter?.categories?.join(',')]);

  let displayImages = images.slice(0, totalNeeded);

  // Rellenar con placeholders si hay menos imágenes que las necesarias
  if (displayImages.length < totalNeeded) {
    const placeholders = Array(totalNeeded - displayImages.length).fill(null).map((_, idx) => ({
      url: '',
      productId: undefined,
      isPlaceholder: true
    }));
    displayImages = [...displayImages, ...placeholders] as any;
  }

  console.log('🎨 Banner Grid Config:', { columns, rows, totalNeeded, imagesTotal: images.length, displayImagesTotal: displayImages.length });
  console.log('🖼️ Image Rollover Settings:', {
    imageRolloverEnabled: vendorSettings?.imageRolloverEnabled,
    vendorSettingsExists: !!vendorSettings,
    sampleImageHasSecond: (displayImages[0] as any)?.secondUrl ? 'YES' : 'NO'
  });

  const itemsPerSlide = Math.max(1, columns * rows);
  const slidePages = transformToSlide
    ? Array.from({ length: Math.ceil(images.length / itemsPerSlide) }, (_, pageIndex) => {
        const pageItems = images.slice(pageIndex * itemsPerSlide, (pageIndex + 1) * itemsPerSlide);
        if (pageItems.length >= itemsPerSlide) return pageItems;
        const placeholders = Array(itemsPerSlide - pageItems.length).fill(null).map((_, idx) => ({
          url: '',
          productId: undefined,
          isPlaceholder: true,
          placeholderKey: `slide-${pageIndex}-placeholder-${idx}`,
        }));
        return [...pageItems, ...placeholders];
      })
    : [];
  const maxSlideIndex = Math.max(0, slidePages.length - 1);
  const canSlide = transformToSlide && slidePages.length > 1;

  useEffect(() => {
    setSlideIndex((current) => Math.min(current, maxSlideIndex));
  }, [maxSlideIndex]);

  useEffect(() => {
    if (!transformToSlide || (config.productImages && config.productImages.length > 0) || !hasMoreProducts || loadingMoreProducts) return;
    if (slideIndex < Math.max(0, maxSlideIndex - 1)) return;
    loadProducts(products.length, true);
  }, [transformToSlide, hasMoreProducts, loadingMoreProducts, slideIndex, maxSlideIndex, products.length, config.productImages?.length]);


  if (loading) {
    return (
      <div className="bg-gray-100 p-8 text-center animate-pulse">
        <p className="text-gray-400 text-sm">Cargando productos...</p>
      </div>
    );
  }

  // Mostrar placeholder si no hay imágenes
  if (images.length === 0) {
    return (
      <div className="bg-gray-100 p-8 text-center">
        <p className="text-gray-400 text-sm">
          Grid de {columns} columnas × {rows} filas. No hay productos disponibles.
        </p>
      </div>
    );
  }

  const renderGridItem = (img: any, index: number) => (
    <div key={`${img.productId || 'item'}-${index}`} className="relative aspect-square flex-shrink-0">
      {img.isPlaceholder ? (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <span className="text-gray-300 text-xs">Sin producto</span>
        </div>
      ) : img.productId && vendorSlug && img.product ? (
        <div
          className="relative w-full h-full cursor-pointer group"
          onClick={() => { setQuickViewProduct(img.product); setQuickViewSelectedImage(null); }}
        >
          {vendorSettings?.imageRolloverEnabled && img.secondUrl ? (
            <>
              <img
                src={getImageUrl(img.url)}
                alt={img.product.title}
                className="w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-300"
              />
              <img
                src={getImageUrl(img.secondUrl)}
                alt={img.product.title}
                className="absolute top-0 left-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />
            </>
          ) : (
            <img
              src={getImageUrl(img.url)}
              alt={img.product.title}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          )}

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
            <span className="text-white text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              Vista rapida
            </span>
          </div>
        </div>
      ) : (
        <img
          src={getImageUrl(img.url)}
          alt=""
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );

  return (
    <>
      {transformToSlide ? (
        <div className="relative w-full overflow-hidden group/banner-slide">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${slideIndex * 100}%)` }}
          >
            {slidePages.map((pageItems: any[], pageIndex) => (
              <div
                key={`slide-page-${pageIndex}`}
                className="w-full flex-shrink-0"
                style={gridStyle}
              >
                {pageItems.map((img: any, index) => renderGridItem(img, pageIndex * itemsPerSlide + index))}
              </div>
            ))}
          </div>

          {canSlide && (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => setSlideIndex((current) => current === 0 ? maxSlideIndex : current - 1)}
                className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 h-14 w-9 rounded-lg bg-black/65 text-white shadow-xl ring-1 ring-white/35 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => setSlideIndex((current) => current >= maxSlideIndex ? 0 : current + 1)}
                className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 h-14 w-9 rounded-lg bg-black/65 text-white shadow-xl ring-1 ring-white/35 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={gridStyle}>
          {displayImages.map((img: any, index) => renderGridItem(img, index))}
        </div>
      )}

      {/* Modal de Vista Rapida */}
      {quickViewProduct && (() => {
        const primaryImage = getProductImageByIndex(quickViewProduct, 0, 'large') || getProductImageByIndex(quickViewProduct, 0, 'thumb');
        const selectedImage = quickViewSelectedImage || primaryImage;
        const galleryImages = Array.from({ length: 6 }, (_, idx) => {
          const thumb = getProductImageByIndex(quickViewProduct, idx, 'thumb');
          const large = getProductImageByIndex(quickViewProduct, idx, 'large') || thumb;
          return thumb && large ? { thumb, large } : null;
        }).filter(Boolean) as Array<{ thumb: string; large: string }>;
        const displayPrice = Number(quickViewProduct.salePrice || quickViewProduct.price || 0);
        const hasStock = (quickViewProduct.stock ?? 1) > 0;
        const conditionLabel = quickViewProduct.condition === 'new'
          ? 'Nuevo'
          : quickViewProduct.condition === 'used'
            ? 'Usado'
            : quickViewProduct.condition;
        const productUrl = getProductUrl(quickViewProduct, vendorSlug);

        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setQuickViewProduct(null); setQuickViewSelectedImage(null); }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
                <h2 className="text-2xl font-bold text-gray-900">Vista Previa</h2>
                <button
                  onClick={() => { setQuickViewProduct(null); setQuickViewSelectedImage(null); }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Cerrar vista previa"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                      {selectedImage ? (
                        <img
                          src={getImageUrl(selectedImage)}
                          alt={quickViewProduct.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">Sin imagen</div>
                      )}
                    </div>

                    {galleryImages.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {galleryImages.slice(0, 4).map((image, idx) => (
                          <button
                            key={`${image.large}-${idx}`}
                            type="button"
                            onClick={() => setQuickViewSelectedImage(image.large)}
                            className={`aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 transition-colors cursor-pointer ${(selectedImage || primaryImage) === image.large ? 'theme-border' : 'border-gray-200 hover:theme-border'}`}
                          >
                            <img
                              src={getImageUrl(image.thumb)}
                              alt={`${quickViewProduct.title} ${idx + 1}`}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-6">
                    <div>
                      <h3 className="text-3xl font-bold text-gray-900 mb-2">{quickViewProduct.title}</h3>
                      {quickViewProduct.artist && <p className="text-xl text-gray-600">{quickViewProduct.artist}</p>}
                    </div>

                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-bold theme-text">
                        {displayPrice > 0 ? `$${new Intl.NumberFormat('es-CL').format(displayPrice)}` : '-'}
                      </span>
                      {hasStock ? (
                        <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">Stock disponible: {quickViewProduct.stock ?? 1}</span>
                      ) : (
                        <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">Sin stock</span>
                      )}
                    </div>

                    <div className="space-y-3 border-t pt-4">
                      {quickViewProduct.format && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Formato:</span>
                          <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{quickViewProduct.format}</span>
                        </div>
                      )}
                      {quickViewProduct.genre && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Genero:</span>
                          <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{quickViewProduct.genre}</span>
                        </div>
                      )}
                      {conditionLabel && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Condicion:</span>
                          <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{conditionLabel}</span>
                        </div>
                      )}
                      {quickViewProduct.year && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Ano:</span>
                          <span className="text-sm text-gray-900">{quickViewProduct.year}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4 border-t mt-auto">
                      <Link
                        href={productUrl}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                        onClick={() => { setQuickViewProduct(null); setQuickViewSelectedImage(null); }}
                      >
                        Ver detalles completos
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (!hasStock) return;
                          addItem({
                            productId: quickViewProduct.id,
                            title: quickViewProduct.title,
                            artist: quickViewProduct.artist,
                            price: displayPrice || Number(quickViewProduct.price || 0),
                            imageUrl: primaryImage ? getImageUrl(primaryImage) : undefined,
                            stock: quickViewProduct.stock || 1,
                            vendorId: quickViewProduct.vendor?.id || quickViewProduct.vendorId,
                            vendorSlug: quickViewProduct.vendor?.slug || quickViewProduct.vendorSlug || vendorSlug,
                          });
                          setQuickViewProduct(null);
                          setQuickViewSelectedImage(null);
                        }}
                        disabled={!hasStock}
                        className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    </>
  );
}

// Banner de Imagen Simple
function ImageBanner({ config }: { config: BannerConfig }) {
  const height = config.height || "400px";

  // No renderizar si no hay imagen
  if (!config.imageUrl) {
    return (
      <div
        className="w-full bg-gray-100 flex items-center justify-center"
        style={{ height }}
      >
        <p className="text-gray-400 text-sm">Configura una imagen para este banner</p>
      </div>
    );
  }

  const ImageContent = (
    <img
      src={getImageUrl(config.imageUrl)}
      alt=""
      className="w-full object-cover"
      style={{ height }}
    />
  );

  if (config.linkUrl) {
    return (
      <Link href={config.linkUrl} className="block hover:opacity-95 transition-opacity">
        {ImageContent}
      </Link>
    );
  }

  return <div>{ImageContent}</div>;
}

// Banner de Título con Fondo
function TitleBanner({ config }: { config: BannerConfig }) {
  const height = config.height || "300px";
  const backgroundColor = config.backgroundColor || "#9333ea";
  const textColor = config.textColor || "#ffffff";

  const style: React.CSSProperties = {
    height,
    backgroundColor,
    color: textColor,
  };

  if (config.backgroundImage) {
    style.backgroundImage = `url(${getImageUrl(config.backgroundImage)})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center text-center px-8"
      style={style}
    >
      {/* Overlay si hay imagen de fondo */}
      {config.backgroundImage && (
        <div className="absolute inset-0 bg-black/40"></div>
      )}

      <div className="relative z-10">
        {config.title && (
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            {config.title}
          </h1>
        )}
        {config.subtitle && (
          <p className="text-lg md:text-2xl opacity-90">
            {config.subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function OffersBanner({ config }: { config: BannerConfig }) {
  const offers = Array.isArray(config.offers) ? config.offers.filter(offer => offer.imageUrl || offer.title) : [];
  const columns = Math.min(Math.max(Number(config.columns) || 3, 1), 5);
  const formatPrice = (value?: string | number) => value !== undefined && value !== ''
    ? `$${new Intl.NumberFormat('es-CL').format(Number(value) || 0)}`
    : '';

  if (!offers.length) return <div className="flex min-h-52 items-center justify-center bg-slate-100 text-sm text-slate-400">Agrega productos u ofertas para completar este banner</div>;

  return <section className="w-full p-3 sm:p-5" style={{ backgroundColor: config.backgroundColor || '#ef1017' }}>
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 lg:grid lg:overflow-visible" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {offers.map((offer, index) => {
        const content = <article className="group relative h-full min-w-[82vw] snap-start overflow-hidden rounded-2xl bg-slate-900 shadow-lg sm:min-w-[390px] lg:min-w-0">
          <img src={getImageUrl(offer.imageUrl || '')} alt={offer.title || offer.brand || ''} className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" style={{ height: config.imageHeight || '420px' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
          {offer.badge && <span className="absolute right-4 top-4 max-w-[45%] rounded-lg bg-white/95 px-3 py-2 text-center text-xs font-extrabold uppercase text-red-600 shadow-md">{offer.badge}</span>}
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
            {offer.brand && <p className="text-sm font-extrabold uppercase">{offer.brand}</p>}
            {offer.title && <h3 className="mt-0.5 text-base font-medium leading-tight text-white/95 sm:text-lg">{offer.title}</h3>}
            {offer.salePrice && <div className="mt-3 inline-block rounded-xl bg-red-600 px-3 py-1.5 text-2xl font-black tracking-normal text-white shadow-[0_3px_0_rgba(130,0,0,.8)] sm:text-3xl">{formatPrice(offer.salePrice)}</div>}
            {offer.normalPrice && <p className="mt-2 text-xs font-bold uppercase text-white">Precio normal: <span className="line-through decoration-2">{formatPrice(offer.normalPrice)}</span></p>}
          </div>
        </article>;
        return offer.linkUrl ? <Link key={index} href={offer.linkUrl} className="block">{content}</Link> : <div key={index}>{content}</div>;
      })}
    </div>
  </section>;
}
