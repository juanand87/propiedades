const CDN_URL = process.env.NEXT_PUBLIC_ASSET_BASE_URL || 'http://localhost:3001';

export function getProductPrice(product: any) {
  const regular = Number(product?.price);
  const sale = Number(product?.salePrice);
  return product?.isOnSale && Number.isFinite(sale) && sale > 0 && sale < regular ? sale : Number.isFinite(regular) && regular > 0 ? regular : 0;
}

export function getProductGtin(product: any): string | undefined {
  for (const candidate of [product?.gtin, product?.barcode, product?.ean, product?.upc]) {
    const value = String(candidate || '').trim();
    if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) continue;
    const digits = value.slice(0, -1).split('').reverse();
    const sum = digits.reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
    if ((10 - sum % 10) % 10 === Number(value.at(-1))) return value;
  }
}

export function serializeProductJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function getInitialProductSummary(product: any, storeName: string, baseUrl: string) {
  return { title: product.title, price: getProductPrice(product), stock: Number(product.stock) || 0, images: getProductImages(product, baseUrl), shortDescription: buildProductSeoDescription(product, storeName) };
}

export function getProductSlug(product: any, fallback?: string) {
  return product?.slug || fallback || product?.id || '';
}

export function parseProductImages(images: any): string[] {
  if (!images) return [];
  if (Array.isArray(images)) {
    return images
      .map((image) => typeof image === 'string' ? image : image?.url || image?.src)
      .filter(Boolean);
  }

  try {
    const parsed = JSON.parse(images || '[]');
    return parseProductImages(parsed);
  } catch {
    return [];
  }
}

export function normalizeProductImage(image: string | undefined, fallbackBaseUrl: string) {
  if (!image) return `${fallbackBaseUrl}/og-default.jpg`;
  return image.startsWith('http') ? image : `${CDN_URL}/${image.replace(/^\/+/, '')}`;
}

export function getProductImages(product: any, fallbackBaseUrl: string) {
  const images = parseProductImages(product?.images);
  const normalized = images.map((image) => normalizeProductImage(image, fallbackBaseUrl));
  return normalized.length > 0 ? normalized : [`${fallbackBaseUrl}/og-default.jpg`];
}

export function getConditionLabel(condition?: string) {
  if (condition === 'new') return 'Nuevo';
  if (condition === 'used') return 'Usado';
  return '';
}

export function getConditionSchema(condition?: string) {
  if (condition === 'used') return 'https://schema.org/UsedCondition';
  return 'https://schema.org/NewCondition';
}

export function buildProductSeoTitle(product: any, storeName: string) {
  const parts = [product?.artist, product?.title || product?.album, product?.format, getConditionLabel(product?.condition)]
    .filter(Boolean);
  return `${parts.join(' - ')} | ${storeName}`;
}

export function buildProductSeoDescription(product: any, storeName: string) {
  const fallbackParts = [
    product?.artist,
    product?.title || product?.album,
    product?.format,
    getConditionLabel(product?.condition),
    product?.year,
  ].filter(Boolean);

  const fallback = `Compra ${fallbackParts.join(' - ')} en ${storeName}. Disponible en MundoBeat, marketplace de vinilos, CDs, cassettes y musica fisica en Chile.`;
  const description = product?.shortDescription || product?.description || fallback;
  return String(description).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
}


export function getProductBrandName(product: any): string | undefined {
  // Legacy imports concatenate labels and manufacturing companies in label.
  // Keep the primary release label, matching the product creation form.
  for (const candidate of [product?.label, product?.recordLabel, product?.brand]) {
    const primary = Array.isArray(candidate) ? candidate[0] : candidate;
    const value = typeof primary === 'string' ? primary : primary?.name;
    if (typeof value !== 'string') continue;
    const name = value.split(',')[0].trim();
    if (name) return name;
  }
}

export function buildProductJsonLd(product: any, options: {
  url: string;
  images: string[];
  storeName: string;
}) {
  const price = getProductPrice(product);
  const brandName = getProductBrandName(product);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product?.title,
    description: buildProductSeoDescription(product, options.storeName),
    image: options.images,
    url: options.url,
    sku: product?.sku || product?.id,
    gtin: getProductGtin(product),
    mpn: product?.catalogNumber || undefined,
    brand: brandName ? { '@type': 'Brand', name: brandName } : undefined,
    category: product?.category?.name || product?.categories?.[0]?.name || product?.format || undefined,
    itemCondition: getConditionSchema(product?.condition),
    offers: {
      '@type': 'Offer',
      url: options.url,
      priceCurrency: 'CLP',
      price: Number.isFinite(price) ? price : 0,
      itemCondition: getConditionSchema(product?.condition),
      availability: Number(product?.stock || 0) > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: product?.vendor?.storeName || options.storeName },
    },
  };
}


export function buildProductBreadcrumbJsonLd(product: any, options: {
  baseUrl: string;
  productUrl: string;
  storeName: string;
}) {
  const category = product?.category || product?.categories?.[0];
  const items: Array<{ name: string; item: string }> = [
    { name: options.storeName || 'Inicio', item: options.baseUrl },
    { name: 'Productos', item: options.baseUrl + '/productos' },
  ];

  if (category?.slug && category?.name) {
    items.push({
      name: category.name,
      item: options.baseUrl + '/categoria/' + category.slug,
    });
  }

  items.push({
    name: product?.title || 'Producto',
    item: options.productUrl,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  };
}
