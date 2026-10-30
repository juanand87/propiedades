/**
 * Utilidad para determinar la visibilidad del sidebar de filtros
 * basándose en la configuración del vendor y la URL actual
 */

import { getCategoryUrl, getGenreUrl, getPageUrl, isCustomDomain } from './useCustomDomain';

interface FilterConfig {
  enabled?: boolean;
  position?: 'left' | 'right';
  showInCatalog?: boolean;
  showInProductDetail?: boolean;
  showInGenrePages?: boolean;
  showInFormatPages?: boolean;
  categories?: {
    mode?: 'all' | 'specific';
    selected?: string[];
  };
}

interface MenuItem {
  id: string;
  label: string;
  linkType: 'category' | 'genre' | 'page' | 'custom';
  categoryId?: string;
  categorySlug?: string;
  genreId?: string;
  genreSlug?: string;
  pageId?: string;
  pageSlug?: string;
  customUrl?: string;
  isHomepage?: boolean;
}

/**
 * Genera la URL de unnitem del menú
 */
export function generateMenuItemUrl(item: MenuItem, vendorSlug: string): string {
  switch (item.linkType) {
    case 'category':
      return getCategoryUrl(vendorSlug, item.categorySlug || item.categoryId || '');
    case 'genre':
      return getGenreUrl(vendorSlug, item.genreSlug || item.genreId || '');
    case 'page':
      return getPageUrl(vendorSlug, item.pageSlug || item.pageId, item.isHomepage);
    case 'custom':
      return item.customUrl || '#';
    default:
      return '#';
  }
}

/**
 * Normaliza una URL para comparación (remueve trailing slash, dominio, etc.)
 */
function normalizeUrl(url: string): string {
  // Remover protocolo y dominio si existen
  let normalized = url.replace(/^https?:\/\/[^/]+/, '');
  
  // Remover trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  // Si está vacío, es la raíz
  if (!normalized) return '/';
  
  return normalized;
}

/**
 * Determina si el sidebar de filtros debe mostrarse en la página actual
 * Nueva versión simplificada basada en checkboxes directos por tipo de página
 */
export function shouldShowFilterSidebar(
  config: FilterConfig | undefined | null,
  currentUrl: string,
  vendorSlug: string,
  options: {
    isHome?: boolean;
    isCatalog?: boolean;
    isProductDetail?: boolean;
    isGenrePage?: boolean;
    isFormatPage?: boolean;
    categorySlug?: string;
    genreSlug?: string;
    allMenuItems?: MenuItem[];
  } = {}
): boolean {
  console.log('🔍 [shouldShowFilterSidebar] Checking visibility:', {
    config: config ? 'exists' : 'null',
    currentUrl,
    vendorSlug,
    options
  });

  // Si no hay configuración, no mostrar por defecto
  if (!config) {
    console.log('❌ No filter config, not showing');
    return false;
  }

  // Si está deshabilitado explícitamente, no mostrar
  if (config.enabled === false) {
    console.log('❌ Filter config disabled');
    return false;
  }

  // Verificar página de catálogo
  if (options.isCatalog && config.showInCatalog === true) {
    console.log('✅ Is catalog page and showInCatalog is true');
    return true;
  }

  // Verificar página de detalle de producto
  if (options.isProductDetail && config.showInProductDetail === true) {
    console.log('✅ Is product detail and showInProductDetail is true');
    return true;
  }

  // Verificar páginas de géneros (TODAS las páginas /genero/*)
  if (options.isGenrePage && config.showInGenrePages === true) {
    console.log('✅ Is genre page and showInGenrePages is true');
    return true;
  }

  // Verificar páginas de formatos (TODAS las páginas /formato/*)
  if (options.isFormatPage && config.showInFormatPages === true) {
    console.log('✅ Is format page and showInFormatPages is true');
    return true;
  }

  // Verificar categorías
  if (options.categorySlug && config.categories) {
    const categoriesConfig = config.categories;
    
    if (categoriesConfig.mode === 'all') {
      console.log('✅ Categories mode is "all", showing in category page');
      return true;
    }
    
    if (categoriesConfig.mode === 'specific' && categoriesConfig.selected) {
      const isSelected = categoriesConfig.selected.includes(options.categorySlug);
      console.log(`${isSelected ? '✅' : '❌'} Category ${options.categorySlug} is ${isSelected ? '' : 'not '}in selected list`);
      if (isSelected) return true;
    }
  }

  // No cumple ninguna condición
  console.log('❌ No conditions met, not showing');
  return false;
}
