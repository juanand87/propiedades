const KNOWN_PAGE_ID_TO_SLUG: Record<string, string> = {
  '9ab243a6-ca62-4025-8c73-6cf9ffc920a4': 'politicas-de-envio',
  '8874c8e0-ad97-48ff-bdd4-a135df3fd002': 'terminos-y-condiciones',
  '733c822e-e98f-49c0-b1d5-8a68c9e22e06': 'como-comprar-en-mundo-beat',
  'f0753708-abe2-4ca7-b32d-b2e1a3c91ad4': 'vende-en-mundo-beat',
};

function slugifyPageLabel(label?: string) {
  return String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolvePageSlugFromMenuItem(item: any, pages: any[] = []) {
  if (!item) return undefined;
  if (item.pageSlug) return item.pageSlug;

  const pageId = item.pageId;
  const linkedPage = pageId ? pages.find(page => page.id === pageId) : null;
  if (linkedPage?.slug) return linkedPage.slug;
  if (pageId && KNOWN_PAGE_ID_TO_SLUG[pageId]) return KNOWN_PAGE_ID_TO_SLUG[pageId];

  const labelSlug = slugifyPageLabel(item.label || item.title);
  const pageByLabel = labelSlug ? pages.find(page => page.slug === labelSlug) : null;
  return pageByLabel?.slug || labelSlug || undefined;
}
