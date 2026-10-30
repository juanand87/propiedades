"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, ChevronDown, ChevronUp, Package } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import HeaderType1 from "@/components/headers/HeaderType1";
import StoreFooter from "@/components/StoreFooter";
import { shouldShowFilterSidebar } from "@/lib/filterVisibility";
import CatalogFilters from "@/components/CatalogFilters";
import MusicPreloader from "@/components/MusicPreloader";

interface FilterSection {
  name: string;
  items: { label: string; count: number; value: string }[];
  expanded: boolean;
}

export default function CatalogoPage() {
  const slug = 'marketplace';
  const { addItem } = useCart();
  const pathname = usePathname();
  
  const [vendor, setVendor] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [allMenuItems, setAllMenuItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PRODUCTS_PER_PAGE = 24;
  
  // Filtros
  const [filters, setFilters] = useState({
    format: [] as string[],
    genre: [] as string[],
    mediaGrade: [] as string[],
    sleeveGrade: [] as string[],
    artist: '',
  });

  // Datos de filtros disponibles
  const [availableFilters, setAvailableFilters] = useState({
    formats: [] as { label: string; count: number; value: string }[],
    genres: [] as { label: string; count: number; value: string }[],
    mediaGrades: [] as { label: string; count: number; value: string }[],
    sleeveGrades: [] as { label: string; count: number; value: string }[],
  });

  useEffect(() => {
    loadVendorData();
  }, []);

  useEffect(() => {
    if (vendor) {
      // Reset pagination when filters change
      setProducts([]);
      setPage(1);
      setHasMore(true);
      // Cargar productos inmediatamente con nuevos filtros
      loadProducts(true);
    }
  }, [vendor, filters]);

  const loadVendorData = async () => {
    try {
      const foundVendor = await api.getVendorBySlug(slug);
      setVendor(foundVendor);
      
      const vendorSettings = await api.getVendorSettings(foundVendor.id, false);
      setSettings(vendorSettings);
      
      // Cargar todos los items del menú para verificar URLs
      const menuItems = [
        ...(vendorSettings.menus?.principal || []),
        ...(vendorSettings.menus?.secundario || [])
      ];
      setAllMenuItems(menuItems);
      
      if (vendorSettings?.colorTheme) {
        const { applyThemeToDocument } = await import('@/lib/colorThemes');
        applyThemeToDocument(vendorSettings.colorTheme, vendorSettings.customColors);
      }
    } catch (error) {
      console.error("Error loading vendor:", error);
    }
  };

  const loadProducts = async (isFirstPage: boolean = false) => {
    try {
      if (isFirstPage) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const itemsPerPage = PRODUCTS_PER_PAGE;
      
      // Construir query params para productos paginados
      const params = new URLSearchParams();
      params.append('marketplaceOnly', 'true');
      params.append('limit', itemsPerPage.toString());
      params.append('offset', ((page - 1) * itemsPerPage).toString());
      
      if (filters.format.length > 0) {
        filters.format.forEach(f => params.append('format', f));
      }
      if (filters.genre.length > 0) {
        filters.genre.forEach(g => params.append('genre', g));
      }
      if (filters.mediaGrade.length > 0) {
        filters.mediaGrade.forEach(mg => params.append('mediaGrade', mg));
      }
      if (filters.sleeveGrade.length > 0) {
        filters.sleeveGrade.forEach(sg => params.append('sleeveGrade', sg));
      }
      if (filters.artist) {
        params.append('artist', filters.artist);
      }

      // Consulta de productos paginados
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products?${params.toString()}`);
      const data = await response.json();
      const newProducts = data.products || [];
      
      // Agregar productos (append o replace)
      if (isFirstPage) {
        setProducts(newProducts);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
      }
      
      setTotalCount(data.total || 0);
      setHasMore(newProducts.length === itemsPerPage);
      
      // Solo calcular aggregations en la primera carga
      if (isFirstPage) {
        // Consulta separada para conteos (solo primera página)
        // IMPORTANTE: NO incluir filtros de mediaGrade/sleeveGrade para calcular contadores disponibles
        const allParams = new URLSearchParams();
        allParams.append('marketplaceOnly', 'true');
        allParams.append('limit', '10000');
        
        // Solo aplicar filtros de formato y género para el conteo
        // Los contadores de mediaGrade/sleeveGrade deben mostrar TODOS los disponibles
        if (filters.format.length > 0) {
          filters.format.forEach(f => allParams.append('format', f));
        }
        if (filters.genre.length > 0) {
          filters.genre.forEach(g => allParams.append('genre', g));
        }
        if (filters.artist) {
          allParams.append('artist', filters.artist);
        }
        // NO agregar mediaGrade ni sleeveGrade aquí para que muestre todos los disponibles
        
        const allResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products?${allParams.toString()}`);
        const allData = await allResponse.json();
        const allProducts = allData.products || [];
      
        // Calcular aggregations desde TODOS los productos
        const formatMap = new Map<string, { id: string; name: string; count: number }>();
        const genreMap = new Map<string, { id: string; name: string; count: number }>();
        const mediaGrades = new Map<string, number>();
        const sleeveGrades = new Map<string, number>();

        console.log('🔍 [Catalogo] Total productos para analizar filtros:', allProducts.length);
        
        // Debug: Ver si los productos tienen mediaGrade y sleeveGrade
        const productsWithGrades = allProducts.filter((p: any) => p.mediaGrade || p.sleeveGrade);
        console.log('🔍 [Catalogo] Productos con grades:', productsWithGrades.length);
        if (productsWithGrades.length > 0) {
          console.log('🔍 [Catalogo] Ejemplo producto con grades:', {
            title: productsWithGrades[0].title,
            mediaGrade: productsWithGrades[0].mediaGrade,
            sleeveGrade: productsWithGrades[0].sleeveGrade
          });
        }

        allProducts.forEach((product: any) => {
        // Formatos - usar la relación product.formats
        if (product.formats && Array.isArray(product.formats)) {
          product.formats.forEach((format: any) => {
            const existing = formatMap.get(format.id.toString());
            if (existing) {
              existing.count++;
            } else {
              formatMap.set(format.id.toString(), {
                id: format.id.toString(),
                name: format.name,
                count: 1
              });
            }
          });
        }
        
        // Géneros - usar la relación product.genres
        if (product.genres && Array.isArray(product.genres)) {
          product.genres.forEach((genre: any) => {
            const existing = genreMap.get(genre.id.toString());
            if (existing) {
              existing.count++;
            } else {
              genreMap.set(genre.id.toString(), {
                id: genre.id.toString(),
                name: genre.name,
                count: 1
              });
            }
          });
        }
        
        // Media Grade
        if (product.mediaGrade) {
          mediaGrades.set(product.mediaGrade, (mediaGrades.get(product.mediaGrade) || 0) + 1);
        }
        
        // Sleeve Grade
        if (product.sleeveGrade) {
          sleeveGrades.set(product.sleeveGrade, (sleeveGrades.get(product.sleeveGrade) || 0) + 1);
          }
        });

        setAvailableFilters({
          formats: Array.from(formatMap.values()).map(f => ({ label: f.name, count: f.count, value: f.id })),
          genres: Array.from(genreMap.values()).map(g => ({ label: g.name, count: g.count, value: g.id })),
          mediaGrades: Array.from(mediaGrades.entries()).map(([label, count]) => ({ label, count, value: label })),
          sleeveGrades: Array.from(sleeveGrades.entries()).map(([label, count]) => ({ label, count, value: label })),
        });
      }
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const toggleFilter = (category: keyof typeof filters, value: string) => {
    const currentValues = filters[category] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    setFilters({ ...filters, [category]: newValues });
  };

  const renderHeader = () => {
    if (!settings?.headerType || !vendor) return null;
    
    const headerProps = {
      vendor,
      slug: vendor.slug || slug,
      config: {
        ...(settings.headerConfig || {}),
        menus: settings.menus || {},
        topBarPhrases: settings.topBarPhrases || {},
        headerConfig: settings.headerConfig || {},
        topBarEnabled: settings.topBarEnabled,
        topBarBgColor: settings.topBarBgColor,
      },
    };

    switch (settings.headerType) {
      case 1:
        return <HeaderType1 {...headerProps} />;
      case 2:
        const HeaderType2 = require("@/components/headers/HeaderType2").default;
        return <HeaderType2 {...headerProps} />;
      case 3:
        const HeaderType3 = require("@/components/headers/HeaderType3").default;
        return <HeaderType3 {...headerProps} />;
      default:
        return <HeaderType1 {...headerProps} />;
    }
  };

  const formatPrice = (price: number) => {
    return Math.round(price).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    try {
      return JSON.parse(images);
    } catch {
      return [];
    }
  };

  const handleAddToCart = (product: any) => {
    const thumbImage = getProductImageByIndex(product, 0, 'thumb');
    const imageUrl = thumbImage ? getImageUrl(thumbImage) : undefined;
    
    // Asegurar que tengamos vendorId y vendorSlug válidos
    const productVendorId = product.vendor?.id || product.vendorId || vendor?.id;
    const productVendorSlug = product.vendor?.slug || product.vendorSlug || slug;

    if (!productVendorId || !productVendorSlug) {
      console.error('❌ Product missing vendor info:', product);
      alert('Error: Producto sin tienda asociada');
      return;
    }
    
    addItem({
      productId: product.id,
      title: product.title,
      artist: product.artist,
      price: product.isOnSale && product.salePrice ? product.salePrice : product.price,
      imageUrl: imageUrl,
      stock: product.stock || 1,
      vendorId: productVendorId,
      vendorSlug: productVendorSlug,
    });
  };

  // Escala Goldmine ordenada
  const goldmineOrder = ['M', 'NM', 'NM or M-', 'VG+', 'VG', 'G+', 'G', 'P'];

  // En el catálogo del marketplace siempre mostramos filtros a la izquierda
  const shouldShowFilters = () => true;

  return (
    <div className="min-h-screen bg-gray-50">
      {vendor && renderHeader()}

      <div className="container mx-auto px-4 py-8">
        {/* Header de la página */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎵 Catálogo de Productos
          </h1>
          <p className="text-gray-600">
            {totalCount} {totalCount === 1 ? 'producto encontrado' : 'productos encontrados'}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar de Filtros - Desktop */}
          {shouldShowFilters() && (
            <aside className="hidden lg:block lg:w-64 flex-shrink-0">
              <CatalogFilters
                filters={filters}
                availableFilters={availableFilters}
                onFilterChange={toggleFilter}
                goldmineOrder={goldmineOrder}
              />
            </aside>          )}

          {/* Filtros Mobile - Colapsables */}
          {shouldShowFilters() && (            <div className="lg:hidden">
              <Card className="mb-4">
                <CardContent className="p-4">
                  <details className="cursor-pointer">
                    <summary className="font-semibold text-gray-900 flex items-center justify-between">
                      🎛️ Filtros
                      <ChevronDown className="w-5 h-5" />
                    </summary>
                    <div className="mt-4">
                      <CatalogFilters
                        filters={filters}
                        availableFilters={availableFilters}
                        onFilterChange={toggleFilter}
                        goldmineOrder={goldmineOrder}
                      />
                    </div>
                  </details>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Listado de Productos */}
          <div className="flex-1">
            {loading ? (
              <MusicPreloader title="Cargando catalogo" storeName="MundoBeat.cl" message="Cargando la musica..." />
            ) : products.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No se encontraron productos</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Desktop - Tabla */}
                <div className="hidden lg:block bg-white rounded-lg border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Producto</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Detalles</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Precio</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {products.map((product, index) => {
                        const thumbImage = getProductImageByIndex(product, 0, 'thumb');
                        const imageUrl = thumbImage ? getImageUrl(thumbImage) : null;
                        const isAboveFold = index < 10; // Primeras 10 filas
                        const isHighPriority = index < 5;

                        return (
                          <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                            {/* Columna 1: Imagen */}
                            <td className="px-4 py-4">
                              <Link href={`/productos/${product.slug || product.id}`}>
                                <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                  {imageUrl ? (
                                    <img 
                                      src={imageUrl} 
                                      alt={product.title}
                                      loading={isAboveFold ? "eager" : "lazy"}
                                      fetchPriority={isHighPriority ? "high" : "auto"}
                                      className="w-full h-full object-cover hover:scale-110 transition-transform"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                      📀
                                    </div>
                                  )}
                                </div>
                              </Link>
                            </td>

                            {/* Columna 2: Detalles */}
                            <td className="px-4 py-4">
                              <Link 
                                href={`/productos/${product.slug || product.id}`}
                                className="hover:text-purple-600 transition-colors"
                              >
                                <div className="font-semibold text-gray-900 mb-1">
                                  {product.title}
                                </div>
                              </Link>
                              <div className="text-sm text-gray-600 space-y-0.5">
                                {product.label && (
                                  <div>Sello: <span className="text-gray-900">{product.label}</span></div>
                                )}
                                {product.sku && (
                                  <div>Serie: <span className="text-gray-900">{product.sku}</span></div>
                                )}
                                {product.sleeveGrade && (
                                  <div>Condición Funda: <span className="px-2 py-0.5 bg-orange-100 text-orange-800 font-bold rounded text-xs">{product.sleeveGrade}</span></div>
                                )}
                                {product.mediaGrade && (
                                  <div>Condición Soporte: <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-xs">{product.mediaGrade}</span></div>
                                )}
                              </div>
                            </td>

                            {/* Columna 3: Precio */}
                            <td className="px-4 py-4 text-right">
                              <div className="font-bold text-xl text-gray-900">
                                ${formatPrice(product.isOnSale && product.salePrice ? product.salePrice : product.price)}
                              </div>
                              {product.isOnSale && product.salePrice && (
                                <div className="text-sm text-gray-400 line-through">
                                  ${formatPrice(product.price)}
                                </div>
                              )}
                              {(product.vendor?.storeName || product.vendorName) && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Vendido por: <span className="text-gray-700 font-medium">{product.vendor?.storeName || product.vendorName}</span>
                                </div>
                              )}
                            </td>

                            {/* Columna 4: Acción */}
                            <td className="px-4 py-4 text-center">
                              <Button
                                onClick={() => handleAddToCart(product)}
                                disabled={product.stock === 0}
                                size="sm"
                                className="whitespace-nowrap"
                              >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Añadir
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile - Cards */}
                <div className="lg:hidden space-y-4">
                  {products.map((product, index) => {
                    const thumbImage = getProductImageByIndex(product, 0, 'thumb');
                    const imageUrl = thumbImage ? getImageUrl(thumbImage) : null;
                    const isAboveFold = index < 4;
                    const isHighPriority = index < 2;

                    return (
                      <Card key={product.id}>
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            {/* Imagen */}
                            <Link href={`/productos/${product.slug || product.id}`} className="flex-shrink-0">
                              <div className="w-24 h-24 bg-gray-100 rounded overflow-hidden">
                                {imageUrl ? (
                                  <img 
                                    src={imageUrl} 
                                    alt={product.title}
                                    loading={isAboveFold ? "eager" : "lazy"}
                                    fetchPriority={isHighPriority ? "high" : "auto"}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl">
                                    📀
                                  </div>
                                )}
                              </div>
                            </Link>

                            {/* Detalles */}
                            <div className="flex-1 min-w-0">
                              <Link 
                                href={`/productos/${product.slug || product.id}`}
                                className="font-semibold text-gray-900 hover:text-purple-600 line-clamp-2 mb-2"
                              >
                                {product.title}
                              </Link>
                              
                              <div className="text-sm text-gray-600 space-y-1 mb-3">
                                {product.label && <div>Sello: {product.label}</div>}
                                {(product.mediaGrade || product.sleeveGrade) && (
                                  <div className="flex gap-2">
                                    {product.mediaGrade && (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-xs">
                                        {product.mediaGrade}
                                      </span>
                                    )}
                                    {product.sleeveGrade && (
                                      <span className="px-2 py-0.5 bg-orange-100 text-orange-800 font-bold rounded text-xs">
                                        {product.sleeveGrade}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-bold text-lg text-gray-900">
                                    ${formatPrice(product.isOnSale && product.salePrice ? product.salePrice : product.price)}
                                  </div>
                                  {(product.vendor?.storeName || product.vendorName) && (
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      Vendido por: <span className="text-gray-700 font-medium">{product.vendor?.storeName || product.vendorName}</span>
                                    </div>
                                  )}
                                </div>
                                <Button
                                  onClick={() => handleAddToCart(product)}
                                  disabled={product.stock === 0}
                                  size="sm"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Product counter */}
                {products.length > 0 && (
                  <div className="py-4 text-center text-sm text-gray-600">
                    Mostrando {((page - 1) * PRODUCTS_PER_PAGE) + 1}-{Math.min(page * PRODUCTS_PER_PAGE, totalCount)} de {totalCount} productos
                  </div>
                )}

                {/* Load More Button */}
                {hasMore && products.length > 0 && (
                  <div className="py-8 text-center">
                    <Button
                      onClick={() => {
                        setPage(prev => prev + 1);
                        setLoadingMore(true);
                        loadProducts(false);
                      }}
                      disabled={loadingMore}
                      className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                    >
                      {loadingMore ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                          Cargando...
                        </>
                      ) : (
                        `Cargar ${Math.min(PRODUCTS_PER_PAGE, totalCount - products.length)} más productos`
                      )}
                    </Button>
                  </div>
                )}

                {/* Pagination links */}
                {totalCount > PRODUCTS_PER_PAGE && (
                  <div className="flex justify-center items-center gap-2 py-8 flex-wrap">
                    <Button
                      onClick={() => {
                        setPage(1);
                        setProducts([]);
                        loadProducts(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={page === 1}
                      variant="outline"
                      size="sm"
                    >
                      Primera
                    </Button>
                    
                    {Array.from({ length: Math.ceil(totalCount / PRODUCTS_PER_PAGE) }, (_, i) => i + 1)
                      .filter(pageNum => {
                        const totalPages = Math.ceil(totalCount / PRODUCTS_PER_PAGE);
                        // Show first page, last page, current page, and 2 pages around current
                        return pageNum === 1 || 
                               pageNum === totalPages || 
                               Math.abs(pageNum - page) <= 2;
                      })
                      .map((pageNum, index, array) => {
                        // Add ellipsis if there's a gap
                        const prevPageNum = array[index - 1];
                        const showEllipsis = prevPageNum && pageNum - prevPageNum > 1;
                        
                        return (
                          <div key={pageNum} className="flex items-center gap-2">
                            {showEllipsis && <span className="text-gray-400">...</span>}
                            <Button
                              onClick={() => {
                                setPage(pageNum);
                                setProducts([]);
                                loadProducts(true);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              variant={page === pageNum ? "default" : "outline"}
                              size="sm"
                              className={page === pageNum ? "bg-purple-600 hover:bg-purple-700" : ""}
                            >
                              {pageNum}
                            </Button>
                          </div>
                        );
                      })}
                    
                    <Button
                      onClick={() => {
                        const totalPages = Math.ceil(totalCount / PRODUCTS_PER_PAGE);
                        setPage(totalPages);
                        setProducts([]);
                        loadProducts(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={page >= Math.ceil(totalCount / PRODUCTS_PER_PAGE)}
                      variant="outline"
                      size="sm"
                    >
                      Última
                    </Button>
                  </div>
                )}

                {!hasMore && products.length > 0 && totalCount <= PRODUCTS_PER_PAGE && (
                  <p className="text-center text-gray-500 text-sm py-8">Todos los productos mostrados</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {settings?.footerConfig && (
        <StoreFooter footerConfig={settings.footerConfig} />
      )}
    </div>
  );
}
