export function stripHtml(input?: string | null) {
  return String(input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPageDescription(page: any, storeName: string) {
  const explicit = page?.metaDescription || page?.description;
  if (explicit) return stripHtml(explicit).slice(0, 160);

  const textBlock = Array.isArray(page?.blocks)
    ? page.blocks.find((block: any) => block?.type === 'text' && block?.text)
    : null;

  const text = stripHtml(textBlock?.text);
  if (text) return text.slice(0, 160);

  return `Informacion de ${storeName} en MundoBeat: ${page?.title || 'pagina de la tienda'}.`;
}

export function getPageTitle(page: any, storeName: string) {
  const title = stripHtml(page?.metaTitle || page?.title || 'Pagina');
  return title.includes(storeName) ? title : `${title} | ${storeName}`;
}

export function buildPageWebPageJsonLd(page: any, options: {
  url: string;
  storeName: string;
  description: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page?.title || 'Pagina',
    description: options.description,
    url: options.url,
    isPartOf: {
      '@type': 'WebSite',
      name: options.storeName,
      url: options.url.replace(/\/pagina\/.*$/, ''),
    },
  };
}
