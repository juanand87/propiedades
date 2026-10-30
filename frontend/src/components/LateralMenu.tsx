"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCategoryUrl, getGenreUrl, getPageUrl, getProductsUrl } from "@/lib/useCustomDomain";

interface LateralMenuItem {
  id: number;
  label: string;
  linkType: "category" | "genre" | "page" | "custom" | "condition" | "offers";
  categoryId?: string;
  categorySlug?: string;
  genreId?: string;
  genreSlug?: string;
  pageId?: string;
  pageSlug?: string;
  isHomepage?: boolean;
  customUrl?: string;
  condition?: string;
  openInNewTab?: boolean;
}

interface LateralMenuConfig {
  enabled: boolean;
  position: "left" | "right";
  items: LateralMenuItem[];
  visibility: {
    mode: "all" | "specific";
    showInHome: boolean;
    showInProductDetail?: boolean;
    customPages: {
      mode: "all" | "specific";
      selected: string[];
    };
    categories: {
      mode: "all" | "specific";
      selected: string[];
    };
    genres: {
      mode: "all" | "specific";
      selected: string[];
    };
  };
}

interface LateralMenuProps {
  config: LateralMenuConfig;
  vendorSlug: string;
}

/**
 * Determina si el menú lateral debe mostrarse en la página actual
 */
export function shouldShowLateralMenu(
  config: LateralMenuConfig,
  currentPath: string,
  vendorSlug: string,
  pageSlug?: string,
  categorySlug?: string,
  genreSlug?: string,
  productCategorySlug?: string
): boolean {
  // Si el menú no está habilitado, no mostrar
  if (!config?.enabled) return false;

  // Páginas donde NUNCA mostrar el menú (carrito y checkout)
  if (
    currentPath.includes("/carrito") ||
    currentPath.includes("/checkout")
  ) {
    return false;
  }

  const visibility = {
    mode: config.visibility?.mode ?? "all",
    showInHome: config.visibility?.showInHome ?? true,
    showInProductDetail: config.visibility?.showInProductDetail ?? true,
    customPages: {
      mode: config.visibility?.customPages?.mode ?? "all",
      selected: config.visibility?.customPages?.selected ?? [],
    },
    categories: {
      mode: config.visibility?.categories?.mode ?? "all",
      selected: config.visibility?.categories?.selected ?? [],
    },
    genres: {
      mode: config.visibility?.genres?.mode ?? "all",
      selected: config.visibility?.genres?.selected ?? [],
    },
  };

  // Si el modo es "all", mostrar en todas partes (excepto carrito/checkout)
  if (visibility.mode === "all") {
    return true;
  }

  // Verificar si es la página de inicio (solo vendor slug, sin otras partes)
  const pathParts = currentPath.split('/').filter(Boolean);
  const isHomePage =
    currentPath === '/' ||
    (pathParts.length === 2 && pathParts[0] === 'tiendas' && pathParts[1] === vendorSlug);
  
  if (isHomePage) {
    return visibility.showInHome;
  }

  // Verificar páginas de producto
  if (productCategorySlug) {
    if (!visibility.showInProductDetail) {
      return false;
    }

    if (visibility.categories.mode === "all") {
      return true;
    }

    return visibility.categories.mode === "specific" && visibility.categories.selected.includes(productCategorySlug);
  }

  // Verificar páginas personalizadas (enlaces de menús)
  if (pageSlug && !categorySlug && !genreSlug) {
    if (visibility.customPages.mode === "all") {
      return true;
    }
    // Aquí verificamos si algún enlace de menú coincide
    if (visibility.customPages.mode === "specific" && visibility.customPages.selected.length > 0) {
      // Por ahora retornamos false, la lógica específica se implementará cuando tengamos los menús cargados
      return visibility.customPages.selected.includes(pageSlug);
    }
  }

  // Verificar categorías
  if (categorySlug) {
    if (visibility.categories.mode === "all") {
      return true;
    }

    if (visibility.categories.mode === "specific" && visibility.categories.selected.includes(categorySlug)) {
      return true;
    }
  }

  // Verificar géneros
  if (genreSlug) {
    if (visibility.genres.mode === "all") {
      return true;
    }
    if (visibility.genres.mode === "specific" && visibility.genres.selected.includes(genreSlug)) {
      return true;
    }
  }

  return false;
}

/**
 * Genera la URL del enlace según su tipo
 */
function getMenuItemUrl(item: LateralMenuItem, vendorSlug: string): string {
  switch (item.linkType) {
    case "category":
      return getCategoryUrl(vendorSlug, item.categorySlug || item.categoryId || '');
    case "genre":
      return getGenreUrl(vendorSlug, item.genreSlug || item.genreId || '');
    case "page":
      return getPageUrl(vendorSlug, item.pageSlug || item.pageId, item.isHomepage);
    case "condition":
      return getProductsUrl(vendorSlug, { condition: item.condition || 'new' });
    case "offers":
      return getProductsUrl(vendorSlug, { isOnSale: 'true' });
    case "custom":
      return item.customUrl || "#";
    default:
      return "#";
  }
}

export default function LateralMenu({ config, vendorSlug }: LateralMenuProps) {
  const pathname = usePathname();

  if (!config?.enabled || !config.items || config.items.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-4">
      <nav className="space-y-1">
        {config.items.map((item) => {
          const url = getMenuItemUrl(item, vendorSlug);
          const isActive = pathname === url;

          return (
            <Link
              key={item.id}
              href={url}
              target={item.openInNewTab ? "_blank" : undefined}
              rel={item.openInNewTab ? "noopener noreferrer" : undefined}
              className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "theme-gradient-bg text-white shadow-md"
                  : "text-gray-700 theme-hover-text hover:bg-gray-50 hover:shadow-sm"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
