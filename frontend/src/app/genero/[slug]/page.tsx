"use client";

import { useState, useEffect } from "react";
import { useParams, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import CatalogFilters from "@/components/CatalogFilters";
import { applyThemeToDocument } from "@/lib/colorThemes";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";
import { shouldShowFilterSidebar } from "@/lib/filterVisibility";
import { ChevronDown } from "lucide-react";
import LateralMenu, { shouldShowLateralMenu } from "@/components/LateralMenu";

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

export default function GeneroPage() {
  const params = useParams();
  const pathname = usePathname();
  const generoSlug = params.slug as string;
  const { addItem } = useCart();
  
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [genero, setGenero] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [filters, setFilters] = useState({
    format: [] as string[],
    genre: [] as string[],
    mediaGrade: [] as string[],
    sleeveGrade: [] as string[],
  });
  const [availableFilters, setAvailableFilters] = useState({
    formats: [] as { label: string; count: number; value: string }[],
    genres: [] as { label: string; count: number; value: string }[],
    mediaGrades: [] as { label: string; count: number; value: string }[],
    sleeveGrades: [] as { label: string; count: number; value: string }[],
  });
  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 24;

  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    
    if (typeof images === 'string') {
      if (images.startsWith('http') || images.startsWith('/')) {
        return [{ url: images, isPrimary: true }];
      }
      try {
        const parsed = JSON.parse(images);
        return Array.isArray(parsed) ? parsed : [{ url: parsed, isPrimary: true }];
      } catch {
        return images.split(',').filter(Boolean).map((url: string, index: number) => ({
          url: url.trim(),
          isPrimary: index === 0
        }));
      }
    }
    
    return [];
  };

  useEffect(() => {
    if (generoSlug) {
      loadGeneroProducts();
    }
  }, [generoSlug]);

  const loadGeneroProducts = async () => {
    try {
      setLoading(true);
      
      // Detect custom domain to load the right vendor settings
      let currentVendorId = MARKETPLACE_VENDOR_ID;
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const isCustomDomain =
          hostname !== 'localhost' &&
          hostname !== '127.0.0.1' &&
          hostname !== 'mundobeat.cl' &&
          hostname !== 'www.mundobeat.cl' &&
          !hostname.includes('vercel.app') &&
          !hostname.endsWith('.mundobeat.cl');
        if (isCustomDomain) {
          try {
            const domainVendor = await api.getVendorByDomain(hostname);
            if (domainVendor) {
              setVendor(domainVendor);
              currentVendorId = domainVendor.id;
            }
          } catch (e) {
            console.warn('⚠️ Could not find vendor for custom domain:', hostname);
          }
        }
      }

      const marketplaceSettings = await api.getVendorSettings(currentVendorId, false);
      setSettings(marketplaceSettings);

      if (marketplaceSettings?.colorTheme) {
        applyThemeToDocument(marketplaceSettings.colorTheme, marketplaceSettings.customColors);
      }

      const generosData = await api.getGenres();
      const generos = Array.isArray(generosData) ? generosData : (generosData.genres || []);
      
      const foundGenero = generos.find((g: any) => g.slug === generoSlug);
      
      if (!foundGenero) {
        setError("Género no encontrado");
        setLoading(false);
        return;
      }
      
      setGenero(foundGenero);

      const productsData = await api.getProducts({ 
        marketplaceOnly: true,
        genreId: foundGenero.id
      });
      
      const productsList = Array.isArray(productsData) 
        ? productsData 
        : (productsData.products || productsData.data || []);
      
      setAllProducts(productsList);
      setProducts(productsList);
      calculateAvailableFilters(productsList);
      // Pre-seleccionar el género actual en el filtro
      setFilters(prev => ({ ...prev, genre: [foundGenero.id.toString()] }));
      setLoading(false);
    } catch (error: any) {
      console.error("Error loading genero products:", error);
      setError(error.message || "Error al cargar los productos");
      setLoading(false);
    }
  };

  const calculateAvailableFilters = (productList: any[]) => {
    const formatMap = new Map<string, { id: string; name: string; count: number }>();
    const genreMap = new Map<string, { id: string; name: string; count: number }>();
    const mediaGrades = new Map<string, number>();
    const sleeveGrades = new Map<string, number>();

    productList.forEach((product) => {
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
      if (product.mediaGrade) {
        mediaGrades.set(product.mediaGrade, (mediaGrades.get(product.mediaGrade) || 0) + 1);
      }
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
  };

  const toggleFilter = (category: keyof typeof filters, value: string) => {
    setFilters((prev) => {
      const currentFilters = prev[category];
      const newFilters = currentFilters.includes(value)
        ? currentFilters.filter((v) => v !== value)
        : [...currentFilters, value];

      const updatedFilters = { ...prev, [category]: newFilters };

      // Si cambia el filtro de género, re-cargar productos para los géneros seleccionados
      if (category === 'genre') {
        loadProductsForGenres(newFilters, updatedFilters);
      } else {
        applyFilters(updatedFilters);
      }
      return updatedFilters;
    });
  };

  const loadProductsForGenres = async (genreIds: string[], activeFilters: typeof filters) => {
    try {
      let productsList: any[];
      if (genreIds.length === 0) {
        // Sin género seleccionado: mostrar todos los productos del marketplace
        const data = await api.getProducts({ marketplaceOnly: true });
        productsList = Array.isArray(data) ? data : (data.products || data.data || []);
      } else if (genreIds.length === 1) {
        // Un solo género: usar genreId
        const data = await api.getProducts({ marketplaceOnly: true, genreId: genreIds[0] });
        productsList = Array.isArray(data) ? data : (data.products || data.data || []);
      } else {
        // Múltiples géneros: cargar cada uno y combinar
        const results = await Promise.all(
          genreIds.map(id => api.getProducts({ marketplaceOnly: true, genreId: id }))
        );
        const combined = results.flatMap(r => Array.isArray(r) ? r : (r.products || r.data || []));
        // Deduplicar por id
        const seen = new Set<string>();
        productsList = combined.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      }
      setAllProducts(productsList);
      calculateAvailableFilters(productsList);
      applyFilters({ ...activeFilters, genre: genreIds }, productsList);
    } catch (err) {
      console.error('Error re-fetching products for genres:', err);
    }
  };

  const applyFilters = (activeFilters: typeof filters, baseProducts?: any[]) => {
    let filtered = [...(baseProducts ?? allProducts)];

    if (activeFilters.format.length > 0) {
      filtered = filtered.filter((p) => 
        p.formats && Array.isArray(p.formats) && 
        p.formats.some((f: any) => activeFilters.format.includes(f.id.toString()))
      );
    }
    if (activeFilters.genre.length > 0) {
      filtered = filtered.filter((p) => 
        p.genres && Array.isArray(p.genres) && 
        p.genres.some((g: any) => activeFilters.genre.includes(g.id.toString()))
      );
    }
    if (activeFilters.mediaGrade.length > 0) {
      filtered = filtered.filter((p) => activeFilters.mediaGrade.includes(p.mediaGrade));
    }
    if (activeFilters.sleeveGrade.length > 0) {
      filtered = filtered.filter((p) => activeFilters.sleeveGrade.includes(p.sleeveGrade));
    }

    setProducts(filtered);
  };

  const shouldShowFilters = () => {
    return shouldShowFilterSidebar(
      settings?.filters,
      pathname,
      'marketplace',
      {
        isGenrePage: true,
      }
    );
  };

  const goldmineOrder = ['M', 'NM', 'NM or M-', 'VG+', 'VG', 'G+', 'G', 'P'];
  const filterSidebarPosition = settings?.filters?.position || "left";

  const renderHeader = () => {
    if (!settings) return null;

    const headerVendor = {
      id: vendor?.id || MARKETPLACE_VENDOR_ID,
      slug: vendor?.slug || "marketplace",
      storeName: settings?.storeName || vendor?.storeName || "Marketplace",
      phone: settings?.phone || "",
      email: settings?.email || ""
    };

    const headerType = settings?.headerType 
      ? (typeof settings.headerType === 'number' ? `type${settings.headerType}` : settings.headerType)
      : "type1";

    switch (headerType) {
      case "type1":
        return <HeaderType1 vendor={headerVendor} config={settings || {}} slug={headerVendor.slug} />;
      case "type2":
        return <HeaderType2 vendor={headerVendor} config={settings || {}} slug={headerVendor.slug} />;
      case "type3":
        return <HeaderType3 vendor={headerVendor} config={settings || {}} slug={headerVendor.slug} />;
      default:
        return <HeaderType1 vendor={headerVendor} config={settings || {}} slug={headerVendor.slug} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando género...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        {renderHeader()}
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const gridColumns = settings?.productGridColumns || 4;

  const vendorSlug = vendor?.slug || 'marketplace';
  const showLateralMenu = settings?.menus?.lateral
    ? shouldShowLateralMenu(settings.menus.lateral, pathname, vendorSlug, undefined, undefined, generoSlug)
    : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {renderHeader()}

      <div className="container mx-auto px-4 py-8">
        <div className={`flex gap-6 ${showLateralMenu ? 'lg:flex-row' : ''}`}>
          {/* Menú Lateral */}
          {showLateralMenu && (
            <aside className={`hidden lg:block ${settings.menus.lateral.position === 'left' ? 'lg:order-1' : 'lg:order-2'} lg:w-64 flex-shrink-0`}>
              <div className="sticky top-4">
                <LateralMenu config={settings.menus.lateral} vendorSlug={vendorSlug} />
              </div>
            </aside>
          )}

          {/* Contenido Principal */}
          <div className={`${showLateralMenu ? (settings.menus.lateral.position === 'left' ? 'lg:order-2' : 'lg:order-1') + ' lg:flex-1 min-w-0' : 'w-full'}`}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: settings?.colors?.primary || '#8B5CF6' }}>
            🎵 Género: {genero?.name}
          </h1>
          {genero?.description && (
            <p className="text-gray-600 mt-2">{genero.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            {products.length} {products.length === 1 ? 'producto' : 'productos'}
          </p>
        </div>

        <div className={`flex flex-col lg:flex-row gap-8 ${filterSidebarPosition === 'right' ? 'lg:flex-row-reverse' : ''}`}>
          {/* Sidebar de Filtros - Desktop */}
          {shouldShowFilters() && (
            <aside className="hidden lg:block lg:w-64 flex-shrink-0">
              <CatalogFilters
                filters={filters}
                availableFilters={availableFilters}
                onFilterChange={toggleFilter}
                goldmineOrder={goldmineOrder}
              />
            </aside>
          )}

          {/* Filtros Mobile - Colapsables */}
          {shouldShowFilters() && (
            <div className="lg:hidden">
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

            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No hay productos en este género</p>
              </div>
            ) : (
              <>
                {/* Product counter */}
                <div className="py-4 text-center text-sm text-gray-600">
                  Mostrando {((currentPage - 1) * PRODUCTS_PER_PAGE) + 1}-{Math.min(currentPage * PRODUCTS_PER_PAGE, products.length)} de {products.length} productos
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-${gridColumns} gap-6`}>
                  {products
                    .slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE)
                    .map((product, index) => {
                  const primaryImage = getProductImageByIndex(product, 0, 'thumb');
                  const secondImage = getProductImageByIndex(product, 1, 'thumb');
                  const hasRollover = settings?.imageRolloverEnabled && secondImage;
                  const isAboveFold = index < 8;
                  const isHighPriority = index < 4;
                  
                  return (
                    <Card key={product.id} className="hover:shadow-lg transition-shadow h-full flex flex-col group">
                      <CardContent className="p-0 flex flex-col h-full">
                        <div className="relative w-full aspect-square rounded-t-lg">
                          {/* overflow-hidden interno: recorta botones animados */}
                          <div className="absolute inset-0 overflow-hidden rounded-t-lg">
                            <Link href={`/productos/${product.slug || product.id}`}>
                              <div className="absolute inset-0 cursor-pointer">
                                {primaryImage ? (
                                  <>
                                    <img 
                                      src={getImageUrl(primaryImage)}
                                      alt={product.title}
                                      loading={isAboveFold ? "eager" : "lazy"}
                                      fetchPriority={isHighPriority ? "high" : "auto"}
                                      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                                        hasRollover ? 'group-hover:opacity-0' : ''
                                      }`}
                                    />
                                    {hasRollover && (
                                      <img 
                                        src={getImageUrl(secondImage)}
                                        alt={`${product.title} - Vista 2`}
                                        loading="lazy"
                                        fetchPriority="low"
                                        className="absolute inset-0 h-full w-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                      />
                                    )}
                                  </>
                                ) : (
                                  <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                                    <span className="text-4xl">🎵</span>
                                  </div>
                                )}
                              </div>
                            </Link>
                            
                            <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  addItem({
                                    productId: product.id,
                                    title: product.title,
                                    artist: product.artist,
                                    price: product.price,
                                    imageUrl: primaryImage ? getImageUrl(primaryImage) : undefined,
                                    stock: product.stock || 1,
                                    vendorId: product.vendor?.id || product.vendorId || MARKETPLACE_VENDOR_ID,
                                    vendorSlug: product.vendor?.slug || product.vendorSlug || 'marketplace',
                                  });
                                }}
                                disabled={!product.stock || product.stock <= 0}
                                className="w-full bg-purple-600/95 hover:bg-purple-700 text-white font-semibold py-3 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed backdrop-blur-sm"
                              >
                                <span className="hidden md:inline">
                                  {!product.stock || product.stock <= 0 ? 'Sin stock' : 'Agregar al carrito'}
                                </span>
                                <span className="md:hidden">
                                  {!product.stock || product.stock <= 0 ? 'Sin stock' : 'Agregar'}
                                </span>
                              </button>
                            </div>
                          </div>

                          {/* Category Badge - fuera del overflow-hidden para que sea visible */}
                          {(product as any).categoryIcon && (
                            <div className="absolute top-2 right-2 bg-white/90 shadow-md rounded-lg p-2 z-20 group/badge">
                              {(product as any).categoryIcon.startsWith('/') || (product as any).categoryIcon.startsWith('http') ? (
                                <img src={getImageUrl((product as any).categoryIcon)} alt={(product as any).category || ''} className={`w-6 h-6 object-contain${/vinilo|vinyl/i.test((product as any).category || '') ? ' disc-spin' : ''}`} />
                              ) : (
                                <span className={`text-xl${(product as any).categoryIcon === '💿' ? ' disc-spin' : ''}`}>{(product as any).categoryIcon}</span>
                              )}
                              {(product as any).category && (
                                <span className="pointer-events-none absolute hidden group-hover/badge:block bg-gray-800 text-white text-xs font-normal rounded px-2 py-1 whitespace-nowrap top-1/2 -translate-y-1/2 right-full mr-2 z-30">{(product as any).category}</span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="p-3 flex flex-col flex-1">
                          <Link href={`/productos/${product.slug || product.id}`}>
                            <h3 className="font-semibold text-sm mb-1 line-clamp-2 min-h-[2.5rem] hover:text-purple-600 cursor-pointer">{product.title}</h3>
                          </Link>
                          <p className="text-lg font-bold text-purple-600">
                            ${product.price?.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination controls */}
              {products.length > PRODUCTS_PER_PAGE && (
                <div className="flex justify-center items-center gap-2 py-8 flex-wrap">
                  <button
                    onClick={() => {
                      setCurrentPage(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Primera
                  </button>
                  
                  {Array.from({ length: Math.ceil(products.length / PRODUCTS_PER_PAGE) }, (_, i) => i + 1)
                    .filter(pageNum => {
                      const totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
                      return pageNum === 1 || 
                             pageNum === totalPages || 
                             Math.abs(pageNum - currentPage) <= 2;
                    })
                    .map((pageNum, index, array) => {
                      const prevPageNum = array[index - 1];
                      const showEllipsis = prevPageNum && pageNum - prevPageNum > 1;
                      
                      return (
                        <div key={pageNum} className="flex items-center gap-2">
                          {showEllipsis && <span className="text-gray-400">...</span>}
                          <button
                            onClick={() => {
                              setCurrentPage(pageNum);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className={`px-3 py-1 text-sm border rounded ${
                              currentPage === pageNum 
                                ? 'bg-purple-600 text-white border-purple-600' 
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        </div>
                      );
                    })}
                  
                  <button
                    onClick={() => {
                      const totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
                      setCurrentPage(totalPages);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentPage >= Math.ceil(products.length / PRODUCTS_PER_PAGE)}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Última
                  </button>
                </div>
              )}
            </>
            )}
          </div>
        </div>
          </div>{/* end Contenido Principal */}
        </div>{/* end flex lateral+content */}
      </div>

      {settings?.footerConfig ? (
        <StoreFooter footerConfig={settings.footerConfig} />
      ) : (
        <footer className="bg-gray-900 text-white py-8 mt-12">
          <div className="container mx-auto px-4 text-center">
            <p>© {new Date().getFullYear()} {settings?.storeName || 'Marketplace'}. Todos los derechos reservados.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
