"use client";

import { useState, useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import PageRenderer from "@/components/PageRenderer";
import Banner from "@/components/Banner";
import { Card, CardContent } from "@/components/ui/card";
import { applyThemeToDocument } from "@/lib/colorThemes";
import { getBannersByPosition } from "@/lib/shouldShowBanner";

export default function StorePageByIdPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const slug = params.slug as string;
  const pageId = params.pageId as string;
  const [page, setPage] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (pageId && slug) {
      loadPage();
    }
  }, [pageId, slug]);

  const loadPage = async () => {
    try {
      setLoading(true);

      // Load vendor
      const vendorData = await api.getVendorBySlug(slug);
      setVendor(vendorData);

      // Load vendor settings
      const vendorSettings = await api.getVendorSettings(vendorData.id, false);
      setSettings(vendorSettings);

      // Apply color theme
      if (vendorSettings?.colorTheme) {
        applyThemeToDocument(vendorSettings.colorTheme, vendorSettings.customColors);
      }

      // Load page by ID
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/pages/public/page/${pageId}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        setError("Página no encontrada");
        return;
      }

      const pageData = await response.json();

      if (!pageData.isPublished) {
        setError("Esta página no está publicada");
        return;
      }

      if (pageData.slug) {
        router.replace(`/tiendas/${slug}/pagina/${pageData.slug}`);
        return;
      }

      setPage(pageData);
      
      console.log('✅ Store page loaded:', {
        slug,
        pageId,
        vendorId: vendorData.id,
        title: pageData.title,
        blocksCount: pageData.blocks?.length,
        blocks: pageData.blocks,
        rowsConfig: pageData.rowsConfig
      });
    } catch (error) {
      console.error("Error loading page:", error);
      setError("Error al cargar la página");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando página...</p>
        </div>
      </div>
    );
  }

  if (error || !page || !vendor) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">{error || "Página no encontrada"}</h1>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Obtener banners por posición
  const bannersByPosition = settings?.banners && Array.isArray(settings.banners)
    ? getBannersByPosition(settings.banners, pathname, slug)
    : { top: [], middle: [], bottom: [] };

  const renderHeader = () => {
    const rawHeaderType = settings?.headerType ?? "type1";
    const headerType = String(rawHeaderType).startsWith("type")
      ? String(rawHeaderType)
      : `type${rawHeaderType}`;
    const config = {
      ...settings?.headerConfig,
      menus: settings?.menus,
      customMenus: settings?.customMenus,
      headerConfig: settings?.headerConfig || {}
    };

    switch (headerType) {
      case "type1":
        return <HeaderType1 vendor={vendor} config={config} slug={slug} />;
      case "type2":
        return <HeaderType2 vendor={vendor} config={config} slug={slug} />;
      case "type3":
        return <HeaderType3 vendor={vendor} config={config} slug={slug} />;
      default:
        return <HeaderType1 vendor={vendor} config={config} slug={slug} />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-600">
      {renderHeader()}

      {/* Banners Superiores */}
      {Array.isArray(bannersByPosition.top) && bannersByPosition.top.map((banner: any) => (
        <Banner key={banner.id} type={banner.type} config={banner.config} vendorSlug={slug} deviceVisibility={banner.deviceVisibility} vendorSettings={settings} />
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
            vendorSlug={slug}
            vendorId={vendor.id}
            settings={settings}
            isHomepage={page?.isHomepage || false}
          />
          
          {/* Banners Inferiores */}
          {Array.isArray(bannersByPosition.bottom) && bannersByPosition.bottom.map((banner: any) => (
            <div key={banner.id} className="my-8 container mx-auto px-4">
              <Banner type={banner.type} config={banner.config} vendorSlug={slug} deviceVisibility={banner.deviceVisibility} vendorSettings={settings} />
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
        <StoreFooter footerConfig={settings.footerConfig} vendorSlug={slug} />
      )}
    </div>
  );
}
