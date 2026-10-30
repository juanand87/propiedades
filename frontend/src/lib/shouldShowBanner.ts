/**
 * Lógica para determinar si un banner debe mostrarse en una página específica
 * Similar a shouldShowLateralMenu
 */

interface BannerVisibility {
  mode: 'all' | 'specific' | 'home';
  showInHome: boolean;
  customPages?: {
    enabled: boolean;
    pages: string[];
  };
  categories?: {
    mode: 'all' | 'specific';
    selected: string[];
  };
  genres?: {
    mode: 'all' | 'specific';
    selected: string[];
  };
  conditions?: {
    mode: 'all' | 'specific';
    selected: string[]; // 'new' | 'used'
  };
}

interface BannerConfig {
  id: string;
  name: string;
  type: 'grid' | 'image' | 'title';
  position: 'top' | 'middle' | 'bottom';
  order: number;
  isActive: boolean;
  config: any;
  visibility: BannerVisibility;
  deviceVisibility?: {
    mobile: boolean;
    tablet: boolean;
    desktop: boolean;
  };
}

/**
 * Determina si un banner debe mostrarse en la página actual
 */
export function shouldShowBanner(
  banner: BannerConfig,
  pathname: string,
  vendorSlug: string,
  genreSlug?: string,
  categorySlug?: string,
  condition?: string, // 'new' | 'used' desde query params
): boolean {
  if (!banner || !banner.isActive) {
    return false;
  }

  const visibility = banner.visibility;
  
  console.log(`🔍 [shouldShowBanner] Checking banner "${banner.name}"`, {
    pathname,
    categorySlug,
    genreSlug,
    condition,
    visibility
  });
  
  // Si no hay configuración de visibilidad, mostrar en todas partes por defecto
  if (!visibility) {
    return true;
  }

  // Normalizar pathname para custom domains
  // Si pathname es "/" o solo "/tiendas/slug", considerarlo como homepage
  const isHomepage = pathname === '/' || pathname === `/tiendas/${vendorSlug}` || pathname === `/tiendas/${vendorSlug}/`;

  // Modo: Todo el sitio
  if (visibility.mode === 'all') {
    return true;
  }

  // Modo: Solo página de inicio
  if (visibility.mode === 'home') {
    return visibility.showInHome && isHomepage;
  }

  // Modo: Páginas específicas
  if (visibility.mode === 'specific') {
    // Verificar página de inicio
    if (visibility.showInHome && isHomepage) {
      return true;
    }

    // Verificar páginas personalizadas (enlaces de menús)
    if (visibility.customPages?.enabled && visibility.customPages.pages?.length > 0) {
      console.log(`  📄 Checking customPages:`, visibility.customPages.pages);
      for (const page of visibility.customPages.pages) {
        // Saltar si page es null o undefined
        if (!page) continue;
        
        // Mapeo de nombres comunes de menú a condiciones/rutas
        const pageLower = page.toLowerCase();
        console.log(`    Comparing: pathname="${pathname}" includes pageLower="${pageLower}"?`);
        
        // Verificar si es una página de condición (Nuevos/Usados)
        if (pageLower === 'nuevos' || pageLower === 'nuevo' || pageLower === 'new') {
          if (condition === 'new') {
            console.log(`    ✅ Match: new condition`);
            return true;
          }
        }
        if (pageLower === 'usados' || pageLower === 'usado' || pageLower === 'used') {
          if (condition === 'used') {
            console.log(`    ✅ Match: used condition`);
            return true;
          }
        }
        
        // Verificar si es la página de inicio
        if (pageLower === 'inicio' || pageLower === 'home') {
          if (isHomepage) {
            console.log(`    ✅ Match: homepage`);
            return true;
          }
        }
        
        // Verificar coincidencia directa en pathname (para géneros, categorías, etc.)
        if (pathname.toLowerCase().includes(pageLower)) {
          console.log(`    ✅ Match: pathname includes page`);
          return true;
        }
        
        // Verificar coincidencia con categorySlug (maneja pluralizaciones)
        // Ej: página del menú "Cds" debería coincidir con categorySlug "cd"
        if (categorySlug) {
          const categorySlugLower = categorySlug.toLowerCase();
          // Coincidencia exacta
          if (pageLower === categorySlugLower) {
            console.log(`    ✅ Match: page equals categorySlug`);
            return true;
          }
          // Plural: "cds" coincide con "cd", "vinilos" con "vinilo"
          if (pageLower === categorySlugLower + 's' || pageLower + 's' === categorySlugLower) {
            console.log(`    ✅ Match: page is plural/singular of categorySlug`);
            return true;
          }
        }
      }
    }

    // Verificar condiciones (nuevo/usado) - productos?condition=new o productos?condition=used
    if (condition && visibility.conditions) {
      if (visibility.conditions.mode === 'all') {
        return true;
      }
      if (visibility.conditions.mode === 'specific' && visibility.conditions.selected.length > 0) {
        if (visibility.conditions.selected.includes(condition)) {
          return true;
        }
      }
    }

    // Verificar categorías
    if (categorySlug && visibility.categories) {
      console.log(`  📚 Checking categories:`, visibility.categories, `categorySlug="${categorySlug}"`);
      if (visibility.categories.mode === 'all') {
        console.log(`    ✅ Match: all categories`);
        return true;
      }
      if (visibility.categories.mode === 'specific' && visibility.categories.selected.length > 0) {
        const match = visibility.categories.selected.includes(categorySlug);
        console.log(`    ${match ? '✅' : '❌'} categories.selected includes "${categorySlug}"?`, visibility.categories.selected);
        if (match) return true;
      }
    }

    // Verificar géneros
    if (genreSlug && visibility.genres) {
      if (visibility.genres.mode === 'all') {
        return true;
      }
      if (visibility.genres.mode === 'specific' && visibility.genres.selected.length > 0) {
        return visibility.genres.selected.includes(genreSlug);
      }
    }
  }

  console.log(`  ❌ Banner "${banner.name}" not shown - no matching rules`);
  return false;
}

