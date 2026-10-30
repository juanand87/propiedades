"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import { usePathname } from "next/navigation";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import Banner from "@/components/Banner";
import { getBannersByPosition } from "@/lib/shouldShowBanner";
import CatalogFilters from "@/components/CatalogFilters";
import { applyThemeToDocument } from "@/lib/colorThemes";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { ShoppingCart, Eye, X } from "lucide-react";
import { shouldShowFilterSidebar } from "@/lib/filterVisibility";
import MusicPreloader from "@/components/MusicPreloader";

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

export default function CategoryPage() {
  const params = useParams();
  const categorySlug = params.categorySlug as string;
  const pathname = usePathname();
  const { addItem } = useCart();

  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [allMenuItems, setAllMenuItems] = useState<any[]>([]);
  const [category, setCategory] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const [previewSelectedImage, setPreviewSelectedImage] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [activeFilters, setActiveFilters] = useState<any>({
    formats: [],
    genres: [],
    conditions: [],
    rpms: [],
    sizes: [],
    editions: [],
    mediaGrade: [],
    sleeveGrade: []
  });
  const [allFormats, setAllFormats] = useState<any[]>([]);
  const [allGenres, setAllGenres] = useState<any[]>([]);
  const [allEditions, setAllEditions] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 24;

  // Orden de Goldmine para los grados
  const goldmineOrder = ['M', 'NM', 'NM or M-', 'VG+', 'VG', 'G+', 'G', 'P'];

  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;

    // Si es un string
    if (typeof images === 'string') {
      // Intentar parsear como JSON primero
      try {
        const parsed = JSON.parse(images);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // Si falla, es un string separado por comas
        return images.split(',').filter(Boolean).map((url: string, index: number) => ({
          url: url.trim(),
          isPrimary: index === 0
        }));
      }
    }

    return [];
  };

  useEffect(() => {
    if (categorySlug) {
      loadCategoryProducts();
    }
  }, [categorySlug]);

  const loadCategoryProducts = async () => {
    try {
      setLoading(true);

      // Cargar configuración del marketplace desde el vendor especial
      const marketplaceSettings = await api.getVendorSettings(MARKETPLACE_VENDOR_ID, false);
      setSettings(marketplaceSettings);

      // Cargar vendor para tener referencia completa
      const marketplaceVendor = await api.getVendor(MARKETPLACE_VENDOR_ID);
      setVendor(marketplaceVendor);

      // Cargar todos los items del menú para verificar URLs
      const menuItems = [
        ...(marketplaceSettings.menus?.principal || []),
        ...(marketplaceSettings.menus?.secundario || [])
      ];
      setAllMenuItems(menuItems);

      // Aplicar tema de colores si existe
      if (marketplaceSettings?.colorTheme) {
        applyThemeToDocument(marketplaceSettings.colorTheme, marketplaceSettings.customColors);
      }

      // Cargar todas las categorías (del marketplace)
      const allCategoriesResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/categories`);
      const categoriesData = await allCategoriesResponse.json();
      const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData.categories || []);
      console.log('📂 [CategoryPage] Todas las categorías:', categories);
      console.log('📂 [CategoryPage] Buscando slug:', categorySlug);

      const foundCategory = categories.find((cat: any) => cat.slug === categorySlug);

      if (!foundCategory) {
        console.error('❌ [CategoryPage] Categoría no encontrada. Slug buscado:', categorySlug);
        console.error('❌ [CategoryPage] Categorías disponibles:', categories.map((c: any) => c.slug));
        setError("Categoría no encontrada");
        setLoading(false);
        return;
      }

      console.log('✅ [CategoryPage] Categoría encontrada:', foundCategory);
      setCategory(foundCategory);

      // Cargar productos de TODOS los vendors filtrados por categoría
      console.log('🔍 [CategoryPage] Buscando productos con categoryId:', foundCategory.id);
      const productsData = await api.getProducts({ 
        marketplaceOnly: true,
        categoryId: foundCategory.id 
      });

      const productsList = Array.isArray(productsData) 
        ? productsData 
        : (productsData.products || productsData.data || []);

      console.log('📦 [CategoryPage] Productos encontrados:', productsList.length, productsList);

      // DEBUG: Ver el primer producto para entender la estructura
      if (productsList.length > 0) {
        console.log('🔍 [CategoryPage] Estructura del primer producto:', productsList[0]);
        console.log('🔍 [CategoryPage] Formatos del primer producto:', productsList[0].formats);
        console.log('🔍 [CategoryPage] Géneros del primer producto:', productsList[0].genres);
      }

      setProducts(productsList);
      setAllProducts(productsList); // Guardar todos para filtrado local

      // Extraer formatos, géneros y ediciones únicos para los chips
      const uniqueFormats = new Map();
      const uniqueGenres = new Map();
      const uniqueEditions = new Map();
      productsList.forEach((product: any) => {
        if (product.formats) {
          product.formats.forEach((format: any) => {
            if (!uniqueFormats.has(format.id.toString())) {
              uniqueFormats.set(format.id.toString(), { id: format.id.toString(), name: format.name });
            }
          });
        }
        if (product.genres) {
          product.genres.forEach((genre: any) => {
            if (!uniqueGenres.has(genre.id.toString())) {
              uniqueGenres.set(genre.id.toString(), { id: genre.id.toString(), name: genre.name });
            }
          });
        }
        if (product.editions) {
          product.editions.forEach((edition: any) => {
            if (!uniqueEditions.has(edition.id.toString())) {
              uniqueEditions.set(edition.id.toString(), { id: edition.id.toString(), name: edition.name });
            }
          });
        }
      });
      const formatsArray = Array.from(uniqueFormats.values());
      const genresArray = Array.from(uniqueGenres.values());
      const editionsArray = Array.from(uniqueEditions.values());

      setAllFormats(formatsArray);
      setAllGenres(genresArray);
      setAllEditions(editionsArray);

      console.log('📋 [CategoryPage] Formatos disponibles:', formatsArray);
      console.log('📋 [CategoryPage] Géneros disponibles:', genresArray);
      console.log('🔍 [CategoryPage] Nombre de categoría:', foundCategory.name);

      // Auto-seleccionar formato que coincida con el nombre de la categoría
      const matchingFormat = formatsArray.find((format: any) => 
        format.name.toLowerCase().trim() === foundCategory.name.toLowerCase().trim()
      );

      if (matchingFormat) {
        console.log('🎯 [CategoryPage] Auto-seleccionando formato:', matchingFormat.name, 'ID:', matchingFormat.id);
        const initialFilters = {
          formats: [matchingFormat.id],
          genres: [],
          conditions: [],
          rpms: [],
          sizes: [],
          editions: [],
          mediaGrade: [],
          sleeveGrade: []
        };
        setActiveFilters(initialFilters);

        // Aplicar filtro automáticamente
        const filtered = productsList.filter((p: any) => {
          const productFormatIds = p.formats?.map((f: any) => f.id.toString()) || [];
          const matches = productFormatIds.includes(matchingFormat.id);
          if (matches) {
            console.log('✅ Producto incluido:', p.title, 'formatos:', productFormatIds);
          }
          return matches;
        });
        console.log('📦 [CategoryPage] Productos después de auto-filtro:', filtered.length, 'de', productsList.length);
        setProducts(filtered);
      } else {
        console.log('ℹ️ [CategoryPage] No se encontró formato coincidente con:', foundCategory.name);
      }

      setLoading(false);
    } catch (error: any) {
      console.error("Error loading category products:", error);
      setError(error.message || "Error al cargar los productos");
      setLoading(false);
    }
  };
  // Determinar si mostrar filtros según configuración
  const shouldShowFilters = () => {
    return shouldShowFilterSidebar(
      settings?.filters,
      pathname,
      'marketplace',
      {
        categorySlug,
      }
    );
  };
  const handleFilterChange = (filters: any) => {
    console.log('🔍 [handleFilterChange] Aplicando filtros:', filters);
    console.log('📦 [handleFilterChange] Total productos:', allProducts.length);

    setActiveFilters(filters); // Guardar filtros activos

    // DEBUG: Ver estructura del primer producto
    if (allProducts.length > 0) {
      console.log('🔍 [handleFilterChange] Primer producto estructura:', allProducts[0]);
      console.log('🔍 [handleFilterChange] Géneros del primer producto:', allProducts[0].genres);
      console.log('🔍 [handleFilterChange] Formatos del primer producto:', allProducts[0].formats);
    }

    let filtered = [...allProducts];

    // Filtrar por formatos - los productos tienen un array de formatos
    if (filters.formats && filters.formats.length > 0) {
      console.log('🔍 Filtrando por formatos (IDs):', filters.formats);
      filtered = filtered.filter(p => {
        // p.formats es un array de objetos Format: [{ id: 1, name: "Vinyl", slug: "vinyl" }]
        const productFormatIds = p.formats?.map((f: any) => f.id.toString()) || [];
        console.log(`🔍 Producto "${p.title}" tiene formatos:`, productFormatIds);
        const hasMatch = filters.formats.some((filterFormatId: string) => 
          productFormatIds.includes(filterFormatId)
        );
        console.log(`🔍 ¿Coincide? ${hasMatch}`);
        return hasMatch;
      });
      console.log('📦 Después de formato:', filtered.length);
    }

    // Filtrar por géneros - los productos tienen un array de géneros
    if (filters.genres && filters.genres.length > 0) {
      console.log('🔍 Filtrando por géneros:', filters.genres);
      filtered = filtered.filter(p => {
        // p.genres es un array de objetos Genre: [{ id: 1, name: "Rock", slug: "rock" }]
        const productGenreIds = p.genres?.map((g: any) => g.id.toString()) || [];
        console.log(`🔍 Producto "${p.title}" tiene géneros:`, productGenreIds);
        const hasMatch = filters.genres.some((filterGenreId: string) => 
          productGenreIds.includes(filterGenreId)
        );
        console.log(`🔍 ¿Coincide? ${hasMatch}`);
        return hasMatch;
      });
      console.log('📦 Después de género:', filtered.length);
    }

    // Filtrar por condiciones
    if (filters.conditions && filters.conditions.length > 0) {
      filtered = filtered.filter(p => {
        // Verificar condición básica
        if (filters.conditions.includes(p.condition)) {
          return true;
        }

        // Verificar escalas Goldmine (mediaGrade o sleeveGrade)
        const goldmineMatch = filters.conditions.some((condition: string) => {
          // Mapeo de valores del filtro a valores de Goldmine
          const goldmineMap: Record<string, string[]> = {
            'mint': ['M', 'Mint'],
            'near-mint': ['NM', 'Near Mint', 'NM+', 'NM-'],
            'very-good': ['VG+', 'VG', 'Very Good'],
            'good': ['G', 'Good', 'G+']
          };

          const goldmineValues = goldmineMap[condition] || [];
          return goldmineValues.some(value => 
            p.mediaGrade === value || p.sleeveGrade === value
          );
        });

        return goldmineMatch;
      });
      console.log('📦 Después de condición:', filtered.length);
    }

    // Filtrar por precio
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      filtered = filtered.filter(p => 
        p.price >= filters.minPrice && p.price <= filters.maxPrice
      );
      console.log('📦 Después de precio:', filtered.length);
    }

    // Filtrar por RPM
    if (filters.rpms && filters.rpms.length > 0) {
      filtered = filtered.filter(p => 
        filters.rpms.includes(p.rpm)
      );
    }

    // Filtrar por tamaño de vinilo
    if (filters.sizes && filters.sizes.length > 0) {
      filtered = filtered.filter(p => 
        filters.sizes.includes(p.vinylSize)
      );
      console.log('📦 Después de tamaño:', filtered.length);
    }

    // Filtrar por edición - los productos tienen un array de ediciones
    if (filters.editions && filters.editions.length > 0) {
      filtered = filtered.filter(p => {
        // p.editions es un array de objetos Edition: [{ id: 1, name: "Edición Limitada", slug: "limited-edition" }]
        const productEditionIds = p.editions?.map((e: any) => e.id.toString()) || [];
        const hasMatch = filters.editions.some((filterEditionId: string) => 
          productEditionIds.includes(filterEditionId)
        );
        return hasMatch;
      });
      console.log('📦 Después de edición:', filtered.length);
    }

    // Filtrar por mediaGrade (Estado del Soporte)
    if (filters.mediaGrade && filters.mediaGrade.length > 0) {
      filtered = filtered.filter(p => {
        return filters.mediaGrade.includes(p.mediaGrade);
      });
      console.log('📦 Después de mediaGrade:', filtered.length);
    }

    // Filtrar por sleeveGrade (Estado de la Carátula)
    if (filters.sleeveGrade && filters.sleeveGrade.length > 0) {
      filtered = filtered.filter(p => {
        return filters.sleeveGrade.includes(p.sleeveGrade);
      });
      console.log('📦 Después de sleeveGrade:', filtered.length);
    }

    console.log('✅ Productos después de filtrar:', filtered.length);
    setProducts(filtered);
  };

  const handleRemoveFilter = (filterType: string, value: string) => {
    const newFilters = { ...activeFilters };

    if (filterType === 'priceRange') {
      delete newFilters.priceRange;
      delete newFilters.minPrice;
      delete newFilters.maxPrice;
    } else if (Array.isArray(newFilters[filterType])) {
      newFilters[filterType] = newFilters[filterType].filter((v: string) => v !== value);
    }

    setActiveFilters(newFilters);
    handleFilterChange(newFilters);
  };

  const handleClearAllFilters = () => {
    const emptyFilters = {
      formats: [],
      genres: [],
      conditions: [],
      rpms: [],
      sizes: [],
      editions: [],
      mediaGrade: [],
      sleeveGrade: []
    };
    setActiveFilters(emptyFilters);
    handleFilterChange(emptyFilters);
  };

  // Renderizar header según configuración
  const renderHeader = () => {
    if (!settings) return null;

    const vendor = {
      id: MARKETPLACE_VENDOR_ID,
      slug: "marketplace",
      storeName: settings?.storeName || "Marketplace",
      phone: settings?.phone || "",
      email: settings?.email || ""
    };

    const headerType = settings?.headerType 
      ? (typeof settings.headerType === 'number' ? `type${settings.headerType}` : settings.headerType)
      : "type1";

    switch (headerType) {
      case "type1":
        return <HeaderType1 vendor={vendor} config={settings || {}} slug="marketplace" />;
      case "type2":
        return <HeaderType2 vendor={vendor} config={settings || {}} slug="marketplace" />;
      case "type3":
        return <HeaderType3 vendor={vendor} config={settings || {}} slug="marketplace" />;
      default:
        return <HeaderType1 vendor={vendor} config={settings || {}} slug="marketplace" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white/80 flex items-center justify-center">
        <MusicPreloader title="Cargando categoria" storeName="MundoBeat.cl" message="Preparando el ritmo..." />
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">
                {error || "Categoría no encontrada"}
              </h1>
              <Link
                href="/"
                className="inline-block px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all"
              >
                Volver al marketplace
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const gridColumns = settings?.productGridColumns || 4;

  // Calcular banners para esta categoría
  console.log('🎪 [CategoryPage] Calculating banners for:', {
    categorySlug,
    pathname,
    hasBanners: settings?.banners?.length,
    category
  });

  const bannersByPosition = settings?.banners && Array.isArray(settings.banners)
    ? getBannersByPosition(settings.banners, pathname, "marketplace", undefined, categorySlug, undefined)
    : { top: [], middle: [], bottom: [] };

  return (
    <div className="min-h-screen bg-white">
      {renderHeader()}

      {/* Top Banners */}
      {bannersByPosition.top && Array.isArray(bannersByPosition.top) && bannersByPosition.top.length > 0 && (
        <div className="w-full">
          {bannersByPosition.top.map((banner, index) => (
            <Banner key={`top-${index}`} type={banner.type} config={banner.config} vendorSlug="marketplace" deviceVisibility={banner.deviceVisibility} vendorSettings={settings} />
          ))}
        </div>
      )}

      {/* Contenido Principal */}
      <div>
          <div className="container mx-auto px-4 py-8">
            {/* Breadcrumb */}
            <div className="mb-6 flex items-center gap-2 text-sm">
              <Link href="/" className="text-gray-600 hover:text-purple-600">
                Inicio
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">{category.name}</span>
            </div>

            {/* Layout con sidebar opcional de filtros */}
        <div className="flex gap-6">
          {/* Sidebar de filtros (opcional según configuración) */}
          {shouldShowFilters() && (
            <div className="hidden lg:block w-64 shrink-0">
              <CatalogFilters
                filters={{
                  format: activeFilters.formats,
                  genre: activeFilters.genres,
                  mediaGrade: activeFilters.mediaGrade,
                  sleeveGrade: activeFilters.sleeveGrade
                }}
                availableFilters={{
                  formats: allFormats
                    .filter(f => f.name.toLowerCase().trim() === category?.name.toLowerCase().trim())
                    .map(f => {
                      const formatCount = allProducts.filter(p => 
                        p.formats?.some((pf: any) => pf.id.toString() === f.id.toString())
                      ).length;
                      return { label: f.name, count: formatCount, value: f.id };
                    }),
                  genres: allGenres.map(g => {
                    // Contadores de género consideran filtros de formato activos
                    let productsToCount = allProducts;
                    if (activeFilters.formats.length > 0) {
                      productsToCount = allProducts.filter(p => 
                        p.formats?.some((pf: any) => 
                          activeFilters.formats.includes(pf.id.toString())
                        )
                      );
                    }
                    const genreCount = productsToCount.filter(p => 
                      p.genres?.some((pg: any) => pg.id.toString() === g.id.toString())
                    ).length;
                    console.log(`🔢 Género "${g.name}" tiene ${genreCount} productos (con filtros activos)`);
                    return { label: g.name, count: genreCount, value: g.id };
                  }),
                  mediaGrades: (() => {
                    // Contar cuántos productos tienen cada mediaGrade
                    const mediaGrades = new Map<string, number>();
                    allProducts.forEach((product: any) => {
                      if (product.mediaGrade) {
                        mediaGrades.set(product.mediaGrade, (mediaGrades.get(product.mediaGrade) || 0) + 1);
                      }
                    });
                    // Convertir a array y ordenar según goldmineOrder
                    return Array.from(mediaGrades.entries())
                      .map(([grade, count]) => ({ label: grade, count, value: grade }))
                      .sort((a, b) => {
                        const indexA = goldmineOrder.indexOf(a.label);
                        const indexB = goldmineOrder.indexOf(b.label);
                        return indexA - indexB;
                      });
                  })(),
                  sleeveGrades: (() => {
                    // Contar cuántos productos tienen cada sleeveGrade
                    const sleeveGrades = new Map<string, number>();
                    allProducts.forEach((product: any) => {
                      if (product.sleeveGrade) {
                        sleeveGrades.set(product.sleeveGrade, (sleeveGrades.get(product.sleeveGrade) || 0) + 1);
                      }
                    });
                    // Convertir a array y ordenar según goldmineOrder
                    return Array.from(sleeveGrades.entries())
                      .map(([grade, count]) => ({ label: grade, count, value: grade }))
                      .sort((a, b) => {
                        const indexA = goldmineOrder.indexOf(a.label);
                        const indexB = goldmineOrder.indexOf(b.label);
                        return indexA - indexB;
                      });
                  })(),
                }}
                goldmineOrder={goldmineOrder}
                onFilterChange={(category, value) => {
                  console.log('🎛️ Filter changed:', category, value);
                  if (category === 'format') {
                    const newFormats = activeFilters.formats.includes(value)
                      ? activeFilters.formats.filter((f: string) => f !== value)
                      : [...activeFilters.formats, value];
                    console.log('🎛️ New formats:', newFormats);
                    handleFilterChange({ ...activeFilters, formats: newFormats });
                  } else if (category === 'genre') {
                    const newGenres = activeFilters.genres.includes(value)
                      ? activeFilters.genres.filter((g: string) => g !== value)
                      : [...activeFilters.genres, value];
                    console.log('🎛️ New genres:', newGenres);
                    handleFilterChange({ ...activeFilters, genres: newGenres });
                  } else if (category === 'mediaGrade') {
                    const newMediaGrade = activeFilters.mediaGrade.includes(value)
                      ? activeFilters.mediaGrade.filter((g: string) => g !== value)
                      : [...activeFilters.mediaGrade, value];
                    handleFilterChange({ ...activeFilters, mediaGrade: newMediaGrade });
                  } else if (category === 'sleeveGrade') {
                    const newSleeveGrade = activeFilters.sleeveGrade.includes(value)
                      ? activeFilters.sleeveGrade.filter((g: string) => g !== value)
                      : [...activeFilters.sleeveGrade, value];
                    handleFilterChange({ ...activeFilters, sleeveGrade: newSleeveGrade });
                  }
                }}
              />
            </div>
          )}

          {/* Grid de productos */}
          <div className="flex-1">
            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No hay productos en esta categoría</p>
              </div>
            ) : (
              <>
                {/* Product counter */}
                <div className="py-4 text-center text-sm text-gray-600">
                  Mostrando {((currentPage - 1) * PRODUCTS_PER_PAGE) + 1}-{Math.min(currentPage * PRODUCTS_PER_PAGE, products.length)} de {products.length} productos
                </div>

                {/* Grid simple de productos del marketplace */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-6">
                  {products
                    .slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE)
                    .map((product, index) => {
                  const images = parseImages(product.images);
                  // Filtrar íconos de categorías que no deben estar en las imágenes del producto
                  const productImages = images.filter((img: any) => {
                    const url = img?.url || (typeof img === 'string' ? img : '');
                    return url && !url.includes('/icons/') && !url.includes('categoryIcon');
                  });
              const primaryImage = getProductImageByIndex(product, 0, 'thumb');
              const secondImage = getProductImageByIndex(product, 1, 'thumb');
              const hasRollover = settings?.imageRolloverEnabled && secondImage;
              const isAboveFold = index < 8; // Primeras 8 imágenes (2 filas en mobile, 2 filas en desktop)
              const isHighPriority = index < 4; // Primeras 4 con prioridad alta

              return (
                <Card key={product.id} className="hover:shadow-lg transition-shadow h-full flex flex-col group overflow-hidden max-w-full">
                  <CardContent className="p-0 flex flex-col h-full overflow-hidden">
                    {/* Contenedor de imagen - hover solo en desktop */}
                    <div className="relative w-full aspect-square shrink-0">
                      {/* overflow-hidden interno: recorta botones animados */}
                      <div className="absolute inset-0 overflow-hidden">
                        <Link href={`/productos/${product.slug || product.id}`}>
                          <div className="absolute inset-0 cursor-pointer">
                            {primaryImage ? (
                              <>
                                {/* Image Rollover Effect */}
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

                        {/* Botones de acción - Hover en desktop, ocultos en mobile */}
                        <div className="hidden md:flex absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 gap-1">
                          {/* Botón Vista Previa */}
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPreviewProduct(product);
                              setPreviewSelectedImage(null);
                            }}
                            className="w-12 bg-gray-800/95 hover:bg-gray-900 text-white font-semibold py-3 transition-colors backdrop-blur-sm flex items-center justify-center"
                          >
                            <Eye className="w-4 h-4" />

                          </button>

                          {/* Botón Agregar al Carrito */}
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
                            className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed backdrop-blur-sm flex items-center justify-center gap-2"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            <span>Agregar</span>
                          </button>
                        </div>
                      </div>

                      {/* Category Badge - fuera del overflow-hidden para que sea visible */}
                      {(product as any).categoryIcon && (
                        <div
                          className="absolute top-2 left-2 bg-white/90 shadow-md text-xs font-semibold rounded-lg p-2 z-20 group/badge"
                        >
                          {(product as any).categoryIcon.startsWith('/') || (product as any).categoryIcon.startsWith('http') ? (
                            <img
                              src={getImageUrl((product as any).categoryIcon)}
                              alt={(product as any).category || ''}
                              className={`w-6 h-6 object-contain${/vinilo|vinyl/i.test((product as any).category || '') ? ' disc-spin' : ''}`}
                            />
                          ) : (
                            <span className={`text-xl${(product as any).categoryIcon === '💿' ? ' disc-spin' : ''}`}>{(product as any).categoryIcon}</span>
                          )}
                          {(product as any).category && (
                            <span className={`
                              pointer-events-none absolute hidden group-hover/badge:block
                              bg-gray-800 text-white text-xs font-normal rounded px-2 py-1 whitespace-nowrap
                              top-1/2 -translate-y-1/2 z-30
                              left-full ml-2
                            `}>
                              {(product as any).category}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botones siempre visibles en mobile */}
                    <div className="md:hidden flex">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPreviewProduct(product);
                          setPreviewSelectedImage(null);
                        }}
                        className="w-12 bg-gray-800 hover:bg-gray-900 text-white py-3 transition-colors flex items-center justify-center"
                      >
                        <Eye className="w-4 h-4" />

                      </button>

                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const thumbImage = getProductImageByIndex(product, 0, 'thumb');
                          addItem({
                            productId: product.id,
                            title: product.title,
                            artist: product.artist,
                            price: product.price,
                            imageUrl: thumbImage ? getImageUrl(thumbImage) : undefined,
                            stock: product.stock || 1,
                            vendorId: product.vendor?.id || product.vendorId || MARKETPLACE_VENDOR_ID,
                            vendorSlug: product.vendor?.slug || product.vendorSlug || 'marketplace',
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
                        <h3 className="font-semibold text-sm leading-tight md:text-sm mb-1 line-clamp-2 text-gray-900 hover:opacity-80 cursor-pointer">{product.title}</h3>
                      </Link>
                      <p className="text-lg md:text-xl font-bold theme-text">
                        {formatPrice(Number(product.price) || 0)}
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
                        className={`px-3 py-1 text-sm border rounded transition-all ${
                          currentPage === pageNum 
                            ? 'theme-gradient-bg text-white theme-border' 
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
          </div> {/* Fin de flex-1 */}
        </div> {/* Fin de flex gap-6 */}
      </div> {/* Fin de container */}
      </div> {/* Fin de contenido principal */}

      {/* Modal de Vista Previa */}
      {previewProduct && (() => {
        const primaryImage = getProductImageByIndex(previewProduct, 0, 'large') || getProductImageByIndex(previewProduct, 0, 'thumb');
        const displayImage = previewSelectedImage || primaryImage;
        const selectedImage = displayImage || primaryImage;

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
                <button onClick={() => { setPreviewProduct(null); setPreviewSelectedImage(null); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                      {selectedImage ? (
                        <img src={getImageUrl(selectedImage)} alt={previewProduct.title} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400"><span className="text-6xl">?</span></div>
                      )}
                    </div>

                    {(() => {
                      const images = parseImages(previewProduct.images);
                      return images.length > 1 && (
                        <div className="grid grid-cols-4 gap-2">
                          {images.slice(0, 4).map((img: any, idx: number) => {
                            const imgUrl = getProductImageByIndex(previewProduct, idx, 'thumb');
                            const largeUrl = getProductImageByIndex(previewProduct, idx, 'large') || imgUrl;
                            return imgUrl && (
                              <button key={idx} type="button" onClick={() => setPreviewSelectedImage(largeUrl)} className={`aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 transition-colors cursor-pointer ${selectedImage === largeUrl ? 'theme-border' : 'border-gray-200 hover:theme-border'}`}>
                                <img src={getImageUrl(imgUrl)} alt={`${previewProduct.title} ${idx + 1}`} loading="lazy" className="w-full h-full object-cover" />
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col space-y-6">
                    <div>
                      <h3 className="text-3xl font-bold text-gray-900 mb-2">{previewProduct.title}</h3>
                      {previewProduct.artist && <p className="text-xl text-gray-600">{previewProduct.artist}</p>}
                    </div>

                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-bold theme-text">{formatPrice(Number(previewProduct.price) || 0)}</span>
                      {previewProduct.stock > 0 ? (
                        <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">Stock disponible: {previewProduct.stock}</span>
                      ) : (
                        <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">Sin stock</span>
                      )}
                    </div>

                    <div className="space-y-3 border-t pt-4">
                      {previewProduct.format && <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-700 w-24">Formato:</span><span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{previewProduct.format}</span></div>}
                      {previewProduct.genre && <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-700 w-24">Genero:</span><span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{previewProduct.genre}</span></div>}
                      {previewProduct.condition && <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-700 w-24">Condicion:</span><span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{previewProduct.condition}</span></div>}
                      {previewProduct.year && <div className="flex items-center gap-2"><span className="text-sm font-semibold text-gray-700 w-24">Ano:</span><span className="text-sm text-gray-900">{previewProduct.year}</span></div>}
                    </div>

                    <div className="flex gap-3 pt-4 border-t mt-auto">
                      <Link href={`/productos/${previewProduct.slug || previewProduct.id}`} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors text-center">Ver detalles completos</Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const primaryImage = getProductImageByIndex(previewProduct, 0, 'thumb');
                          addItem({ productId: previewProduct.id, title: previewProduct.title, artist: previewProduct.artist, price: previewProduct.price, imageUrl: primaryImage ? getImageUrl(primaryImage) : undefined, stock: previewProduct.stock || 1, vendorId: previewProduct.vendor?.id || previewProduct.vendorId || MARKETPLACE_VENDOR_ID, vendorSlug: previewProduct.vendor?.slug || previewProduct.vendorSlug || 'marketplace' });
                          setPreviewProduct(null);
                          setPreviewSelectedImage(null);
                        }}
                        disabled={!previewProduct.stock || previewProduct.stock <= 0}
                        className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-5 h-5" /> Agregar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Bottom Banners */}
      {bannersByPosition.bottom && Array.isArray(bannersByPosition.bottom) && bannersByPosition.bottom.length > 0 && (
        <div className="w-full">
          {bannersByPosition.bottom.map((banner, index) => (
            <Banner key={`bottom-${index}`} type={banner.type} config={banner.config} vendorSlug="marketplace" deviceVisibility={banner.deviceVisibility} vendorSettings={settings} />
          ))}
        </div>
      )}

      {/* Footer del marketplace */}
      {settings?.footerConfig ? (
        <StoreFooter footerConfig={settings.footerConfig} />
      ) : (
        <footer className="bg-gray-900 text-white py-8 mt-12">
          <div className="container mx-auto px-4 text-center">
            <p>© {new Date().getFullYear()} {settings?.storeName || 'Marketplace de Música'}. Todos los derechos reservados.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
