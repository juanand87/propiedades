"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import StoreFooter from "@/components/StoreFooter";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import GridDisplay from "@/components/GridDisplay";
import PageRenderer from "@/components/PageRenderer";
import LateralMenu, { shouldShowLateralMenu } from "@/components/LateralMenu";
import { getBannersByPosition } from "@/lib/shouldShowBanner";
import { useCart } from "@/contexts/CartContext";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getProductUrl, getStoreUrl } from "@/lib/useCustomDomain";
import { useAnalytics } from "@/hooks/useAnalytics";
import MusicPreloader from "@/components/MusicPreloader";
import PromotionalContent from "@/components/PromotionalContent";

export default function TiendaPublicaPage() {
  const params = useParams();
  const slug = params.slug as string;
  const searchParams = useSearchParams();
  const condition = searchParams.get('condition'); // 'new' or 'used'
  const pathname = usePathname();
  const { addItem } = useCart();
  const { trackPageView } = useAnalytics();
  const isMobile = useIsMobile();
  
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [homepage, setHomepage] = useState<any>(null);
  const [homePageConfig, setHomePageConfig] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [themeApplied, setThemeApplied] = useState(false);

  // Helper para parsear imágenes (puede venir como array o string JSON)
  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    try {
      return JSON.parse(images);
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (slug) {
      loadTienda();
    }
  }, [slug, condition]); // ← Agregado condition como dependencia

  useEffect(() => {
    if (!loading && vendor?.id) {
      trackPageView(undefined, vendor.id);
    }
  }, [loading, vendor?.id, trackPageView]);

  const loadTienda = async () => {
    try {
      setLoading(true);
      
      // Buscar vendor por slug
      const foundVendor = await api.getVendorBySlug(slug);
      setVendor(foundVendor);

      // Load home-page-config and vendor settings in parallel
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const [configResult, vendorSettings] = await Promise.all([
        fetch(`${API_URL}/vendors/${foundVendor.id}/home-page-config`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        api.getVendorSettings(foundVendor.id, false),
      ]);

      // Process home page config
      let homepageData = null;
      if (configResult) {
        setHomePageConfig(configResult);
        if (configResult.type === 'blocks' && configResult.pageId) {
          try {
            const pageResponse = await fetch(
              `${API_URL}/pages/public/page/${configResult.pageId}`,
              { cache: 'no-store' }
            );
            if (pageResponse.ok) {
              homepageData = await pageResponse.json();
            }
          } catch (error) {
            console.log('Error loading custom page:', error);
          }
        }
      }
      setHomepage(homepageData);

      // Process vendor settings
      setSettings(vendorSettings);
      if (vendorSettings?.colorTheme) {
        const { applyThemeToDocument } = await import('@/lib/colorThemes');
        applyThemeToDocument(vendorSettings.colorTheme, vendorSettings.customColors);
        setThemeApplied(true);
      }

      setLoading(false);
    } catch (error: any) {
      console.error("Error loading tienda:", error);
      setError(error.message || "Error al cargar la tienda");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white/80 flex items-center justify-center">
        <MusicPreloader title="Cargando Tienda" storeName={vendor?.storeName || vendor?.name || slug || "MundoBeat.cl"} />
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">Tienda no encontrada</h1>
              <p className="text-gray-600 mb-6">
                La tienda <span className="font-mono bg-gray-100 px-2 py-1 rounded">{slug}</span> no existe.
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all"
              >
                Volver al inicio
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Determinar número de columnas del grid
  const gridColumns = settings?.productGridColumns || 4;
  const gridClassMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  };
  const gridClass = gridClassMap[gridColumns] || gridClassMap[4];

  // Determinar qué header usar
  const headerType = settings?.headerType || 1;
  const headerConfig = {
    ...(settings?.headerConfig || {}),
    menus: settings?.menus || {},
    customMenus: settings?.customMenus || {},
    headerConfig: settings?.headerConfig || {},
  };

  // 🔥 DEBUG: Log para identificar qué header se renderiza
  console.log('🔥🔥🔥 HEADER TYPE USADO:', headerType, '- Vendor:', vendor.name);

  const renderHeader = () => {
    switch (headerType) {
      case 1:
        return <HeaderType1 vendor={vendor} config={headerConfig} slug={slug} />;
      case 2:
        return <HeaderType2 vendor={vendor} config={headerConfig} slug={slug} />;
      case 3:
        return <HeaderType3 vendor={vendor} config={headerConfig} slug={slug} />;
      default:
        return <HeaderType1 vendor={vendor} config={headerConfig} slug={slug} />;
    }
  };

  // Determinar si mostrar menú lateral
  const showLateralMenu = settings?.menus?.lateral
    ? shouldShowLateralMenu(settings.menus.lateral, pathname, slug)
    : false;

  // Obtener banners visibles según posición
  const bannersByPosition = settings?.banners && Array.isArray(settings.banners)
    ? getBannersByPosition(settings.banners, pathname, slug)
    : { top: [], middle: [], bottom: [] };

  return (
    <div className="min-h-screen bg-white">
      {/* Header de la Tienda - Dinámico según configuración */}
      {renderHeader()}

      <PromotionalContent
        carousels={settings?.slides}
        banners={bannersByPosition.top}
        position="top"
        vendorSlug={slug}
        sliderConfig={settings?.heroSliderConfig}
        vendorSettings={settings}
      />

      {/* Banner fallback si no hay slides para homepage */}
      {(!settings?.slides || !Array.isArray(settings.slides) || settings.slides.filter((s: any) => s.showInHomepage).length === 0) && vendor.banner && (
        <div className="w-full h-48 bg-gray-100">
          <img
            src={vendor.banner}
            alt={vendor.storeName}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Layout con o sin menú lateral */}
      <div className={`${showLateralMenu ? 'container mx-auto px-4 py-6' : ''}`}>
        <div className={`flex flex-col-reverse lg:flex-row gap-6 ${showLateralMenu ? '' : ''}`}>
          {/* Menú Lateral */}
          {showLateralMenu && (
            <aside className={`${settings.menus.lateral.position === 'left' ? 'lg:order-1' : 'lg:order-2'} w-full lg:w-64 lg:flex-shrink-0`}>
              <div className="lg:sticky lg:top-4">
                <LateralMenu config={settings.menus.lateral} vendorSlug={slug} />
              </div>
            </aside>
          )}

          {/* Contenido Principal */}
          <div className={`w-full ${showLateralMenu ? (settings.menus.lateral.position === 'left' ? 'lg:order-2' : 'lg:order-1') + ' lg:flex-1' : ''}`}>
            {/* Custom Homepage Content or Default Store Layout */}
            {homepage ? (
              // Show custom homepage
              <div className={!showLateralMenu ? "container mx-auto px-4 py-6" : ""}>
                <PageRenderer 
                  blocks={homepage.blocks || []} 
                  rowsConfig={homepage.rowsConfig}
                  vendorSlug={slug}
                  vendorId={vendor?.id}
                  settings={settings}
                  isHomepage={true}
                />
              </div>
            ) : homePageConfig?.type === 'blocks' ? (
              // Config is blocks but page not loaded - show error
              <div className={!showLateralMenu ? "container mx-auto px-4 py-6" : ""}>
                <Card>
                  <CardContent className="p-8 text-center text-gray-500">
                    <p className="text-lg font-semibold mb-2">⚠️ Página de inicio no encontrada</p>
                    <p className="text-sm">La configuración indica usar una página en bloques, pero no se pudo cargar. Verifica en la configuración de diseño.</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              // Show default store layout
              <>
                {/* Información de Contacto */}
                <div className={!showLateralMenu ? "container mx-auto px-4 py-6" : ""}>
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  {vendor.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">📧</span>
                      <a href={`mailto:${vendor.email}`} className="text-blue-600 hover:underline">
                        {vendor.email}
                      </a>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">📞</span>
                      <a href={`tel:${vendor.phone}`} className="text-blue-600 hover:underline">
                        {vendor.phone}
                      </a>
                    </div>
                  )}
                  {vendor.address && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">📍</span>
                      <span className="text-gray-700">
                        {vendor.address}
                        {vendor.city && `, ${vendor.city}`}
                        {vendor.country && `, ${vendor.country}`}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Productos con Grids Configurados */}
            <div className="space-y-12">
              {settings?.gridConfig && Array.isArray(settings.gridConfig) && settings.gridConfig.length > 0 ? (
                // Mostrar grids configurados
                settings.gridConfig
                  .filter((grid: any) => grid.type === 'homepage' && grid.isActive)
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((grid: any, index: number) => (
                    <div key={index}>
                      <h2 className="text-xl font-bold mb-4">
                        {grid.displayMode === 'latest'
                          ? 'Últimos Productos Agregados'
                          : grid.displayMode === 'featured'
                          ? 'Productos Destacados'
                          : grid.displayMode === 'best-sellers'
                          ? 'Productos Más Vendidos'
                          : grid.displayMode === 'on-sale'
                          ? 'Productos en Oferta'
                          : 'Productos'}
                      </h2>
                      <GridDisplay
                        key={`${index}-${themeApplied ? 'themed' : 'default'}`}
                        vendorSlug={slug}
                        vendorId={vendor.id}
                        gridConfig={grid}
                        gridType="homepage"
                        slug={slug}
                        categoryDisplayConfig={settings?.productGridCategoryDisplay}
                        condition={condition || undefined}
                        vendorSettings={settings}
                      />
                    </div>
                  ))
              ) : (
                // Fallback: mostrar grid simple con todos los productos
                <div>
                  <h2 className="text-xl font-bold mb-4">Productos</h2>
                  {products.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center text-gray-500">
                        Esta tienda aún no tiene productos publicados.
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-8 text-center text-gray-500">
                        Tienda sin grids configurados. Configure los grids en la sección de diseño.
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
            )}
          </div>
        </div>
      </div>

      <PromotionalContent
        carousels={settings?.slides}
        banners={bannersByPosition.middle}
        position="middle"
        vendorSlug={slug}
        sliderConfig={settings?.heroSliderConfig}
        vendorSettings={settings}
      />

      {/* Footer de la Tienda */}
      <StoreFooter footerConfig={settings?.footerConfig} vendorSlug={slug} />

      <PromotionalContent
        carousels={settings?.slides}
        banners={bannersByPosition.bottom}
        position="bottom"
        vendorSlug={slug}
        sliderConfig={settings?.heroSliderConfig}
        vendorSettings={settings}
      />
    </div>
  );
}
