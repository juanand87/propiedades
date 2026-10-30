"use client";

import { useState, useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
import { ChevronDown, Eye, ShoppingCart, X } from "lucide-react";
import LateralMenu, { shouldShowLateralMenu } from "@/components/LateralMenu";

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

function ProductosContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOnSale = searchParams.get("isOnSale") === "true";
  const condition = searchParams.get("condition") || "";
  const genreId = searchParams.get("genreId") || "";
  const categoryId = searchParams.get("categoryId") || "";
  const search = searchParams.get("search") || "";
  const advancedArtist = searchParams.get("artist") || "";
  const advancedFormat = searchParams.get("format") || "";
  const advancedGenre = searchParams.get("genre") || "";
  const advancedCountry = searchParams.get("country") || "";
  const { addItem } = useCart();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
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
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const PRODUCTS_PER_PAGE = 24;

  useEffect(() => {
    loadData();
  }, [isOnSale, condition, genreId, categoryId, search, advancedArtist, advancedFormat, advancedGenre, advancedCountry]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Always read from window.location.search at execution time to bypass any
      // React hydration timing issues with useSearchParams().
      const urlParams = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams("");
      const filterIsOnSale = urlParams.get("isOnSale") === "true";
      const filterCondition = urlParams.get("condition") || "";
      const filterGenreId = urlParams.get("genreId") || "";
      const filterCategoryId = urlParams.get("categoryId") || "";
      const filterSearch = urlParams.get("search") || "";
      const filterArtist = urlParams.get("artist") || "";
      const filterFormat = urlParams.get("format") || "";
      const filterGenre = urlParams.get("genre") || "";
      const filterCountry = urlParams.get("country") || "";

      // Detect custom domain to load the right vendor settings
      let currentVendorId = MARKETPLACE_VENDOR_ID;
      let foundVendor: any = null;
      if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        const isCustomDomain =
          hostname !== "localhost" &&
          hostname !== "127.0.0.1" &&
          hostname !== "mundobeat.cl" &&
          hostname !== "www.mundobeat.cl" &&
          !hostname.includes("vercel.app") &&
          !hostname.endsWith(".mundobeat.cl");
        if (isCustomDomain) {
          try {
            foundVendor = await api.getVendorByDomain(hostname);
            if (foundVendor) {
              setVendor(foundVendor);
              currentVendorId = foundVendor.id;
            }
          } catch (e) {
            console.warn("⚠️ Could not find vendor for custom domain:", hostname);
          }
        }
      }

      const vendorSettings = await api.getVendorSettings(currentVendorId, false);
      setSettings(vendorSettings);

      if (vendorSettings?.colorTheme) {
        applyThemeToDocument(vendorSettings.colorTheme, vendorSettings.customColors);
      }

      // Build product filters
      // On a custom domain, filter by vendorId directly (no marketplaceOnly needed).
      // On the marketplace, use marketplaceOnly: true.
      const productFilters: any = foundVendor?.id
        ? { vendorId: foundVendor.id }
        : { marketplaceOnly: true };
      if (filterIsOnSale) productFilters.isOnSale = true;
      if (filterCondition) productFilters.condition = filterCondition;
      if (filterGenreId) productFilters.genreId = filterGenreId;
      if (filterCategoryId) productFilters.categoryId = filterCategoryId;
      if (filterSearch) productFilters.search = filterSearch;
      if (filterArtist) productFilters.artist = filterArtist;
      if (filterFormat) productFilters.format = filterFormat;
      if (filterGenre) productFilters.genre = filterGenre;
      if (filterCountry) productFilters.country = filterCountry;

      console.log("🔍 [productos] filters applied:", productFilters);

      const productsData = await api.getProducts(productFilters);
      let productsList = Array.isArray(productsData)
        ? productsData
        : productsData.products || productsData.data || [];

      // Client-side safety filter: if filtering by offer, ensure products really have it
      if (filterIsOnSale) {
        productsList = productsList.filter(
          (p: any) => !!p.isOnSale && p.salePrice && Number(p.salePrice) > 0
        );
      }
      // Client-side safety filter for condition
      if (filterCondition) {
        productsList = productsList.filter((p: any) => p.condition === filterCondition);
      }

      setAllProducts(productsList);
      setProducts(productsList);
      calculateAvailableFilters(productsList);
      setLoading(false);
    } catch (err: any) {
      console.error("Error loading products:", err);
      setError(err.message || "Error al cargar los productos");
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
          if (existing) existing.count++;
          else formatMap.set(format.id.toString(), { id: format.id.toString(), name: format.name, count: 1 });
        });
      }
      if (product.genres && Array.isArray(product.genres)) {
        product.genres.forEach((genre: any) => {
          const existing = genreMap.get(genre.id.toString());
          if (existing) existing.count++;
          else genreMap.set(genre.id.toString(), { id: genre.id.toString(), name: genre.name, count: 1 });
        });
      }
      if (product.mediaGrade) mediaGrades.set(product.mediaGrade, (mediaGrades.get(product.mediaGrade) || 0) + 1);
      if (product.sleeveGrade) sleeveGrades.set(product.sleeveGrade, (sleeveGrades.get(product.sleeveGrade) || 0) + 1);
    });

    setAvailableFilters({
      formats: Array.from(formatMap.values()).map((f) => ({ label: f.name, count: f.count, value: f.id })),
      genres: Array.from(genreMap.values()).map((g) => ({ label: g.name, count: g.count, value: g.id })),
      mediaGrades: Array.from(mediaGrades.entries()).map(([label, count]) => ({ label, count, value: label })),
      sleeveGrades: Array.from(sleeveGrades.entries()).map(([label, count]) => ({ label, count, value: label })),
    });
  };

  const toggleFilter = (category: keyof typeof filters, value: string) => {
    setFilters((prev) => {
      const current = prev[category];
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      const updatedFilters = { ...prev, [category]: updated };
      applyLocalFilters(updatedFilters);
      return updatedFilters;
    });
  };

  const applyLocalFilters = (activeFilters: typeof filters) => {
    let filtered = [...allProducts];
    if (activeFilters.format.length > 0)
      filtered = filtered.filter((p) => p.formats?.some((f: any) => activeFilters.format.includes(f.id.toString())));
    if (activeFilters.genre.length > 0)
      filtered = filtered.filter((p) => p.genres?.some((g: any) => activeFilters.genre.includes(g.id.toString())));
    if (activeFilters.mediaGrade.length > 0)
      filtered = filtered.filter((p) => activeFilters.mediaGrade.includes(p.mediaGrade));
    if (activeFilters.sleeveGrade.length > 0)
      filtered = filtered.filter((p) => activeFilters.sleeveGrade.includes(p.sleeveGrade));
    setProducts(filtered);
    setCurrentPage(1);
  };

  const shouldShowFilters = () =>
    shouldShowFilterSidebar(settings?.filters, pathname, vendorSlug, { isCatalog: true });

  const goldmineOrder = ["M", "NM", "NM or M-", "VG+", "VG", "G+", "G", "P"];
  const filterSidebarPosition = settings?.filters?.position || "left";

  // Page title based on active filter
  const pageTitle = isOnSale
    ? "💸 Ofertas"
    : condition === "new"
    ? "✨ Productos Nuevos"
    : condition === "used"
    ? "♻️ Productos Usados"
    : search
    ? `🔍 "${search}"`
    : "🎵 Catálogo";

  const renderHeader = () => {
    if (!settings) return null;
    const headerVendor = {
      id: vendor?.id || MARKETPLACE_VENDOR_ID,
      slug: vendor?.slug || "marketplace",
      storeName: settings?.storeName || vendor?.storeName || "Marketplace",
      phone: settings?.phone || "",
      email: settings?.email || "",
    };
    const headerType =
      settings?.headerType
        ? typeof settings.headerType === "number"
          ? `type${settings.headerType}`
          : settings.headerType
        : "type1";
    switch (headerType) {
      case "type1": return <HeaderType1 vendor={headerVendor} config={settings || {}} slug={headerVendor.slug} />;
      case "type2": return <HeaderType2 vendor={headerVendor} config={settings || {}} slug={headerVendor.slug} />;
      case "type3": return <HeaderType3 vendor={headerVendor} config={settings || {}} slug={headerVendor.slug} />;
      default:      return <HeaderType1 vendor={headerVendor} config={settings || {}} slug={headerVendor.slug} />;
    }
  };

  const vendorSlug = vendor?.slug || "marketplace";
  const showLateralMenu = settings?.menus?.lateral
    ? shouldShowLateralMenu(settings.menus.lateral, pathname, vendorSlug)
    : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando productos...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        {renderHeader()}
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const gridColumns = (settings?.productGridColumns || 5) as number;
  
  // Map gridColumns to Tailwind classes (static for optimization)
  const gridColsClass: Record<number, string> = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
    6: "md:grid-cols-6",
  };
  const selectedGridClass = gridColsClass[gridColumns] || "md:grid-cols-5";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {renderHeader()}

      <div className="container mx-auto px-4 py-8">
        <div className={`flex gap-6 ${showLateralMenu ? "lg:flex-row" : ""}`}>
          {/* Menú Lateral */}
          {showLateralMenu && (
            <aside
              className={`hidden lg:block ${
                settings.menus.lateral.position === "left" ? "lg:order-1" : "lg:order-2"
              } lg:w-64 flex-shrink-0`}
            >
              <div className="sticky top-4">
                <LateralMenu config={settings.menus.lateral} vendorSlug={vendorSlug} />
              </div>
            </aside>
          )}

          {/* Contenido Principal */}
          <div
            className={`${
              showLateralMenu
                ? (settings.menus.lateral.position === "left" ? "lg:order-2" : "lg:order-1") +
                  " lg:flex-1 min-w-0"
                : "w-full"
            }`}
          >
            {/* Title */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold" style={{ color: settings?.colors?.primary || "#8B5CF6" }}>
                {pageTitle}
              </h1>
              <p className="text-sm text-gray-500 mt-2">
                {products.length} {products.length === 1 ? "producto" : "productos"}
              </p>
            </div>

            <div
              className={`flex flex-col lg:flex-row gap-8 ${
                filterSidebarPosition === "right" ? "lg:flex-row-reverse" : ""
              }`}
            >
              {/* Sidebar Filtros - Desktop */}
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

              {/* Filtros Mobile */}
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

              {/* Productos */}
              <div className="flex-1">
                {products.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No hay productos disponibles</p>
                  </div>
                ) : (
                  <>
                    <div className="py-4 text-center text-sm text-gray-600">
                      Mostrando {(currentPage - 1) * PRODUCTS_PER_PAGE + 1}–
                      {Math.min(currentPage * PRODUCTS_PER_PAGE, products.length)} de {products.length} productos
                    </div>

                    <div className={`grid grid-cols-1 ${selectedGridClass} gap-6`}>
                      {products
                        .slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE)
                        .map((product, index) => {
                          const primaryImage = getProductImageByIndex(product, 0, "thumb");
                          const secondImage = getProductImageByIndex(product, 1, "thumb");
                          const hasRollover = settings?.imageRolloverEnabled && secondImage;
                          const isAboveFold = index < 8;
                          const isHighPriority = index < 4;

                          const displayPrice =
                            product.isOnSale && product.salePrice ? product.salePrice : product.price;

                          return (
                            <Card key={product.id} className="hover:shadow-lg transition-shadow h-full flex flex-col group overflow-hidden max-w-full">
                              <CardContent className="p-0 flex flex-col h-full overflow-hidden">
                                <div className="relative w-full aspect-square shrink-0">
                                  <div className="absolute inset-0 overflow-hidden">
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
                                                hasRollover ? "group-hover:opacity-0" : ""
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
                                            <span className="text-4xl">Music</span>
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
                                        className="w-12 bg-gray-800/95 hover:bg-gray-900 text-white font-semibold py-3 transition-colors backdrop-blur-sm flex items-center justify-center"
                                        title="Vista previa"
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
                                            price: displayPrice,
                                            imageUrl: primaryImage ? getImageUrl(primaryImage) : undefined,
                                            stock: product.stock || 1,
                                            vendorId: product.vendor?.id || product.vendorId || MARKETPLACE_VENDOR_ID,
                                            vendorSlug: product.vendor?.slug || product.vendorSlug || "marketplace",
                                          });
                                        }}
                                        disabled={!product.stock || product.stock <= 0}
                                        className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed backdrop-blur-sm flex items-center justify-center gap-2"
                                      >
                                        <ShoppingCart className="w-4 h-4" />
                                        <span>Agregar</span>
                                      </button>
                                    </div>
                                  </div>

                                  {(product as any).categoryIcon && (
                                    <div className="absolute top-2 left-2 bg-white/90 shadow-md rounded-lg p-2 z-20 group/badge">
                                      {(product as any).categoryIcon.startsWith("/") ||
                                      (product as any).categoryIcon.startsWith("http") ? (
                                        <img
                                          src={getImageUrl((product as any).categoryIcon)}
                                          alt={(product as any).category || ""}
                                          className={`w-6 h-6 object-contain${
                                            /vinilo|vinyl/i.test((product as any).category || "") ? " disc-spin" : ""
                                          }`}
                                        />
                                      ) : (
                                        <span className="text-xl">
                                          {(product as any).categoryIcon}
                                        </span>
                                      )}
                                      {(product as any).category && (
                                        <span className="pointer-events-none absolute hidden group-hover/badge:block bg-gray-800 text-white text-xs font-normal rounded px-2 py-1 whitespace-nowrap top-1/2 -translate-y-1/2 left-full ml-2 z-30">
                                          {(product as any).category}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {product.isOnSale && product.salePrice && (
                                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md z-20">
                                      OFERTA
                                    </div>
                                  )}
                                </div>

                                <div className="md:hidden flex">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setPreviewProduct(product);
                                    }}
                                    className="w-12 bg-gray-800 hover:bg-gray-900 text-white py-3 transition-colors flex items-center justify-center"
                                    aria-label="Vista previa"
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
                                        price: displayPrice,
                                        imageUrl: primaryImage ? getImageUrl(primaryImage) : undefined,
                                        stock: product.stock || 1,
                                        vendorId: product.vendor?.id || product.vendorId || MARKETPLACE_VENDOR_ID,
                                        vendorSlug: product.vendor?.slug || product.vendorSlug || "marketplace",
                                      });
                                    }}
                                    disabled={!product.stock || product.stock <= 0}
                                    className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 text-sm transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    <ShoppingCart className="w-4 h-4" />
                                    <span>Agregar</span>
                                  </button>
                                </div>

                                <div className="p-2 md:p-3 flex flex-col flex-1">
                                  <Link href={`/productos/${product.slug || product.id}`}>
                                    <h3 className="font-semibold text-sm leading-tight md:text-sm mb-1 line-clamp-2 text-gray-900 hover:opacity-80 cursor-pointer">
                                      {product.title}
                                    </h3>
                                  </Link>
                                  <p className="text-lg md:text-xl font-bold theme-text">
                                    ${Math.round(Number(displayPrice) || 0).toLocaleString("es-CL", {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    })}
                                  </p>
                                  {product.isOnSale && product.salePrice && (
                                    <p className="text-sm text-gray-400 line-through">
                                      ${Math.round(Number(product.price) || 0).toLocaleString("es-CL", {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0,
                                      })}
                                    </p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>

                    {/* Pagination */}
                    {products.length > PRODUCTS_PER_PAGE && (
                      <div className="flex justify-center items-center gap-2 py-8 flex-wrap">
                        <button
                          onClick={() => { setCurrentPage(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          disabled={currentPage === 1}
                          className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-100"
                        >
                          Primera
                        </button>
                        {Array.from({ length: Math.ceil(products.length / PRODUCTS_PER_PAGE) }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === Math.ceil(products.length / PRODUCTS_PER_PAGE) || Math.abs(p - currentPage) <= 2)
                          .map((pageNum, index, array) => {
                            const prev = array[index - 1];
                            return (
                              <div key={pageNum} className="flex items-center gap-2">
                                {prev && pageNum - prev > 1 && <span className="text-gray-400">...</span>}
                                <button
                                  onClick={() => { setCurrentPage(pageNum); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                                  className={`px-3 py-1 text-sm border rounded ${
                                    currentPage === pageNum
                                      ? "bg-purple-600 text-white border-purple-600"
                                      : "hover:bg-gray-100"
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              </div>
                            );
                          })}
                        <button
                          onClick={() => {
                            setCurrentPage(Math.ceil(products.length / PRODUCTS_PER_PAGE));
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          disabled={currentPage >= Math.ceil(products.length / PRODUCTS_PER_PAGE)}
                          className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-100"
                        >
                          Última
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
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
              <h2 className="text-xl font-bold text-gray-900">Vista previa</h2>
              <button onClick={() => setPreviewProduct(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid md:grid-cols-[minmax(220px,0.85fr)_1.15fr] gap-6 p-6">
              <div className="aspect-square md:aspect-[4/3] md:max-h-[360px] bg-gray-100 rounded-lg overflow-hidden">
                {(() => {
                  const imageUrl = getProductImageByIndex(previewProduct, 0, "thumb");
                  return imageUrl ? (
                    <img src={getImageUrl(imageUrl)} alt={previewProduct.title} className="w-full h-full object-contain bg-gray-100" />
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
                  ${Number(previewProduct.isOnSale && previewProduct.salePrice ? previewProduct.salePrice : previewProduct.price || 0).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  {previewProduct.category && (
                    <p><span className="font-semibold text-gray-700">Categoria:</span> {previewProduct.category}</p>
                  )}
                  {previewProduct.condition && (
                    <p><span className="font-semibold text-gray-700">Condicion:</span> {previewProduct.condition === "new" ? "Nuevo / Sellado" : previewProduct.condition === "used" ? "Usado" : previewProduct.condition}</p>
                  )}
                  {previewProduct.stock > 0 ? (
                    <p className="text-green-700">Stock disponible: {previewProduct.stock}</p>
                  ) : (
                    <p className="text-red-700">Sin stock</p>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <Link
                    href={`/productos/${previewProduct.slug || previewProduct.id}`}
                    className="flex-1 border theme-border theme-text text-center font-semibold py-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Ver producto
                  </Link>
                  <button
                    onClick={() => {
                      const imageUrl = getProductImageByIndex(previewProduct, 0, "thumb");
                      addItem({
                        productId: previewProduct.id,
                        title: previewProduct.title,
                        artist: previewProduct.artist,
                        price: previewProduct.isOnSale && previewProduct.salePrice ? previewProduct.salePrice : previewProduct.price,
                        imageUrl: imageUrl ? getImageUrl(imageUrl) : undefined,
                        stock: previewProduct.stock || 1,
                        vendorId: previewProduct.vendor?.id || previewProduct.vendorId || MARKETPLACE_VENDOR_ID,
                        vendorSlug: previewProduct.vendor?.slug || previewProduct.vendorSlug || "marketplace",
                      });
                      setPreviewProduct(null);
                    }}
                    disabled={!previewProduct.stock || previewProduct.stock <= 0}
                    className="flex-1 theme-gradient-bg text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {settings?.footerConfig ? (
        <StoreFooter footerConfig={settings.footerConfig} />
      ) : (
        <footer className="bg-gray-900 text-white py-8 mt-12">
          <div className="container mx-auto px-4 text-center">
            <p>© {new Date().getFullYear()} {settings?.storeName || "Marketplace"}. Todos los derechos reservados.</p>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function ProductosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      }
    >
      <ProductosContent />
    </Suspense>
  );
}
