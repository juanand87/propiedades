"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import GridDisplay from "@/components/GridDisplay";
import LateralMenu, { shouldShowLateralMenu } from "@/components/LateralMenu";
import Banner from "@/components/Banner";
import { getBannersByPosition } from "@/lib/shouldShowBanner";
import { useCart } from "@/contexts/CartContext";
import { usePathname } from "next/navigation";
import { getProductUrl, getStoreUrl } from "@/lib/useCustomDomain";
import MusicPreloader from "@/components/MusicPreloader";

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const categorySlug = params.categorySlug as string;
  const pathname = usePathname();
  const { addItem } = useCart();
  
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [category, setCategory] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [themeApplied, setThemeApplied] = useState(false);

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
    if (slug && categorySlug) {
      loadCategoryProducts();
    }
  }, [slug, categorySlug]);

  const loadCategoryProducts = async () => {
    try {
      setLoading(true);
      
      // Buscar vendor por slug
      const foundVendor = await api.getVendorBySlug(slug);
      setVendor(foundVendor);

      // Cargar configuraciones del vendor
      const vendorSettings = await api.getVendorSettings(foundVendor.id, false);
      setSettings(vendorSettings);
      
      // Aplicar tema de colores
      if (vendorSettings?.colorTheme) {
        const { applyThemeToDocument } = await import('@/lib/colorThemes');
        applyThemeToDocument(vendorSettings.colorTheme, vendorSettings.customColors);
        setThemeApplied(true);
      }

      // Cargar todas las categorías y buscar por slug
      const allCategoriesResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/vendors/${foundVendor.id}/categories`);
      const categoriesData = await allCategoriesResponse.json();
      console.log('📦 Raw response:', categoriesData);
      const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData.categories || []);
      console.log('📦 Categories array:', categories);
      console.log('🔍 Buscando slug:', categorySlug);
      console.log('📋 Slugs disponibles:', categories.map((c: any) => c.slug));
      const foundCategory = categories.find((cat: any) => cat.slug === categorySlug);
      console.log('✅ Categoría encontrada:', foundCategory);
      
      if (!foundCategory) {
        setError("Categoría no encontrada");
        setLoading(false);
        return;
      }
      
      setCategory(foundCategory);

      // Cargar productos filtrados por categoría
      const productsData = await api.getProducts({ 
        vendorId: foundVendor.id,
        categoryId: foundCategory.id 
      });
      
      const productsList = Array.isArray(productsData) 
        ? productsData 
        : (productsData.products || productsData.data || []);
      setProducts(productsList);
      
      setLoading(false);
    } catch (error: any) {
      console.error("Error loading category products:", error);
      setError(error.message || "Error al cargar los productos");
      setLoading(false);
    }
  };

  const renderHeader = () => {
    if (!settings?.headerType || !vendor) return null;
    
    const headerProps = {
      vendor,
      settings,
      slug: vendor.slug || slug,
      config: {
        ...(settings.headerConfig || {}),
        menus: settings.menus || {},
        customMenus: settings.customMenus || {},
        headerConfig: settings.headerConfig || {},
      },
    };

    switch (settings.headerType) {
      case 1:
        return <HeaderType1 {...headerProps} />;
      case 2:
        return <HeaderType2 {...headerProps} />;
      case 3:
        return <HeaderType3 {...headerProps} />;
      default:
        return <HeaderType1 {...headerProps} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white/80 flex items-center justify-center">
        <MusicPreloader title="Cargando categoria" storeName={vendor?.storeName || vendor?.name || slug || "MundoBeat.cl"} />
      </div>
    );
  }

  if (error || !vendor || !category) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">
                {error || "Categoría no encontrada"}
              </h1>
              <Link
                href={`/tiendas/${slug}`}
                className="inline-block px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all"
              >
                Volver a la tienda
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const gridColumns = 5;

  // Determinar si mostrar menú lateral
  const showLateralMenu = settings?.menus?.lateral
    ? shouldShowLateralMenu(settings.menus.lateral, pathname, slug, undefined, categorySlug)
    : false;

  // Obtener banners visibles según posición
  const bannersByPosition = settings?.banners
    ? getBannersByPosition(settings.banners, pathname, slug, undefined, categorySlug)
    : { top: [], middle: [], bottom: [] };

  return (
    <div className="min-h-screen" style={{ backgroundColor: settings?.colors?.background || '#ffffff' }}>
      {renderHeader()}

      {/* Banners Superiores */}
      {bannersByPosition.top.map((banner: any) => (
        <Banner key={banner.id} type={banner.type} config={banner.config} vendorSlug={slug} deviceVisibility={banner.deviceVisibility} vendorSettings={settings} />
      ))}

      <div className="container mx-auto px-4 py-8">
        <div className={`flex flex-col-reverse lg:flex-row gap-6 ${showLateralMenu ? 'lg:gap-6' : ''}`}>
          {/* Menú Lateral (solo visible en lg+) */}
          {showLateralMenu && (
            <aside className={`hidden lg:block ${settings.menus.lateral.position === 'left' ? 'lg:order-1' : 'lg:order-2'} lg:w-64 flex-shrink-0`}>
              <div className="lg:sticky lg:top-4">
                <LateralMenu config={settings.menus.lateral} vendorSlug={slug} />
              </div>
            </aside>
          )}

          {/* Contenido Principal */}
          <div className={`${showLateralMenu ? (settings.menus.lateral.position === 'left' ? 'lg:order-2' : 'lg:order-1') + ' lg:flex-1' : 'w-full'}`}>
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link href={`/tiendas/${slug}`} className="text-gray-600 hover:text-purple-600">
            Inicio
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600">{category.name}</span>
        </div>

        {/* Título de categoría con contador a la derecha */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {category.icon && (
                <span className="text-4xl">
                  {category.icon.startsWith('/') ? (
                    <img 
                      src={`http://localhost:3001${category.icon}`} 
                      alt="" 
                      className="w-10 h-10 object-contain" 
                    />
                  ) : (
                    category.icon
                  )}
                </span>
              )}
              <h1 className="text-3xl font-bold" style={{ color: settings?.colors?.primary || '#8B5CF6' }}>
                {category.name}
              </h1>
            </div>
            <p className="text-sm text-gray-500">
              {products.length} {products.length === 1 ? 'producto' : 'productos'}
            </p>
          </div>
          {category.description && (
            <p className="text-gray-600">{category.description}</p>
          )}
        </div>

        {/* Banners del Medio */}
        {bannersByPosition.middle.map((banner: any) => (
          <div key={banner.id} className="my-8">
            <Banner type={banner.type} config={banner.config} vendorSlug={slug} deviceVisibility={banner.deviceVisibility} vendorSettings={settings} />
          </div>
        ))}

        {/* Grid de productos */}
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No hay productos en esta categoría</p>
          </div>
        ) : settings?.gridConfig && settings.gridConfig.filter((g: any) => g.type === 'category' && g.isActive).length > 0 ? (
          // Mostrar grids configurados para categoría
          <div className="space-y-12">
            {settings.gridConfig
              .filter((grid: any) => grid.type === 'category' && grid.isActive)
              .sort((a: any, b: any) => a.order - b.order)
              .map((grid: any, index: number) => (
                <GridDisplay
                  key={`${index}-${themeApplied ? 'themed' : 'default'}`}
                  vendorSlug={slug}
                  vendorId={vendor.id}
                  gridConfig={{ ...grid, columns: 5 }}
                  gridType="category"
                  slug={slug}
                  categoryId={category.id}
                  categoryDisplayConfig={settings?.productGridCategoryDisplay}
                  vendorSettings={settings}
                />
              ))}
          </div>
        ) : (
          // Fallback: mostrar todos los productos de la categoría con grid genérico
          <GridDisplay
            vendorSlug={slug}
            vendorId={vendor.id}
            gridConfig={{
              id: 'fallback-category',
              title: category.name,
              displayMode: 'specific-category',
              columns: 5,
              isActive: true,
              order: 0,
            }}
            gridType="category"
            slug={slug}
            categoryId={category.id}
            categoryDisplayConfig={settings?.productGridCategoryDisplay}
            vendorSettings={settings}
          />
        )}
          </div> {/* Contenido Principal */}
        </div> {/* flex-row */}
      </div> {/* container */}

      {/* Banners Inferiores */}
      {bannersByPosition.bottom.map((banner: any) => (
        <div key={banner.id} className="my-8 container mx-auto px-4">
          <Banner type={banner.type} config={banner.config} vendorSlug={slug} deviceVisibility={banner.deviceVisibility} vendorSettings={settings} />
        </div>
      ))}

      <StoreFooter footerConfig={settings?.footerConfig} vendorSlug={slug} />
    </div>
  );
}
