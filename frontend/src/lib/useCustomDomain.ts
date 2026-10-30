/**
 * Helper functions to generate correct URLs based on current domain
 * Supports marketplace, subdomains, and custom domains
 * 
 * IMPORTANTE: Estos helpers deben usarse SIEMPRE para generar URLs en tiendas
 * para respetar dominios personalizados (ej: cdmania.cl)
 */

/**
 * Detect if we're on a custom domain (NOT subdomain or marketplace)
 * Custom domain: cdmania.cl ✅
 * Subdomain: cdmania.mundobeat.cl ❌
 * Marketplace: mundobeat.cl ❌
 */
export const isCustomDomain = (): boolean => {
  if (process.env.NEXT_PUBLIC_STORE_DOMAINS_ENABLED !== 'true') return false;
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  
  // Exclude localhost and development domains
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return false;
  }
  
  // Exclude main marketplace domains
  if (hostname === "mundobeat.cl" || hostname === "www.mundobeat.cl") {
    return false;
  }
  
  // Exclude Vercel preview domains
  if (hostname.includes("vercel.app")) {
    return false;
  }
  
  // Exclude subdomains of mundobeat.cl (e.g., cdmania.mundobeat.cl)
  // A subdomain will have mundobeat.cl in it but not BE mundobeat.cl
  if (hostname.includes(".mundobeat.cl") && hostname !== "mundobeat.cl" && hostname !== "www.mundobeat.cl") {
    return false;
  }
  
  // If we get here, it's a true custom domain (e.g., cdmania.cl)
  return true;
};

/**
 * Get the correct URL for a product
 * @param productId - Product ID
 * @param vendorSlug - Vendor slug (optional, for marketplace context)
 */
export const getProductUrl = (productOrId: string | { id?: string; slug?: string }, vendorSlug?: string): string => {
  const productSlug = typeof productOrId === 'string'
    ? productOrId
    : (productOrId.slug || productOrId.id || '');

  // If on custom domain/subdomain, use clean URL
  if (isCustomDomain()) {
    return `/productos/${productSlug}`;
  }
  
  // If marketplace context
  if (!vendorSlug || vendorSlug === 'marketplace') {
    return `/productos/${productSlug}`;
  }
  
  // Regular vendor store URL
  return `/tiendas/${vendorSlug}/productos/${productSlug}`;
};

/**
 * Get the correct URL for products listing
 * @param vendorSlug - Vendor slug (optional)
 * @param queryParams - Query parameters (optional)
 */
export const getProductsUrl = (vendorSlug?: string, queryParams?: Record<string, string>): string => {
  let url = '';
  
  // If on custom domain/subdomain, use clean URL
  if (isCustomDomain()) {
    url = '/productos';
  } else if (!vendorSlug || vendorSlug === 'marketplace') {
    // Marketplace context
    url = '/productos';
  } else {
    // Regular vendor store URL
    url = `/tiendas/${vendorSlug}/productos`;
  }
  
  // Add query parameters
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }
  
  return url;
};

/**
 * Get the correct URL for any store page
 * @param vendorSlug - Vendor slug (optional)
 * @param path - Path within the store (e.g., '/checkout', '/cart')
 */
export const getStoreUrl = (vendorSlug?: string, path: string = ''): string => {
  const isCustom = isCustomDomain();
  
  // If on custom domain/subdomain, use clean URL
  if (isCustom) {
    return path || '/';
  }
  
  // If marketplace context
  if (!vendorSlug || vendorSlug === 'marketplace') {
    return path || '/';
  }
  
  // Regular vendor store URL
  const storeUrl = `/tiendas/${vendorSlug}${path}`;
  return storeUrl;
};

/**
 * Get the correct URL for a category page
 * @param vendorSlug - Vendor slug
 * @param categorySlug - Category slug or ID
 */
export const getCategoryUrl = (vendorSlug: string, categorySlug: string): string => {
  if (isCustomDomain()) {
    return `/categoria/${categorySlug}`;
  }
  // Para el marketplace, usar ruta directa sin /tiendas/marketplace
  if (!vendorSlug || vendorSlug === 'marketplace') {
    return `/categoria/${categorySlug}`;
  }
  return `/tiendas/${vendorSlug}/categoria/${categorySlug}`;
};

/**
 * Get the correct URL for a genre page
 * @param vendorSlug - Vendor slug
 * @param genreSlug - Genre slug or ID
 */
export const getGenreUrl = (vendorSlug: string, genreSlug: string): string => {
  if (isCustomDomain()) {
    return `/genero/${genreSlug}`;
  }
  // Para el marketplace, usar ruta directa sin /tiendas/marketplace
  if (!vendorSlug || vendorSlug === 'marketplace') {
    return `/genero/${genreSlug}`;
  }
  return `/tiendas/${vendorSlug}/genero/${genreSlug}`;
};

/**
 * Get the correct URL for a custom page
 * @param vendorSlug - Vendor slug
 * @param pageSlug - Page slug
 * @param isHomepage - Whether this is the homepage
 */
export const getPageUrl = (vendorSlug: string, pageSlug?: string, isHomepage?: boolean): string => {
  const isMarketplace = !vendorSlug || vendorSlug === 'marketplace';
  
  if (isHomepage) {
    return (isCustomDomain() || isMarketplace) ? '/' : `/tiendas/${vendorSlug}`;
  }
  
  if (!pageSlug) {
    return (isCustomDomain() || isMarketplace) ? '/' : `/tiendas/${vendorSlug}`;
  }
  
  if (isCustomDomain() || isMarketplace) {
    return `/pagina/${pageSlug}`;
  }
  return `/tiendas/${vendorSlug}/pagina/${pageSlug}`;
};

/**
 * Returns true if we're on a store context: either a subdomain (vendor.mundobeat.cl)
 * or a fully custom domain (vendor.cl). In both cases the middleware handles
 * internal rewrites, so clean paths like /checkout work correctly.
 */
const isStoreContext = (): boolean => {
  if (process.env.NEXT_PUBLIC_STORE_DOMAINS_ENABLED !== 'true') return false;
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  // Custom domain (already handled by isCustomDomain)
  if (isCustomDomain()) return true;
  // Subdomain of mundobeat.cl (e.g. viniloteca.mundobeat.cl)
  if (hostname.endsWith('.mundobeat.cl') && hostname !== 'mundobeat.cl' && hostname !== 'www.mundobeat.cl') {
    return true;
  }
  return false;
};

/**
 * Get the correct URL for checkout
 * @param vendorSlug - Vendor slug
 */
export const getCheckoutUrl = (vendorSlug: string): string => {
  if (isStoreContext()) {
    return '/checkout';
  }
  return `/tiendas/${vendorSlug}/checkout`;
};

/**
 * Get the correct URL for an order
 * @param vendorSlug - Vendor slug
 * @param orderId - Order ID
 */
export const getOrderUrl = (vendorSlug: string, orderId: string): string => {
  if (isStoreContext()) {
    return `/pedido/${orderId}`;
  }
  return `/tiendas/${vendorSlug}/pedido/${orderId}`;
};

/**
 * Get the correct URL for search
 * @param vendorSlug - Vendor slug
 * @param query - Search query
 */
export const getSearchUrl = (vendorSlug: string, query: string): string => {
  const encodedQuery = encodeURIComponent(query);
  if (isStoreContext()) {
    return `/buscar?q=${encodedQuery}`;
  }
  return `/tiendas/${vendorSlug}/buscar?q=${encodedQuery}`;
};
