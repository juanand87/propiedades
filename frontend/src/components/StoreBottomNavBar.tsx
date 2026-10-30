"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { usePathname } from "next/navigation";
import { getPageUrl } from "@/lib/useCustomDomain";
import { resolvePageSlugFromMenuItem } from "@/lib/pageLinks";

interface StoreBottomNavBarProps {
  vendorSlug: string;
}

export default function StoreBottomNavBar({ vendorSlug }: StoreBottomNavBarProps) {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const loadFooterMenu = async () => {
      try {
        setLoading(true);
        const vendor = await api.getVendorBySlug(vendorSlug);
        const settings = await api.getVendorSettings(vendor.id, false);
        
        // Cargar items del menú footer
        const menus = settings.customMenus || settings.menus;
        let items: any[] = [];
        
        const footerData = menus?.footer;
        if (Array.isArray(footerData)) {
          // Estructura antigua: footer es un array directo
          items = footerData;
        } else if (footerData?.items && Array.isArray(footerData.items)) {
          // Nueva estructura: footer es un objeto con items
          items = footerData.items;
        }
        
        setMenuItems(items);
        const pagesData = await api.getPages(vendorSlug || "marketplace");
        setPages(pagesData || []);
      } catch (error) {
        console.error('Error loading footer menu:', error);
        setMenuItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadFooterMenu();
  }, [vendorSlug]);

  const generateMenuItemUrl = (menuItem: any) => {
    const baseSlug = vendorSlug && vendorSlug !== 'marketplace' ? `/tiendas/${vendorSlug}` : '';
    
    switch (menuItem.linkType) {
      case 'category':
        return menuItem.categorySlug ? `${baseSlug}/categoria/${menuItem.categorySlug}` : '#';
      case 'genre':
        return menuItem.genreSlug ? `${baseSlug}/genero/${menuItem.genreSlug}` : '#';
      case 'page':
        if (menuItem.isHomepage) {
          return baseSlug || '/';
        }
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
        return menuItem.url || '#';
    }
  };

  if (loading || !Array.isArray(menuItems) || menuItems.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 bg-white py-4 px-4">
      <nav className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {menuItems.map((item, i, arr) => (
          <span key={i} className="flex items-center gap-x-5">
            <a
              href={generateMenuItemUrl(item)}
              target={item.openInNewTab ? '_blank' : undefined}
              rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
              className="text-xs text-gray-500 hover:text-gray-900 transition-colors whitespace-nowrap"
            >
              {item.label}
            </a>
            {i < arr.length - 1 && (
              <span className="text-gray-300 text-xs select-none">·</span>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}
