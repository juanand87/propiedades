"use client";

import { useState, useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import Link from "next/link";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import PageRenderer from "@/components/PageRenderer";
import Banner from "@/components/Banner";
import { getBannersByPosition } from "@/lib/shouldShowBanner";
import { applyThemeToDocument } from "@/lib/colorThemes";

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

export default function PageByIdPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const pageId = params.pageId as string;
  
  const [page, setPage] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPageData();
  }, [pageId]);

  const loadPageData = async () => {
    try {
      setLoading(true);

      // Load marketplace settings
      const marketplaceSettings = await api.getVendorSettings(MARKETPLACE_VENDOR_ID, false);
      console.log('Marketplace Settings:', marketplaceSettings);
      setSettings(marketplaceSettings);
      
      // Apply color theme
      if (marketplaceSettings?.colorTheme) {
        applyThemeToDocument(marketplaceSettings.colorTheme, marketplaceSettings.customColors);
      }

      // Load page by ID
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/pages/public/page/${pageId}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error("Page not found");
      }

      const pageData = await response.json();

      if (!pageData.isPublished) {
        throw new Error("Page not published");
      }

      if (pageData.slug) {
        router.replace(`/pagina/${pageData.slug}`);
        return;
      }

      console.log('✅ Page loaded:', {
        pageId,
        title: pageData.title,
        blocksCount: pageData.blocks?.length,
        blocks: pageData.blocks
      });

      setPage(pageData);
      setLoading(false);
    } catch (error: any) {
      console.error("❌ Error loading page:", error);
      setPage(null);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando página...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">Página no encontrada</h1>
              <p className="text-gray-600 mb-6">La página que buscas no existe o no está publicada.</p>
              <Link href="/">
                <Button>Volver al inicio</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Obtener banners por posición
  console.log('🎨 [Page] Banners:', settings?.banners);
  console.log('🎨 [Page] Is Array:', Array.isArray(settings?.banners));
  
  const bannersByPosition = settings?.banners && Array.isArray(settings.banners)
    ? getBannersByPosition(settings.banners, pathname, "marketplace")
    : { top: [], middle: [], bottom: [] };

  console.log('🎨 [Page] Banners by position:', bannersByPosition);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 text-gray-600">
      {renderHeader()}

      {/* Banners Superiores */}
      {Array.isArray(bannersByPosition.top) && bannersByPosition.top.map((banner: any) => (
        <Banner key={banner.id} type={banner.type} config={banner.config} vendorSlug="marketplace" deviceVisibility={banner.deviceVisibility} vendorSettings={settings} />
      ))}

      {/* Título de la Página */}
      <div className="container mx-auto px-4 pt-8 pb-4">
        <h1 className="text-4xl font-bold text-gray-900">{page.title}</h1>
      </div>

      {page?.blocks && page.blocks.length > 0 ? (
        <>
          <PageRenderer
            blocks={page.blocks}
            rowsConfig={page?.rowsConfig}
            vendorSlug="marketplace"
            vendorId={MARKETPLACE_VENDOR_ID}
            settings={settings}
            isHomepage={page?.isHomepage || false}
          />
          
          {/* Banners Inferiores */}
          {Array.isArray(bannersByPosition.bottom) && bannersByPosition.bottom.map((banner: any) => (
            <div key={banner.id} className="my-8 container mx-auto px-4">
              <Banner type={banner.type} config={banner.config} vendorSlug="marketplace" deviceVisibility={banner.deviceVisibility} vendorSettings={settings} />
            </div>
          ))}
        </>
      ) : (
        <div className="container mx-auto px-4 py-12">
          <div className="text-center bg-gray-50 rounded-lg p-12">
            <p className="text-gray-600">Esta página no tiene contenido aún.</p>
          </div>
        </div>
      )}

      {settings?.footerConfig && (
        <StoreFooter
          footerConfig={settings.footerConfig}
        />
      )}
    </div>
  );
}
