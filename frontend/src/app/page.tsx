"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Disc3, Music, ShoppingBag, TrendingUp, ShoppingCart, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import PromotionalContent from "@/components/PromotionalContent";
import StoreFooter from "@/components/StoreFooter";
import PageRenderer from "@/components/PageRenderer";
import { getBannersByPosition } from "@/lib/shouldShowBanner";
import { applyThemeToDocument } from "@/lib/colorThemes";
import { useAnalytics } from "@/hooks/useAnalytics";
import MusicPreloader from "@/components/MusicPreloader";

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { addItem } = useCart();
  const { trackPageView, trackAddToCart } = useAnalytics(MARKETPLACE_VENDOR_ID);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [homepage, setHomepage] = useState<any>(null);
  const [domainChecking, setDomainChecking] = useState(true);
  const [previewProduct, setPreviewProduct] = useState<any>(null);

  useEffect(() => {
    detectCustomDomain();
  }, []);

  useEffect(() => {
    if (!loading && !domainChecking) {
      trackPageView(undefined, MARKETPLACE_VENDOR_ID);
    }
  }, [loading, domainChecking, trackPageView]);

  const detectCustomDomain = async () => {
    try {
      const hostname = window.location.hostname;
      
      console.log("🌐 [Home] Detecting domain:", hostname);

      // Si es un subdominio de mundobeat.cl, redirigir a la tienda
      if (hostname.endsWith(".mundobeat.cl") && hostname !== "mundobeat.cl" && hostname !== "www.mundobeat.cl") {
        const slug = hostname.replace(".mundobeat.cl", "");
        console.log("📦 [Home] Subdomain detected, redirecting to:", slug);
        router.push(`/tiendas/${slug}`);
        return;
      }

      // Si NO es localhost, mundobeat.cl o www.mundobeat.cl, buscar vendor por dominio personalizado
      if (
        hostname !== "localhost" &&
        hostname !== "127.0.0.1" &&
        hostname !== "mundobeat.cl" &&
        hostname !== "www.mundobeat.cl"
      ) {
        console.log("🔍 [Home] Custom domain detected, searching vendor...");
        
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vendors/domain/${hostname}`);
          
          if (response.ok) {
            const vendor = await response.json();
            console.log("✅ [Home] Vendor found for custom domain:", vendor.slug);
            router.push(`/tiendas/${vendor.slug}`);
            return;
          } else {
            console.log("⚠️ [Home] No vendor found for domain, showing marketplace");
          }
        } catch (err) {
          console.error("❌ [Home] Error fetching vendor by domain:", err);
        }
      }

      // Si llegamos aquí, mostrar marketplace
      console.log("🏠 [Home] Showing marketplace");
      setDomainChecking(false);
      loadMarketplaceData();
    } catch (err) {
      console.error("❌ [Home] Error detecting domain:", err);
      setDomainChecking(false);
      loadMarketplaceData();
    }
  };

  const loadMarketplaceData = async () => {
    try {
      setLoading(true);

      // Cargar vendor del marketplace
      const vendor = await api.getVendor(MARKETPLACE_VENDOR_ID);
      
      // Cargar configuración del marketplace desde el vendor especial
      const marketplaceSettings = await api.getVendorSettings(MARKETPLACE_VENDOR_ID, false);
      setSettings(marketplaceSettings);

      // Aplicar tema de colores si existe
      if (marketplaceSettings?.colorTheme) {
        applyThemeToDocument(marketplaceSettings.colorTheme, marketplaceSettings.customColors);
      }

      // Verificar configuración de homepage
      const homePageConfig = vendor?.homePageConfig;
      
      if (homePageConfig?.type === 'blocks' && homePageConfig?.pageId) {
        // Cargar página de bloques configurada
        try {
          const configuredPage = await api.getPagePublic(homePageConfig.pageId);
          console.log('📄 Loaded configured homepage:', configuredPage);
          setHomepage(configuredPage);
        } catch (error) {
          console.error('❌ Error loading configured page:', error);
          setHomepage(null);
        }
      } else if (homePageConfig?.type === 'custom') {
        // Intentar cargar homepage personalizada legacy
        try {
          const homepageData = await api.getHomepage("marketplace");
          console.log('📄 Loaded custom homepage');
          setHomepage(homepageData);
        } catch (error) {
          console.log('No custom homepage found for marketplace');
          setHomepage(null);
        }
      } else {
        // Usar layout por defecto
        console.log('📄 Using default layout');
        setHomepage(null);
      }

      // Cargar productos destacados
      const response = await api.getProducts({ marketplaceOnly: true, limit: 8 });
      const productsList = Array.isArray(response)
        ? response
        : (response.products || response.data || []);
      setFeaturedProducts(productsList);
    } catch (error) {
      console.error("❌ Error loading marketplace data:", error);
      // En caso de error, establecer valores por defecto para que la página no quede en blanco
      setSettings({
        headerType: 'type1',
        storeName: 'Marketplace',
        footerConfig: {}
      });
      setHomepage(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white/80 flex items-center justify-center">
        <MusicPreloader title="Cargando Tienda" storeName="MundoBeat.cl" message="Cargando la musica..." />
      </div>
    );
  }

  // Obtener banners por posición
  console.log('🎨 [Marketplace] Banners:', settings?.banners);
  console.log('🎨 [Marketplace] Is Array:', Array.isArray(settings?.banners));
  
  const bannersByPosition = settings?.banners && Array.isArray(settings.banners)
    ? getBannersByPosition(settings.banners, pathname, "marketplace")
    : { top: [], middle: [], bottom: [] };

  console.log('🎨 [Marketplace] Banners by position:', bannersByPosition);

  // Renderizar header según configuración
  const renderHeader = () => {
    if (!settings) return null;

    // HeaderType1/2/3 esperan props específicas
    const vendor = {
      id: MARKETPLACE_VENDOR_ID,
      slug: "marketplace",
      storeName: settings?.storeName || "Marketplace",
      phone: settings?.phone || "",
      email: settings?.email || ""
    };

    // Convertir headerType numérico a string
    const headerType = settings?.headerType 
      ? (typeof settings.headerType === 'number' ? `type${settings.headerType}` : settings.headerType)
      : "type1";

    console.log('Rendering header:', { headerType, settings });

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

  // Si hay homepage personalizada, renderizarla
  if (homepage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        {renderHeader()}

        <PromotionalContent carousels={settings?.slides} banners={bannersByPosition.top} position="top" vendorSlug="marketplace" sliderConfig={settings?.heroSliderConfig} vendorSettings={settings} />

        {homepage?.blocks && homepage.blocks.length > 0 ? (
          <>
            <PageRenderer
              blocks={homepage.blocks}
              rowsConfig={homepage?.rowsConfig}
              vendorSlug="marketplace"
              settings={settings}
              isHomepage={true}
            />
            
          </>
        ) : (
          <div className="mx-auto max-w-[1300px] px-4 py-12">
            <div className="text-center bg-gray-50 rounded-lg p-12">
              <p className="text-gray-600">La página está configurada pero no tiene contenido aún.</p>
              <Link href="/panel/homepage">
                <Button className="mt-4">Editar página de inicio</Button>
              </Link>
            </div>
          </div>
        )}

        <PromotionalContent carousels={settings?.slides} banners={bannersByPosition.middle} position="middle" vendorSlug="marketplace" sliderConfig={settings?.heroSliderConfig} vendorSettings={settings} />

        {settings?.footerConfig && (
          <StoreFooter
            footerConfig={settings.footerConfig}
          />
        )}

        <PromotionalContent carousels={settings?.slides} banners={bannersByPosition.bottom} position="bottom" vendorSlug="marketplace" sliderConfig={settings?.heroSliderConfig} vendorSettings={settings} />

      </div>
    );
  }

  // Layout por defecto si no hay homepage personalizada
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {renderHeader()}

      <PromotionalContent carousels={settings?.slides} banners={bannersByPosition.top} position="top" vendorSlug="marketplace" sliderConfig={settings?.heroSliderConfig} vendorSettings={settings} />

      <div className="mx-auto max-w-[1300px] px-4 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">
            Descubre música en formato físico
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            El marketplace donde coleccionistas y amantes de la música se encuentran.
            Vinilos, CDs, cassettes y más.
          </p>
        <div className="flex gap-4 justify-center">
          <Link href="/products">
            <Button size="lg">Explorar catálogo</Button>
          </Link>
          <Link href="/vendors">
            <Button size="lg" variant="outline">Ver tiendas</Button>
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-8">Categorías populares</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <Disc3 className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Vinilos</CardTitle>
              <CardDescription>LPs, 45s y ediciones especiales</CardDescription>
            </CardHeader>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <Music className="h-12 w-12 text-primary mb-2" />
              <CardTitle>CDs</CardTitle>
              <CardDescription>Álbumes y colecciones</CardDescription>
            </CardHeader>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <ShoppingBag className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Cassettes</CardTitle>
              <CardDescription>Retro y nuevas ediciones</CardDescription>
            </CardHeader>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Merchandising</CardTitle>
              <CardDescription>Poleras, posters y más</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Featured Products */}
      <section className="mb-16">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Productos destacados</h2>
          <Link href="/products">
            <Button variant="link">Ver todos →</Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando productos...</p>
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Music className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay productos publicados en el marketplace aún</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-6">
            {featuredProducts.slice(0, 8).map((product) => {
              // Parsear imágenes de forma segura
              const parseImages = (images: any) => {
                if (!images) return [];
                if (Array.isArray(images)) return images;
                if (typeof images === 'string') {
                  try {
                    return JSON.parse(images);
                  } catch {
                    return [images];
                  }
                }
                return [];
              };

              const primaryImage = getProductImageByIndex(product, 0, 'thumb');

              return (
                <Card key={product.id} className="hover:shadow-lg transition-shadow h-full flex flex-col group overflow-hidden max-w-full">
                  <CardContent className="p-0 flex flex-col h-full overflow-hidden">
                    {/* Contenedor de imagen con botones overlay */}
                    <div className="relative w-full aspect-square overflow-hidden shrink-0">
                      <Link href={`/products/${product.id}`}>
                        <div className="absolute inset-0 cursor-pointer overflow-hidden">
                          {primaryImage ? (
                            <img 
                              src={getImageUrl(primaryImage)}
                              alt={product.title}
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                              <Music className="h-16 w-16 text-gray-400" />
                            </div>
                          )}
                        </div>
                      </Link>
                      
                      {/* Botones de acción - hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-2 px-2 scale-90 group-hover:scale-100 transition-transform duration-300">
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPreviewProduct(product);
                            }}
                            className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-medium py-2 px-3 text-sm rounded transition-all flex items-center justify-center gap-1"
                            style={{ background: `linear-gradient(135deg, var(--color-secondary, #2563eb) 0%, var(--color-primary, #9333ea) 100%)` }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Vista</span>
                          </button>
                          
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              trackAddToCart(product.id, 1, product.vendor?.id || product.vendorId || MARKETPLACE_VENDOR_ID);
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
                            className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-medium py-2 px-3 text-sm rounded transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>+</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2 md:p-3 flex flex-col flex-1">
                      <Link href={`/products/${product.id}`}>
                        <h3 className="font-semibold text-sm leading-tight md:text-sm mb-1 line-clamp-2 theme-text hover:opacity-80 cursor-pointer">{product.title}</h3>
                      </Link>
                      <p className="text-xs text-gray-600 line-clamp-1 mb-2">
                        {product.artist || 'Artista'} {product.year ? `• ${product.year}` : ''}
                      </p>
                      <p className="text-lg md:text-xl font-bold theme-text mt-auto">
                        {formatPrice(Number(product.price) || 0)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA Vendor */}
      <section className="bg-primary text-white rounded-lg p-12 text-center">
        <h2 className="text-3xl font-bold mb-4">¿Tienes una colección para vender?</h2>
        <p className="text-xl mb-6">
          Únete a nuestra comunidad de vendedores y alcanza miles de compradores
        </p>
        <Link href="/dashboard/vendor/register">
          <Button size="lg" variant="secondary">
            Comenzar a vender
          </Button>
        </Link>
      </section>
      </div>

      <PromotionalContent carousels={settings?.slides} banners={bannersByPosition.middle} position="middle" vendorSlug="marketplace" sliderConfig={settings?.heroSliderConfig} vendorSettings={settings} />

      {/* Footer */}
      {settings?.footerConfig && (
        <StoreFooter
          footerConfig={settings.footerConfig}
        />
      )}

      <PromotionalContent carousels={settings?.slides} banners={bannersByPosition.bottom} position="bottom" vendorSlug="marketplace" sliderConfig={settings?.heroSliderConfig} vendorSettings={settings} />

    </div>
  );
}
