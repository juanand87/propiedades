"use client";
import { getImageUrl } from "@/lib/utils";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Facebook, Instagram, MessageCircle, Globe } from "lucide-react";
import { getPageUrl } from "@/lib/useCustomDomain";
import { resolvePageSlugFromMenuItem } from "@/lib/pageLinks";

interface FooterItem {
  type: string;
  title?: string;
  content?: string;
  imageUrl?: string;
  imageScale?: number;
  linkUrl?: string;
  videoUrl?: string;
  mapEmbed?: string;
  pageId?: string;
  menuId?: string;
  textAlign?: "left" | "center" | "right";
}

interface FooterRow {
  id: number;
  enabled: boolean;
  columns: number;
  height?: string;
  items: FooterItem[];
}

interface FooterConfig {
  enabled: boolean;
  rows: FooterRow[];
}

interface StoreFooterProps {
  footerConfig?: FooterConfig;
  vendorSlug?: string;
}

export default function StoreFooter({ footerConfig, vendorSlug }: StoreFooterProps) {
  const [menusData, setMenusData] = useState<any>(null);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);

  useEffect(() => {
    loadMenusData();
    loadCategories();
    loadGenres();
    loadPages();
  }, [vendorSlug]);

  const loadMenusData = async () => {
    try {
      // Determinar el vendor ID según vendorSlug
      let vendorId = "00000000-0000-0000-0000-000000000001"; // marketplace por defecto
      
      if (vendorSlug && vendorSlug !== "marketplace") {
        const vendor = await api.getVendorBySlug(vendorSlug);
        vendorId = vendor.id;
      }

      const settings = await api.getVendorSettings(vendorId);
      setMenusData(settings.customMenus || settings.menus);
      setSocialLinks(settings?.headerConfig?.socialLinks || {});
    } catch (error) {
      console.error("Error loading menus:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api.getAllCategories();
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadGenres = async () => {
    try {
      const data = await api.getGenres();
      setGenres(data || []);
    } catch (error) {
      console.error('Error loading genres:', error);
    }
  };

  const loadPages = async () => {
    try {
      const data = await api.getPages(vendorSlug || "marketplace");
      setPages(data || []);
    } catch (error) {
      console.error('Error loading pages:', error);
      setPages([]);
    }
  };

  if (!footerConfig || !footerConfig.enabled) {
    return null;
  }

  // Validar que rows sea un array
  if (!footerConfig.rows || !Array.isArray(footerConfig.rows)) {
    return null;
  }

  const getAlignmentClasses = (align?: string) => {
    switch (align) {
      case "center":
        return "text-center items-center justify-center";
      case "right":
        return "text-right items-end justify-end";
      default:
        return "text-left items-start justify-start";
    }
  };

  const getSocialIcon = (key: string) => {
    switch (key.toLowerCase()) {
      case "facebook":
        return Facebook;
      case "instagram":
        return Instagram;
      case "whatsapp":
        return MessageCircle;
      default:
        return Globe;
    }
  };

  const getSocialLabel = (key: string) => {
    const normalized = key.toLowerCase();
    if (normalized === "whatsapp") return "WhatsApp";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const renderContent = (item: FooterItem) => {
    if (!item) return null;

    const alignClass = getAlignmentClasses(item.textAlign);

    switch (item.type) {
      case "text":
        return (
          <div className={alignClass}>
            {item.title && <h3 className="font-semibold text-lg md:text-xl mb-3">{item.title}</h3>}
            <p className="text-sm whitespace-pre-wrap md:text-base">{item.content}</p>
          </div>
        );

      case "html":
        return (
          <div className={alignClass}>
            {item.title && <h3 className="font-semibold text-lg md:text-xl mb-3">{item.title}</h3>}
            <div 
              className="text-sm md:text-base" 
              dangerouslySetInnerHTML={{ __html: item.content || "" }}
            />
          </div>
        );

      case "image":
        const imageScale = Math.max(25, Math.min(200, Number(item.imageScale) || 100));
        return (
          <div className={`flex flex-col ${alignClass}`}>
            {item.title && <h3 className="font-semibold text-lg md:text-xl mb-3">{item.title}</h3>}
            {item.imageUrl && (
              <div className="rounded-lg">
                {item.linkUrl ? (
                  <a 
                    href={item.linkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block group inline-block"
                  >
                    <img 
                      src={getImageUrl(item.imageUrl)} 
                      alt={item.title || "Imagen"} 
                      className="h-auto transition-transform group-hover:scale-105"
                      style={{ width: `${imageScale}%`, maxWidth: 'none' }}
                    />
                  </a>
                ) : (
                  <img 
                    src={getImageUrl(item.imageUrl)} 
                    alt={item.title || "Imagen"} 
                    className="h-auto"
                    style={{ width: `${imageScale}%`, maxWidth: 'none' }}
                  />
                )}
              </div>
            )}
          </div>
        );

      case "video":
        return (
          <div className={`flex flex-col ${alignClass}`}>
            {item.title && <h3 className="font-semibold text-lg md:text-xl mb-3">{item.title}</h3>}
            {item.videoUrl && (
              <div className="aspect-video rounded-lg overflow-hidden">
                {item.videoUrl.includes("youtube.com") || item.videoUrl.includes("youtu.be") ? (
                  <iframe
                    src={item.videoUrl.replace("watch?v=", "embed/")}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : item.videoUrl.includes("vimeo.com") ? (
                  <iframe
                    src={item.videoUrl.replace("vimeo.com/", "player.vimeo.com/video/")}
                    className="w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video 
                    src={item.videoUrl} 
                    controls 
                    className="w-full h-full"
                  >
                    Tu navegador no soporta el elemento de video.
                  </video>
                )}
              </div>
            )}
          </div>
        );

      case "map":
        return (
          <div className={`flex flex-col ${alignClass}`}>
            {item.title && <h3 className="font-semibold text-lg md:text-xl mb-3">{item.title}</h3>}
            {item.mapEmbed && (
              <div 
                className="w-full rounded-lg overflow-hidden"
                dangerouslySetInnerHTML={{ __html: item.mapEmbed }}
              />
            )}
          </div>
        );

      case "page-link":
        if (!item.pageId) return null;
        const pageSlug = resolvePageSlugFromMenuItem(item, pages);
        const linkedPage = pages.find(page => page.slug === pageSlug || page.id === item.pageId);
        const pageUrl = pageSlug
          ? getPageUrl(vendorSlug || "marketplace", pageSlug, linkedPage?.isHomepage)
          : '#';
        return (
          <div className={alignClass}>
            {item.title && (
              <a 
                href={pageUrl}
                className="inline-block font-semibold text-lg md:text-xl mb-1 hover:underline hover:text-white transition-colors"
              >
                {item.title} →
              </a>
            )}
          </div>
        );

      case "menu":
        if (!item.menuId || !menusData) return null;
        
        let menuItems: any[] = [];
        let menuTitle = item.title;

        // Obtener items según el tipo de menú
        if (menusData.custom) {
          // Nueva estructura
          if (item.menuId === 'principal') {
            menuItems = menusData.principal?.items || [];
            menuTitle = menuTitle || 'Menú Principal';
          } else if (item.menuId === 'secundario') {
            menuItems = menusData.secundario?.items || [];
            menuTitle = menuTitle || 'Menú Secundario';
          } else if (item.menuId === 'lateral') {
            menuItems = menusData.lateral?.items || [];
            menuTitle = menuTitle || 'Menú Lateral';
          } else if (item.menuId === 'footer') {
            menuItems = menusData.footer?.items || [];
            menuTitle = menuTitle || 'Menú Footer';
          } else {
            // Menú personalizado
            const customMenu = menusData.custom.find((m: any) => m.id === item.menuId);
            if (customMenu) {
              menuItems = customMenu.items || [];
              menuTitle = menuTitle || customMenu.name;
            }
          }
        } else {
          // Estructura antigua (fallback) - handle both old array and new {items:[]} formats
          const resolveMenuItems = (data: any) => Array.isArray(data) ? data : (data?.items || []);
          if (item.menuId === 'principal') menuItems = resolveMenuItems(menusData.principal);
          if (item.menuId === 'secundario') menuItems = resolveMenuItems(menusData.secundario);
          if (item.menuId === 'lateral') menuItems = resolveMenuItems(menusData.lateral);
          if (item.menuId === 'footer') menuItems = resolveMenuItems(menusData.footer);
        }

        const generateMenuItemUrl = (menuItem: any) => {
          const baseSlug = vendorSlug && vendorSlug !== 'marketplace' ? `/tiendas/${vendorSlug}` : '';
          
          switch (menuItem.linkType) {
            case 'category':
              const category = categories.find(c => c.id === menuItem.categoryId);
              return category ? `${baseSlug}/categoria/${category.slug}` : '#';
            case 'genre':
              const genre = genres.find(g => g.id === menuItem.genreId);
              return genre ? `${baseSlug}/genero/${genre.slug}` : '#';
            case 'page':
              const pageSlug = resolvePageSlugFromMenuItem(menuItem, pages);
              const linkedPage = pages.find(page => page.slug === pageSlug || page.id === menuItem.pageId);
              return pageSlug
                ? getPageUrl(vendorSlug || "marketplace", pageSlug, linkedPage?.isHomepage)
                : '#';
            case 'custom':
              return menuItem.customUrl || '#';
            case 'condition':
              return menuItem.condition
                ? `${baseSlug}/productos?condition=${menuItem.condition}`
                : `${baseSlug}/productos`;
            case 'offers':
              return `${baseSlug}/productos?isOnSale=true`;
            default:
              return menuItem.url || '#'; // backward compatibility
          }
        };

        return (
          <div className={alignClass}>
            {menuTitle && <h3 className="font-semibold text-lg md:text-xl mb-3">{menuTitle}</h3>}
            <nav className="flex flex-col gap-2">
              {menuItems.map((menuItem: any, idx: number) => (
                <a
                  key={idx}
                  href={generateMenuItemUrl(menuItem)}
                  target={menuItem.openInNewTab ? '_blank' : undefined}
                  rel={menuItem.openInNewTab ? 'noopener noreferrer' : undefined}
                  className="text-sm hover:text-white hover:underline transition-colors"
                >
                  {menuItem.label}
                </a>
              ))}
            </nav>
          </div>
        );

      case "social": {
        const entries = Object.entries(socialLinks || {}).filter(([, value]) => Boolean(value));
        const socialAlign = item.textAlign || "left";
        const socialTextClass = socialAlign === "center" ? "text-center" : socialAlign === "right" ? "text-right" : "text-left";
        const socialItemsClass = socialAlign === "center" ? "items-center" : socialAlign === "right" ? "items-end" : "items-start";
        return (
          <div className={socialTextClass}>
            {item.title && <h3 className="font-semibold text-lg md:text-xl mb-3">{item.title}</h3>}
            {entries.length ? (
              <div className={`flex flex-col gap-2 ${socialItemsClass}`}>
                {entries.map(([key, url]) => {
                  const Icon = getSocialIcon(key);
                  const label = getSocialLabel(key);

                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm hover:text-white transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No hay redes sociales configuradas.</p>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  const gridClassMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  };

  const getHeightClass = (height?: string) => {
    switch (height) {
      case "small":
        return "h-32 md:h-40"; // 128px mobile, 160px desktop
      case "medium":
        return "h-48 md:h-64"; // 192px mobile, 256px desktop
      case "large":
        return "h-64 md:h-96"; // 256px mobile, 384px desktop
      default:
        return "";
    }
  };

  return (
    <footer className="text-gray-300 py-8 md:py-12 mt-8 md:mt-12 theme-gradient-bg border-0">
      <div className="container mx-auto px-4">
        {footerConfig.rows.map((row) => {
          if (!row.enabled) return null;

          const gridClass = gridClassMap[row.columns] || gridClassMap[4];
          const heightClass = getHeightClass(row.height);

          return (
            <div key={row.id} className="mb-6 md:mb-8 last:mb-0">
              <div className={`grid ${gridClass} gap-4 md:gap-8`}>
                {Array.from({ length: row.columns }).map((_, index) => {
                  const item = Array.isArray(row.items) ? row.items[index] : null;
                  if (!item) return <div key={index} />;

                  return (
                    <div key={index} className={`text-gray-300 text-sm md:text-base ${heightClass}`}>
                      {renderContent(item)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </footer>
  );
}