/**
 * Filtra y ordena los banners que deben mostrarse
 */
export function getVisibleBanners(
  banners: BannerConfig[],
  pathname: string,
  vendorSlug: string,
  genreSlug?: string,
  categorySlug?: string,
  condition?: string,
): BannerConfig[] {
  // Validación defensiva: asegurar que banners sea un array
  if (!banners || !Array.isArray(banners)) {
    console.warn('⚠️ getVisibleBanners: banners is not an array:', banners);
    return [];
  }
  
  return banners
    .filter(banner => shouldShowBanner(banner, pathname, vendorSlug, genreSlug, categorySlug, condition))
    .sort((a, b) => a.order - b.order);
}

/**
 * Agrupa banners por posición
 */
export function getBannersByPosition(
  banners: BannerConfig[],
  pathname: string,
  vendorSlug: string,
  genreSlug?: string,
  categorySlug?: string,
  condition?: string,
): {
  top: BannerConfig[];
  middle: BannerConfig[];
  bottom: BannerConfig[];
} {
  console.log('🎯 [getBannersByPosition] Called with:', {
    pathname,
    vendorSlug,
    categorySlug,
    genreSlug,
    condition,
    bannersCount: banners?.length
  });
  
  // Validación defensiva: asegurar que banners sea un array
  if (!banners || !Array.isArray(banners)) {
    console.warn('⚠️ getBannersByPosition: banners is not an array:', banners);
    return { top: [], middle: [], bottom: [] };
  }
  
  const visible = getVisibleBanners(banners, pathname, vendorSlug, genreSlug, categorySlug, condition);
  
  return {
    top: visible.filter(b => b.position === 'top'),
    middle: visible.filter(b => b.position === 'middle'),
    bottom: visible.filter(b => b.position === 'bottom'),
  };
}
