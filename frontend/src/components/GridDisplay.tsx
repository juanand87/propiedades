"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/lib/api";
import { getProductUrl } from "@/lib/useCustomDomain";
import { usePathname, useSearchParams } from "next/navigation";
import { Eye, ShoppingCart, X } from "lucide-react";

// ===== DISEÑO SIMPLIFICADO =====
// Cambiar a false para volver al diseño con fondos
const SIMPLIFIED_DESIGN = false;
// ================================

interface GridDisplayProps {
  vendorSlug: string;
  vendorId: string;
  gridConfig: any;
  gridType: 'homepage' | 'category';
  slug: string;
  categoryId?: string;
  categoryDisplayConfig?: { mode: 'none' | 'icon' | 'name'; position: string };
  condition?: string; // 'new' or 'used'
  vendorSettings?: any; // Vendor settings for image rollover, etc.
}

const displayModeLabels = {
  'specific-category': 'Categoría Específica',
  'latest': 'Últimos Productos Agregados',
  'featured': 'Productos Destacados',
  'best-sellers': 'Productos Más Vendidos',
  'on-sale': 'Productos en Oferta',
};

export default function GridDisplay({
  vendorSlug,
  vendorId,
  gridConfig,
  gridType,
  slug,
  categoryId,
  categoryDisplayConfig,
  condition,
  vendorSettings,
}: GridDisplayProps) {
  const { addItem } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const [previewSelectedImage, setPreviewSelectedImage] = useState<string | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const restoredFromSessionRef = useRef(false);

  const sessionKey = `gridState:${pathname}:${searchParams.toString()}:${vendorId}:${gridType}:${categoryId || 'none'}:${condition || 'all'}:${gridConfig?.displayMode || 'latest'}`;

  const saveGridState = () => {
    try {
      const stateData = {
        products,
        page,
        hasMore,
        totalCount,
        scrollY: window.scrollY,
        savedAt: Date.now(),
      };
      localStorage.setItem(sessionKey, JSON.stringify(stateData));
      console.log('✅ [GridDisplay] State saved:', sessionKey, 'scrollY:', window.scrollY);
    } catch (error) {
      console.warn('Could not save grid state:', error);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const rawState = localStorage.getItem(sessionKey);
      console.log('🔍 [GridDisplay] Searching for state:', sessionKey, 'found:', !!rawState);
      
      if (!rawState) return;

      const state = JSON.parse(rawState);
      const isFresh = Date.now() - (state.savedAt || 0) < 60 * 60 * 1000; // 1 hour
      
      if (!isFresh) {
        console.log('⏰ [GridDisplay] State is stale, clearing');
        localStorage.removeItem(sessionKey);
        return;
      }
      
      if (!Array.isArray(state.products) || state.products.length === 0) {
        console.log('❌ [GridDisplay] No products in saved state');
        return;
      }

      console.log('✨ [GridDisplay] Restoring state with', state.products.length, 'products, scroll:', state.scrollY);
      restoredFromSessionRef.current = true;
      setProducts(state.products);
      setPage(Number(state.page) || 1);
      setHasMore(Boolean(state.hasMore));
      setTotalCount(Number(state.totalCount) || state.products.length);
      setLoading(false);

      // Restore scroll after render
      setTimeout(() => {
        window.scrollTo(0, Number(state.scrollY) || 0);
        console.log('📍 [GridDisplay] Scroll restored to:', state.scrollY);
      }, 100);
    } catch (error) {
      console.warn('Could not restore grid state:', error);
    }
  }, [sessionKey]);

  console.log('🛍️ GridDisplay rendered:', {
    vendorSlug,
    hasVendorSettings: !!vendorSettings,
    imageRolloverEnabled: vendorSettings?.imageRolloverEnabled,
    vendorSettingsKeys: vendorSettings ? Object.keys(vendorSettings) : []
  });

  // Calcular productos por página: filas × columnas
  const columns = Number(gridConfig.columns) || 5;
  const itemsPerPage = gridConfig.rows ? gridConfig.rows * columns : 12;

  // Infinite scroll observer
  useEffect(() => {
    if (!gridConfig.rows) {
      // Infinite scroll mode
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
            setPage((prev) => prev + 1);
          }
        },
        { threshold: 0.1 }
      );

      if (observerTarget.current) {
        observer.observe(observerTarget.current);
      }

      return () => observer.disconnect();
    }
  }, [gridConfig.rows, hasMore, loading]);

  const loadProducts = useCallback(async (pageToLoad: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      let query: any = { vendorId };

      // Server-side pagination
      query.limit = itemsPerPage;
      query.offset = (pageToLoad - 1) * itemsPerPage;

      // Filtrar por condición si está presente
      if (condition) {
        console.log('🔍 [GridDisplay] Filtering by condition:', condition);
        query.condition = condition;
      }

      console.log('🔍 [GridDisplay] Full query:', query);

      // Para category grids, usar el categoryId del parámetro
      if (gridType === 'category' && categoryId) {
        query.categoryId = categoryId;
      } else {
        // Para homepage grids, aplicar filtros según displayMode
        switch (gridConfig.displayMode) {
          case 'specific-category':
            if (gridConfig.categoryId) {
              query.categoryId = gridConfig.categoryId;
            }
            break;
          case 'featured':
            query.isFeatured = true;
            break;
          case 'on-sale':
            query.isOnSale = true;
            break;
          case 'best-sellers':
            query.sortBy = 'most-sold';
            break;
          case 'latest':
          default:
            query.sortBy = 'newest';
        }
      }

      console.log('🔍 [GridDisplay] Query before API call:', query);
      const data = await api.getProducts(query);
      const newProducts = Array.isArray(data) ? data : (data.products || data.data || []);
      const total = data.total || newProducts.length;
      console.log('🔍 [GridDisplay] Products received:', newProducts.length, 'of', total, 'total');

      if (append) {
        setProducts(prev => [...prev, ...newProducts]);
      } else {
        setProducts(newProducts);
      }
      setTotalCount(total);
      setHasMore((pageToLoad * itemsPerPage) < total);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [gridConfig, vendorId, gridType, categoryId, condition, itemsPerPage]);

  // Cargar productos al montar
  useEffect(() => {
    if (restoredFromSessionRef.current) {
      restoredFromSessionRef.current = false;
      return;
    }

    setProducts([]);
    setPage(1);
    loadProducts(1, false);
  }, [loadProducts]);

  // Cargar más productos cuando page cambia (page > 1)
  useEffect(() => {
    if (page > 1) {
      loadProducts(page, true);
    }
  }, [page]);

  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    if (typeof images === 'string') {
      try {
        return JSON.parse(images);
      } catch {
        return images.split(',').filter(Boolean).map((url: string) => ({
          url: url.trim(),
          isPrimary: true,
        }));
      }
    }
    return [];
  };

  const getDisplayPrice = (product: any) =>
    product.isOnSale && product.salePrice ? product.salePrice : product.price;

  // Determinar las clases del grid
  const gridClassMap: Record<number, string> = {
    1: "grid-cols-2",
    2: "grid-cols-2 md:grid-cols-2 lg:grid-cols-3",
    3: "grid-cols-2 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  };
  const gridClass = gridClassMap[columns] || gridClassMap[5];
  
  // Determinar el espaciado del grid según el estilo
  const gridStyle = gridConfig.gridStyle || 'spaced'; // Por defecto 'spaced' para retrocompatibilidad
  const gapClass = gridStyle === 'compact' ? 'gap-0' : 'gap-6';

  // With server-side pagination, products already contains only what we need
  const displayedProducts = products;

  if (loading && products.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 theme-border"></div>
        </div>
      </div>
    );
  }

  if (displayedProducts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          No hay productos para mostrar en esta categoría
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grid de productos */}
      <div className={`grid ${gridClass} ${gapClass}`}>
        {displayedProducts.map((product) => {
          const images = parseImages(product.images);
          const imageUrl =
            images.length > 0
              ? getImageUrl(typeof images[0] === "string" ? images[0] : images[0].url)
              : null;
          const secondImageUrl = images.length > 1
            ? getImageUrl(typeof images[1] === "string" ? images[1] : images[1].url)
            : null;
          const hasRollover = vendorSettings?.imageRolloverEnabled && secondImageUrl;

          const isCompact = gridStyle === 'compact';
          
          // Clases para diseño simplificado o normal
          const containerClasses = SIMPLIFIED_DESIGN
            ? "h-full flex flex-col group"
            : `transition-shadow h-full flex flex-col group ${
                isCompact ? 'rounded-none border border-gray-300 shadow-none -ml-[1px] -mt-[1px]' : 'hover:shadow-xl'
              }`;
          
          const CardWrapper = SIMPLIFIED_DESIGN ? 'div' : Card;
          const ContentWrapper = SIMPLIFIED_DESIGN ? 'div' : CardContent;
          
          return (
            <CardWrapper 
              key={product.id} 
              className={containerClasses}
            >
              <ContentWrapper className={SIMPLIFIED_DESIGN ? "flex flex-col h-full" : "p-0 flex flex-col h-full"}>
                <div className={`relative w-full aspect-square overflow-hidden ${SIMPLIFIED_DESIGN ? 'rounded-lg' : 'rounded-t-lg'}`}>
                  <Link 
                    href={getProductUrl(product, slug)}
                    onClick={saveGridState}
                  >
                    <div className="absolute inset-0 cursor-pointer">
                      {imageUrl ? (
                        <>
                          <Image
                            src={imageUrl}
                            alt={product.title}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            className={`object-cover transition-opacity duration-300 ${
                              hasRollover ? 'group-hover:opacity-0' : ''
                            }`}
                          />
                          {hasRollover && (
                            <Image
                              src={secondImageUrl!}
                              alt={`${product.title} - Vista 2`}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                              className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            />
                          )}
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                          <span className="text-gray-400 text-4xl">🎵</span>
                        </div>
                      )}
                    </div>
                  </Link>
                  
                  {/* Mostrar categoría si está configurado */}
                  {categoryDisplayConfig && categoryDisplayConfig.mode !== 'none' && product.category && (
                    <div className={`absolute p-2 rounded-lg bg-white/90 shadow-md text-xs font-semibold z-10 group/badge
                      ${categoryDisplayConfig.position === 'top-left' ? 'top-2 left-2' : ''}
                      ${categoryDisplayConfig.position === 'top-right' ? 'top-2 right-2' : ''}
                      ${categoryDisplayConfig.position === 'bottom-left' ? 'bottom-2 left-2' : ''}
                      ${categoryDisplayConfig.position === 'bottom-right' ? 'bottom-2 right-2' : ''}
                    `}>
                      {categoryDisplayConfig.mode === 'icon' ? (
                        (product as any).categoryIcon ? (
                          (product as any).categoryIcon.startsWith('/') || (product as any).categoryIcon.startsWith('http') ? (
                            <img 
                              src={getImageUrl((product as any).categoryIcon)} 
                              alt={product.category}
                              className={`w-6 h-6 object-contain${/vinilo|vinyl/i.test(product.category || '') ? ' disc-spin' : ''}`}
                            />
                          ) : (
                            <span className={`text-xl${(product as any).categoryIcon === '💿' ? ' disc-spin' : ''}`}>{(product as any).categoryIcon}</span>
                          )
                        ) : '🏷️'
                      ) : product.category}
                      {categoryDisplayConfig.mode === 'icon' && (
                        <span className={`
                          pointer-events-none absolute hidden group-hover/badge:block
                          bg-gray-800 text-white text-xs font-normal rounded px-2 py-1 whitespace-nowrap
                          top-1/2 -translate-y-1/2 z-30
                          ${(categoryDisplayConfig.position === 'top-right' || categoryDisplayConfig.position === 'bottom-right')
                            ? 'right-full mr-2'
                            : 'left-full ml-2'}
                        `}>
                          {product.category}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Botones de accion */}
                  <div className="hidden md:flex absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-10 gap-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPreviewProduct(product);
                        setPreviewSelectedImage(null);
                      }}
                      className="bg-gray-800/95 hover:bg-gray-900 text-white font-semibold py-3 px-4 transition-colors backdrop-blur-sm flex items-center justify-center"
                      title="Vista Previa"
                      aria-label="Vista Previa"
                    >
                      <Eye className="w-4 h-4 flex-shrink-0" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addItem({
                          productId: product.id,
                          title: product.title,
                          artist: product.artist,
                          price: getDisplayPrice(product),
                          imageUrl: imageUrl || undefined,
                          stock: product.stock || 1,
                          vendorId: (product as any).vendor?.id || product.vendorId || vendorId,
                          vendorSlug: (product as any).vendor?.slug || (product as any).vendorSlug || slug,
                        });
                      }}
                      disabled={!product.stock || product.stock <= 0}
                      className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed backdrop-blur-sm flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>{product.stock > 0 ? 'Agregar' : 'Sin stock'}</span>
                    </button>
                  </div>
                </div>

                <div className="md:hidden flex">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreviewProduct(product);
                      setPreviewSelectedImage(null);
                    }}
                    className="w-12 bg-gray-800 hover:bg-gray-900 text-white py-3 transition-colors flex items-center justify-center"
                    aria-label="Vista Previa"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addItem({
                        productId: product.id,
                        title: product.title,
                        artist: product.artist,
                        price: getDisplayPrice(product),
                        imageUrl: imageUrl || undefined,
                        stock: product.stock || 1,
                        vendorId: (product as any).vendor?.id || product.vendorId || vendorId,
                        vendorSlug: (product as any).vendor?.slug || (product as any).vendorSlug || slug,
                      });
                    }}
                    disabled={!product.stock || product.stock <= 0}
                    className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 text-sm transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>{product.stock > 0 ? 'Agregar' : 'Sin stock'}</span>
                  </button>
                </div>
                
                <div className={isCompact ? 'pt-4 px-4 pb-0 flex flex-col flex-1' : 'p-4 flex flex-col flex-1'}>
                  <h3 className="font-semibold text-sm text-gray-800 mb-3 line-clamp-2">
                    {product.title}
                  </h3>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-lg md:text-xl font-bold theme-text">
                      {formatPrice(Number(getDisplayPrice(product)) || 0)}
                    </span>
                  </div>                </div>
              </ContentWrapper>
            </CardWrapper>
          );
        })}
      </div>

      {/* Infinite scroll observer */}
      {!gridConfig.rows && hasMore && <div ref={observerTarget} className="py-8 text-center" />}

      {/* Botón de cargar más */}
      {hasMore && !loadingMore && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => setPage((prev) => prev + 1)}
            className="theme-gradient-bg hover:opacity-90"
          >
            Cargar más productos ({totalCount - products.length} restantes)
          </Button>
        </div>
      )}
      {loadingMore && (
        <div className="flex justify-center pt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 theme-border"></div>
        </div>
      )}

      {previewProduct && (() => {
        const primaryImage = getProductImageByIndex(previewProduct, 0, 'large') || getProductImageByIndex(previewProduct, 0, 'thumb');
        const selectedImage = previewSelectedImage || primaryImage;
        const images = parseImages(previewProduct.images);

        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setPreviewProduct(null); setPreviewSelectedImage(null); }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-2xl font-bold text-gray-900">Vista Previa</h2>
                <button
                  onClick={() => { setPreviewProduct(null); setPreviewSelectedImage(null); }}
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
                          alt={previewProduct.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-5xl">?</div>
                      )}
                    </div>

                    {images.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {images.slice(0, 4).map((_img: any, idx: number) => {
                          const imgUrl = getProductImageByIndex(previewProduct, idx, 'thumb');
                          const largeUrl = getProductImageByIndex(previewProduct, idx, 'large') || imgUrl;
                          return imgUrl && (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setPreviewSelectedImage(largeUrl)}
                              className={`aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 transition-colors cursor-pointer ${selectedImage === largeUrl ? 'theme-border' : 'border-gray-200 hover:theme-border'}`}
                            >
                              <img
                                src={getImageUrl(imgUrl)}
                                alt={`${previewProduct.title} ${idx + 1}`}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-6">
                    <div>
                      <h3 className="text-3xl font-bold text-gray-900 mb-2">
                        {previewProduct.title}
                      </h3>
                      {previewProduct.artist && (
                        <p className="text-xl text-gray-600">
                          {previewProduct.artist}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="text-4xl font-bold theme-text">
                        {formatPrice(Number(getDisplayPrice(previewProduct)) || 0)}
                      </span>
                      {previewProduct.stock > 0 ? (
                        <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                          Stock disponible: {previewProduct.stock}
                        </span>
                      ) : (
                        <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
                          Sin stock
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 border-t pt-4">
                      {previewProduct.format && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Formato:</span>
                          <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                            {previewProduct.format}
                          </span>
                        </div>
                      )}
                      {previewProduct.genre && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Genero:</span>
                          <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                            {previewProduct.genre}
                          </span>
                        </div>
                      )}
                      {previewProduct.condition && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Condicion:</span>
                          <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                            {previewProduct.condition}
                          </span>
                        </div>
                      )}
                      {previewProduct.year && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Ano:</span>
                          <span className="text-sm text-gray-900">{previewProduct.year}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4 border-t mt-auto">
                      <Link
                        href={getProductUrl(previewProduct, slug)}
                        onClick={saveGridState}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                      >
                        Ver detalles completos
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const primaryThumb = getProductImageByIndex(previewProduct, 0, 'thumb');
                          addItem({
                            productId: previewProduct.id,
                            title: previewProduct.title,
                            artist: previewProduct.artist,
                            price: getDisplayPrice(previewProduct),
                            imageUrl: primaryThumb ? getImageUrl(primaryThumb) : undefined,
                            stock: previewProduct.stock || 1,
                            vendorId: previewProduct.vendor?.id || previewProduct.vendorId || vendorId,
                            vendorSlug: previewProduct.vendor?.slug || previewProduct.vendorSlug || slug,
                          });
                          setPreviewProduct(null);
                          setPreviewSelectedImage(null);
                        }}
                        disabled={!previewProduct.stock || previewProduct.stock <= 0}
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
    </div>
  );
}
