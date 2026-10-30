"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import GridDisplay from "@/components/GridDisplay";
import ProductCarousel from "@/components/blocks/ProductCarousel";
import ImageCarousel from "@/components/blocks/ImageCarousel";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import LateralMenu, { shouldShowLateralMenu } from "@/components/LateralMenu";
import { Card, CardContent } from "@/components/ui/card";
import { applyThemeToDocument } from "@/lib/colorThemes";
import { usePathname } from "next/navigation";

export default function PublicPagePage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const vendorSlug = params.slug as string;
  const pageSlug = params.pageSlug as string;

  const [page, setPage] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (vendorSlug && pageSlug) {
      loadPage();
    }
  }, [vendorSlug, pageSlug]);

  const loadPage = async () => {
    try {
      setLoading(true);

      // Load vendor
      const vendorData = await api.getVendorBySlug(vendorSlug);
      setVendor(vendorData);

      // Load vendor settings
      const vendorSettings = await api.getVendorSettings(vendorData.id, false);
      setSettings(vendorSettings);

      // Apply color theme
      if (vendorSettings?.colorTheme) {
        applyThemeToDocument(vendorSettings.colorTheme, vendorSettings.customColors);
      }

      // Load page
      const pageData = await api.getPageBySlug(vendorSlug, pageSlug);
      
      // Si la página es homepage, redirigir a la raíz
      if (pageData.isHomepage) {
        router.replace(`/tiendas/${vendorSlug}`);
        return;
      }
      
      if (!pageData.isPublished) {
        setError("Esta página no está publicada");
        return;
      }
      setPage(pageData);
    } catch (error) {
      console.error("Error loading page:", error);
      setError("Página no encontrada");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !page || !vendor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
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

  const renderHeader = () => {
    if (!settings?.headerType || !vendor) return null;
    
    const headerProps = {
      vendor,
      settings,
      slug: vendor.slug || vendorSlug,
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

  const renderBlock = (block: any, index: number) => {
    const gridColsMap: Record<number, string> = {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-4",
    };

    const colClass = gridColsMap[block.columns] || gridColsMap[1];

    switch (block.type) {
      case "text":
        return (
          <div key={index} className={`grid ${colClass} gap-4`}>
            <div className="prose prose-lg max-w-none">
              <div
                dangerouslySetInnerHTML={{
                  __html: block.text || "",
                }}
              />
            </div>
          </div>
        );

      case "grid":
        return (
          <div key={index} className="w-full">
            <GridDisplay
              vendorSlug={vendorSlug}
              vendorId={vendor.id}
              gridConfig={{
                columns: block.gridConfig?.columns || 4,
                rows: block.gridConfig?.rows || null,
                displayMode: block.gridConfig?.displayMode || "latest",
                categoryId: block.gridConfig?.categoryId,
                sortBy: block.gridConfig?.sortBy || "newest",
              }}
              gridType="homepage"
              slug={vendorSlug}
              categoryDisplayConfig={settings?.productGridCategoryDisplay}
              vendorSettings={settings}
            />
          </div>
        );

      case "image":
        return (
          <div key={index} className={`grid ${colClass} gap-4`}>
            <div>
              {block.imageLink ? (
                <a href={block.imageLink} target={block.imageLinkTarget || "_self"} rel={(block.imageLinkTarget || "_self") === "_blank" ? "noopener noreferrer" : undefined}>
                  <img
                    src={block.imageUrl}
                    alt={block.imageAlt || "Image"}
                    className="w-full h-auto rounded-lg shadow-lg hover:shadow-xl transition-shadow"
                  />
                </a>
              ) : (
                <img
                  src={block.imageUrl}
                  alt={block.imageAlt || "Image"}
                  className="w-full h-auto rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        );

      case "video":
        return (
          <div key={index} className={`grid ${colClass} gap-4`}>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {block.videoType === "youtube" && (
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${extractYoutubeId(
                    block.videoUrl,
                  )}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
              {block.videoType === "vimeo" && (
                <iframe
                  className="w-full h-full"
                  src={`https://player.vimeo.com/video/${extractVimeoId(
                    block.videoUrl,
                  )}`}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              )}
              {block.videoType === "custom" && (
                <video
                  className="w-full h-full"
                  controls
                  poster={block.videoThumbnail}
                >
                  <source src={block.videoUrl} />
                </video>
              )}
            </div>
          </div>
        );

      case "imageText":
        return (
          <div key={index} className="relative w-full min-h-[400px] md:min-h-[500px] rounded-lg overflow-hidden">
            {/* Imagen de fondo */}
            {block.backgroundImage && (
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${block.backgroundImage})` }}
              >
                <div className="absolute inset-0 bg-black/40"></div>
              </div>
            )}
            
            {/* Contenido centrado */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-[400px] md:min-h-[500px] px-4 py-12 text-center">
              {block.title && (
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
                  {block.title}
                </h2>
              )}
              {block.text && (
                <p className="text-lg md:text-xl text-white mb-8 max-w-2xl drop-shadow-md">
                  {block.text}
                </p>
              )}
              {block.buttonText && block.buttonLink && (
                <a
                  href={block.buttonLink}
                  className="inline-block px-8 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
                >
                  {block.buttonText}
                </a>
              )}
            </div>
          </div>
        );

      case "carousel":
        return (
          <div key={index} className="w-full">
            <ProductCarousel
              config={block}
              vendorSlug={vendorSlug}
              vendorId={vendor?.id}
              settings={settings}
            />
          </div>
        );

      case "imageCarousel":
        return <ImageCarousel key={index} config={block} />;

      default:
        return null;
    }
  };

  const extractYoutubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : "";
  };

  const extractVimeoId = (url: string) => {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : "";
  };

  // Determinar si mostrar menú lateral
  const showLateralMenu = settings?.menus?.lateral
    ? shouldShowLateralMenu(settings.menus.lateral, pathname, vendorSlug, pageSlug)
    : false;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: settings?.colors?.background || "#ffffff" }}
    >
      {renderHeader()}

      <div className="container mx-auto px-4 py-12">
        <div className={`flex gap-6 ${showLateralMenu ? 'lg:flex-row' : 'flex-col'}`}>
          {/* Menú Lateral (solo visible en lg+) */}
          {showLateralMenu && (
            <aside className={`hidden lg:block ${settings.menus.lateral.position === 'left' ? 'lg:order-1' : 'lg:order-2'} lg:w-64 flex-shrink-0`}>
              <div className="sticky top-4">
                <LateralMenu config={settings.menus.lateral} vendorSlug={vendorSlug} />
              </div>
            </aside>
          )}

          {/* Contenido Principal */}
          <div className={`${showLateralMenu ? (settings.menus.lateral.position === 'left' ? 'lg:order-2' : 'lg:order-1') + ' lg:flex-1' : 'w-full'}`}>
        {/* Page Title */}
        {page.title && (
          <div className="mb-12">
            <h1
              className="text-4xl font-bold mb-4"
              style={{ color: settings?.colors?.primary || "#8B5CF6" }}
            >
              {page.title}
            </h1>
            {page.description && <p className="text-gray-600 text-lg">{page.description}</p>}
          </div>
        )}

        {/* Page Blocks */}
        <div className="space-y-12">
          {page.blocks && page.blocks.length > 0 ? (
            page.blocks.map((block: any, index: number) => (
              block.type === 'imageCarousel'
                ? <div key={index} style={{ marginLeft: 'calc(-50vw + 50%)', width: '100vw' }}>{renderBlock(block, index)}</div>
                : <div key={index}>{renderBlock(block, index)}</div>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                Esta página no tiene contenido
              </CardContent>
            </Card>
          )}
        </div>
          </div>
        </div>
      </div>

      <StoreFooter footerConfig={settings?.footerConfig} vendorSlug={vendorSlug} />
    </div>
  );
}
