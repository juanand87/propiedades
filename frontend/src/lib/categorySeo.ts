export function formatCategoryName(slugOrName?: string | null) {
  return String(slugOrName || 'Categoria')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCategory(input?: string | null) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function categoryKeyword(categoryName: string) {
  const normalized = normalizeCategory(categoryName);

  if (normalized.includes('vinilo')) return 'vinilos';
  if (normalized.includes('cd')) return 'CDs';
  if (normalized.includes('cassette') || normalized.includes('casete')) return 'cassettes';
  return categoryName;
}

export function getMarketplaceCategorySeo(category: any, fallbackSlug: string) {
  const categoryName = category?.name || formatCategoryName(fallbackSlug);
  const keyword = categoryKeyword(categoryName);

  return {
    name: categoryName,
    title: `${categoryName} en Chile | MundoBeat`,
    description: `Encuentra ${keyword} nuevos y usados en Chile. Compra musica fisica en tiendas independientes dentro de MundoBeat.`,
  };
}

export function getStoreCategorySeo(category: any, fallbackSlug: string, storeName: string) {
  const categoryName = category?.name || formatCategoryName(fallbackSlug);
  const keyword = categoryKeyword(categoryName);

  return {
    name: categoryName,
    title: `${categoryName} en ${storeName}`,
    description: `Explora ${keyword} disponibles en ${storeName}. Compra musica fisica nueva y usada con despacho en Chile desde MundoBeat.`,
  };
}

export function buildCategoryCollectionJsonLd(options: {
  name: string;
  description: string;
  url: string;
  storeName: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: options.name,
    description: options.description,
    url: options.url,
    isPartOf: {
      '@type': 'WebSite',
      name: options.storeName,
      url: options.url.replace(/\/categoria\/.*$/, ''),
    },
  };
}
