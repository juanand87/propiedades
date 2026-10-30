"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/imageUtils";
import Link from "next/link";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import Banner from "@/components/Banner";
import { getBannersByPosition } from "@/lib/shouldShowBanner";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/contexts/CartContext";
import { getProductUrl } from "@/lib/useCustomDomain";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Eye, ShoppingCart, X } from "lucide-react";
import MusicPreloader from "@/components/MusicPreloader";

export default function ProductosPage() {
  const params = useParams();
  const slug = params.slug as string;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // These are used for UI rendering (title, banners). The API call reads from
  // window.location.search directly inside loadData to avoid SSR hydration issues.
  const condition = searchParams.get('condition') || '';
  const search = searchParams.get('search') || '';
  const advancedArtist = searchParams.get('artist') || '';
  const advancedFormat = searchParams.get('format') || '';
  const advancedGenre = searchParams.get('genre') || '';
  const advancedCountry = searchParams.get('country') || '';
  const isOnSale = searchParams.get('isOnSale') === 'true';
  const { addItem } = useCart();
  const { trackPageView, trackAddToCart } = useAnalytics();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [genreName, setGenreName] = useState<string>("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [previewProduct, setPreviewProduct] = useState<any>(null);

  // Helper para parsear imágenes
  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    try {
      return JSON.parse(images);
    } catch {
      return [];
    }
  };
  const stripHtml = (value: any) => {
    if (!value || typeof value !== "string") return "";
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  };

  const getPreviewDescription = (product: any) => {
    const text = stripHtml(product?.shortDescription || product?.short_description || product?.description);
    if (!text) return "";
    return text.length > 220 ? `${text.slice(0, 220).trim()}...` : text;
  };

  const getConditionLabel = (product: any) => {
    const base = product?.condition === "new"
      ? "Nuevo / Sellado"
      : product?.condition === "used"
        ? "Usado"
        : "Condicion especial";
    const grades = [product?.mediaGrade, product?.sleeveGrade].filter(Boolean).join(" / ");
    return grades ? `${base} (${grades})` : base;
  };

  useEffect(() => {
    if (slug) {
      loadData();
    }
  // Re-run when the search string changes (covers all query param changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, searchParams.toString()]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Always read from window.location.search at execution time to bypass
      // React hydration timing issues with useSearchParams().
      const urlParams = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams('');
      const filterCondition = urlParams.get('condition') || '';
      const filterCategoryId = urlParams.get('categoryId') || '';
      const filterGenreId = urlParams.get('genreId') || '';
      const filterSearch = urlParams.get('search') || '';
      const filterArtist = urlParams.get('artist') || '';
      const filterFormat = urlParams.get('format') || '';
      const filterGenre = urlParams.get('genre') || '';
      const filterCountry = urlParams.get('country') || '';
      const filterIsOnSale = urlParams.get('isOnSale') === 'true';

      // Guardar filtros activos para el título
      setActiveFilters(Object.fromEntries(urlParams.entries()));

      // Cargar vendor
      const foundVendor = await api.getVendorBySlug(slug);
      setVendor(foundVendor);

      // Cargar settings
      const vendorSettings = await api.getVendorSettings(foundVendor.id, false);
      setSettings(vendorSettings);

      trackPageView(undefined, foundVendor.id);

      // Aplicar tema de colores
      if (vendorSettings?.colorTheme) {
        const { applyThemeToDocument } = await import('@/lib/colorThemes');
        applyThemeToDocument(vendorSettings.colorTheme, vendorSettings.customColors);
      }

      // Construir filtros
      const filters: any = { vendorId: foundVendor.id };
      if (filterCondition) filters.condition = filterCondition;
      if (filterCategoryId) filters.categoryId = filterCategoryId;
      if (filterGenreId) filters.genreId = filterGenreId;
      if (filterSearch) filters.search = filterSearch;
      if (filterArtist) filters.artist = filterArtist;
      if (filterFormat) filters.format = filterFormat;
      if (filterGenre) filters.genre = filterGenre;
      if (filterCountry) filters.country = filterCountry;
      if (filterIsOnSale) filters.isOnSale = true;

      console.log('🔍 [ProductosPage] Loading products with filters:', filters);

      // Cargar productos
      const productsData = await api.getProducts(filters);
      let productsList = Array.isArray(productsData)
        ? productsData
        : (productsData.products || productsData.data || []);

      // Filtros de seguridad en cliente (garantizan el resultado aunque el backend no filtre)
      if (filterIsOnSale) {
        productsList = productsList.filter(
          (p: any) => !!p.isOnSale && p.salePrice && Number(p.salePrice) > 0
        );
      }
      if (filterGenreId) {
        productsList = productsList.filter(
          (p: any) => Array.isArray(p.genres) && p.genres.some((g: any) => g.id?.toString() === filterGenreId)
        );
      }
      if (filterCategoryId) {
        productsList = productsList.filter(
          (p: any) => Array.isArray(p.categories) && p.categories.some((c: any) => c.id?.toString() === filterCategoryId)
        );
      }
      if (filterCondition) {
        productsList = productsList.filter((p: any) => p.condition === filterCondition);
      }

      // Extraer nombre del género desde los productos filtrados
      if (filterGenreId && productsList.length > 0) {
        for (const p of productsList) {
          const g = (p.genres || []).find((g: any) => g.id?.toString() === filterGenreId);
          if (g?.name) { setGenreName(g.name); break; }
        }
      } else if (filterGenreId) {
        // No hay productos pero si hay genreId, buscar el nombre desde todos los géneros
        try {
          const allGenres = await api.getGenres();
          const genres = Array.isArray(allGenres) ? allGenres : (allGenres.genres || []);
          const found = genres.find((g: any) => g.id?.toString() === filterGenreId);
          if (found?.name) setGenreName(found.name);
        } catch { setGenreName(''); }
      } else {
        setGenreName('');
      }

      console.log('🔍 [ProductosPage] Products loaded:', productsList.length);
      setProducts(productsList);
      setLoading(false);
    } catch (error: any) {
      console.error("Error loading products:", error);
      setError(error.message || "Error al cargar productos");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white/80 flex items-center justify-center">
        <MusicPreloader title="Cargando productos" storeName={vendor?.storeName || vendor?.name || slug || "MundoBeat.cl"} />
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{error || "Tienda no encontrada"}</p>
            <Link
              href={`/tiendas/${slug}`}
              className="inline-block px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all"
            >
              Volver a la tienda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const headerType = settings?.headerType
    ? (typeof settings.headerType === "number" ? `type${settings.headerType}` : settings.headerType)
    : "type1";
  const headerConfig = {
    ...(settings?.headerConfig || {}),
    menus: settings?.menus || {},
    customMenus: settings?.customMenus || {},
    headerConfig: settings?.headerConfig || {},
  };

  // Get banners by position
  const bannersByPosition = getBannersByPosition(
    settings?.banners || [],
    pathname,
    slug,
    undefined, // genreSlug
    undefined, // categorySlug
    condition || undefined // condition from query params
  );

  const renderHeader = () => {
    switch (headerType) {
      case "type1":
        return <HeaderType1 vendor={vendor} config={headerConfig} slug={slug} />;
      case "type2":
        return <HeaderType2 vendor={vendor} config={headerConfig} slug={slug} />;
      case "type3":
        return <HeaderType3 vendor={vendor} config={headerConfig} slug={slug} />;
      default:
        return <HeaderType1 vendor={vendor} config={headerConfig} slug={slug} />;
    }
  };

  // Determinar título según filtros
  // Lee desde activeFilters (poblado desde window.location.search en loadData) para
  // evitar el problema de SSR hydration con useSearchParams().
  const filterIsOnSaleUI = activeFilters.isOnSale === 'true';
  const filterGenreIdUI = activeFilters.genreId || '';
  const filterConditionUI = activeFilters.condition || '';
  const filterSearchUI = activeFilters.search || '';

  let pageTitle = 'Productos';
  if (filterIsOnSaleUI) pageTitle = '💸 Ofertas';
  else if (filterGenreIdUI) pageTitle = genreName ? `🎵 ${genreName}` : '🎵 Por Género';
  else if (filterConditionUI === 'new') pageTitle = 'Productos Nuevos';
  else if (filterConditionUI === 'used') pageTitle = 'Productos Usados';
  else if (filterSearchUI) pageTitle = `Resultados para "${filterSearchUI}"`;

  // Grid columns
  const gridColumns = 5;
  const gridClassMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  };
  const gridClass = gridClassMap[gridColumns] || gridClassMap[5];

  return (
    <div className="min-h-screen" style={{ backgroundColor: settings?.colors?.background || "#ffffff" }}>
      {renderHeader()}

      {/* Top Banners */}
      {bannersByPosition.top.map((banner, index) => (
        <Banner
          key={`top-${index}`}
          type={banner.type}
          config={banner.config}
          vendorSlug={slug}
          vendorSettings={settings}
          deviceVisibility={banner.deviceVisibility}
        />
      ))}

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href={`/tiendas/${slug}`} className="theme-text hover:underline">
            ← Volver a la tienda
          </Link>
        </div>

        {/* Título */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{pageTitle}</h1>
          <p className="text-gray-600">
            {products.length} {products.length === 1 ? "producto encontrado" : "productos encontrados"}
          </p>
        </div>

        {/* Middle Banners */}
        {bannersByPosition.middle.map((banner, index) => (
          <div key={`middle-${index}`} className="mb-6">
            <Banner
              type={banner.type}
              config={banner.config}
              vendorSlug={slug}
              vendorSettings={settings}
              deviceVisibility={banner.deviceVisibility}
            />
          </div>
        ))}

        {/* Grid de productos */}
        {products.length > 0 ? (
          <div className={`grid ${gridClass} gap-6`}>
            {products.map((product) => {
              const images = parseImages(product.images);
              const imageUrl = images.length > 0
                ? getImageUrl(typeof images[0] === "string" ? images[0] : images[0].url)
                : null;
              const secondImageUrl = images.length > 1
                ? getImageUrl(typeof images[1] === "string" ? images[1] : images[1].url)
                : null;
              const hasRollover = settings?.imageRolloverEnabled && secondImageUrl;

              const displayPrice = product.isOnSale && product.salePrice ? product.salePrice : product.price;

              return (
                <Card key={product.id} className="overflow-hidden transition-shadow hover:shadow-xl h-full flex flex-col group">
                  <div className="relative w-full aspect-square overflow-hidden rounded-t-lg">
                    <Link href={getProductUrl(product, slug)}>
                      <div className="absolute inset-0 cursor-pointer">
                        {imageUrl ? (
                          <>
                            <img
                              src={imageUrl}
                              alt={product.title}
                              className={`w-full h-full object-cover transition-opacity duration-300 ${
                                hasRollover ? 'group-hover:opacity-0' : ''
                              }`}
                            />
                            {hasRollover && (
                              <img
                                src={secondImageUrl}
                                alt={`${product.title} - Vista 2`}
                                className="absolute top-0 left-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                              />
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                            <span className="text-gray-400 text-4xl">Music</span>
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="hidden md:flex absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 gap-1">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPreviewProduct(product);
                        }}
                        className="bg-gray-800/95 hover:bg-gray-900 text-white font-semibold py-3 px-4 transition-colors backdrop-blur-sm flex items-center justify-center"
                        title="Vista rapida"
                      >
                        <Eye className="w-4 h-4 flex-shrink-0" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          trackAddToCart(product.id, 1, vendor?.id);
                          addItem({
                            productId: product.id,
                            title: product.title,
                            artist: product.artist,
                            price: displayPrice,
                            imageUrl: imageUrl || undefined,
                            stock: product.stock || 1,
                            vendorId: vendor.id,
                            vendorSlug: slug,
                          });
                        }}
                        disabled={!product.stock || product.stock <= 0}
                        className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed backdrop-blur-sm flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </div>

                  <div className="md:hidden flex">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPreviewProduct(product);
                      }}
                      className="w-12 bg-gray-800 hover:bg-gray-900 text-white py-3 transition-colors flex items-center justify-center"
                      aria-label="Vista rapida"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        trackAddToCart(product.id, 1, vendor?.id);
                        addItem({
                          productId: product.id,
                          title: product.title,
                          artist: product.artist,
                          price: displayPrice,
                          imageUrl: imageUrl || undefined,
                          stock: product.stock || 1,
                          vendorId: vendor.id,
                          vendorSlug: slug,
                        });
                      }}
                      disabled={!product.stock || product.stock <= 0}
                      className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 text-sm transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>Agregar</span>
                    </button>
                  </div>

                  <CardContent className="p-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-sm text-gray-900 mb-2 line-clamp-2">
                      {product.title}
                    </h3>
                    <div className="flex items-center justify-between mt-auto">
                      {product.isOnSale && product.salePrice ? (
                        <div className="flex flex-col">
                          <span className="text-lg md:text-xl font-bold theme-text">
                            ${Math.round(Number(product.salePrice)).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-sm text-gray-500 line-through">
                            ${Math.round(product.price || 0).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-lg md:text-xl font-bold theme-text">
                          ${Math.round(product.price || 0).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No se encontraron productos con estos filtros.</p>
            <Link
              href={`/tiendas/${slug}`}
              className="inline-block mt-4 px-6 py-2 theme-gradient-bg text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Ver todos los productos
            </Link>
          </div>
        )}
      </div>
      {previewProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">Vista rapida</h2>
              <button onClick={() => setPreviewProduct(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid md:grid-cols-[minmax(220px,0.85fr)_1.15fr] gap-6 p-6">
              <div className="aspect-square md:aspect-[4/3] md:max-h-[360px] bg-gray-100 rounded-lg overflow-hidden">
                {(() => {
                  const images = parseImages(previewProduct.images);
                  const imageUrl = images.length > 0
                    ? getImageUrl(typeof images[0] === "string" ? images[0] : images[0].url)
                    : null;
                  return imageUrl ? (
                    <img src={imageUrl} alt={previewProduct.title} className="w-full h-full object-contain bg-gray-100" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-5xl">Music</div>
                  );
                })()}
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{previewProduct.title}</h3>
                  {previewProduct.artist && <p className="text-gray-600 mt-1">{previewProduct.artist}</p>}
                </div>
                <div className="text-3xl font-bold theme-text">
                  ${Math.round(Number(previewProduct.isOnSale && previewProduct.salePrice ? previewProduct.salePrice : previewProduct.price) || 0).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Condicion</p>
                    <p className="font-medium text-gray-900">{getConditionLabel(previewProduct)}</p>
                  </div>
                  {getPreviewDescription(previewProduct) && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Descripcion corta</p>
                      <p className="text-gray-700 leading-relaxed">{getPreviewDescription(previewProduct)}</p>
                    </div>
                  )}
                </div>
                {previewProduct.stock > 0 ? (
                  <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">Stock disponible: {previewProduct.stock}</p>
                ) : (
                  <p className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded">Sin stock</p>
                )}
                <div className="flex gap-3 pt-2">
                  <Link
                    href={getProductUrl(previewProduct, slug)}
                    className="flex-1 border theme-border theme-text text-center font-semibold py-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Ver producto
                  </Link>
                  <button
                    onClick={() => {
                      const images = parseImages(previewProduct.images);
                      const imageUrl = images.length > 0
                        ? getImageUrl(typeof images[0] === "string" ? images[0] : images[0].url)
                        : undefined;
                      trackAddToCart(previewProduct.id, 1, vendor?.id);
                      addItem({
                        productId: previewProduct.id,
                        title: previewProduct.title,
                        artist: previewProduct.artist,
                        price: previewProduct.isOnSale && previewProduct.salePrice ? previewProduct.salePrice : previewProduct.price,
                        imageUrl,
                        stock: previewProduct.stock || 1,
                        vendorId: vendor.id,
                        vendorSlug: slug,
                      });
                      setPreviewProduct(null);
                    }}
                    disabled={!previewProduct.stock || previewProduct.stock <= 0}
                    className="flex-1 theme-gradient-bg text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Bottom Banners */}
      {bannersByPosition.bottom.map((banner, index) => (
        <Banner
          key={`bottom-${index}`}
          type={banner.type}
          config={banner.config}
          vendorSlug={slug}
          vendorSettings={settings}
          deviceVisibility={banner.deviceVisibility}
        />
      ))}

      {settings?.footerConfig && (
        <StoreFooter
          footerConfig={settings.footerConfig}
          vendorSlug={slug}
        />
      )}
    </div>
  );
}
