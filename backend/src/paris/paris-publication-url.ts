export function getParisPublicationUrl(data: unknown): string | null {
  const keys = ['publicUrl', 'productUrl', 'publicationUrl', 'permalink', 'url', 'link'];
  function visit(value: any, depth: number): string | null {
    if (!value || typeof value !== 'object' || depth > 4) return null;
    for (const key of keys) {
      if (typeof value[key] !== 'string') continue;
      if (!/^https:\/\//i.test(value[key]) && !/^\/(?!\/)/.test(value[key])) continue;
      try {
        const url = new URL(value[key], 'https://www.paris.cl');
        if (url.protocol === 'https:' && ['paris.cl', 'www.paris.cl'].includes(url.hostname) && !url.username && !url.password && !url.port && url.pathname !== '/' && !/\.(png|jpg|jpeg|webp|gif|svg)(?:$|\/)/i.test(url.pathname)) return url.href;
      } catch { /* The API may return a non-web identifier in this field. */ }
    }
    for (const child of Array.isArray(value) ? value.slice(0, 100) : [value.data, value.product, value.products, value.variants, value.results]) {
      const result = visit(child, depth + 1);
      if (result) return result;
    }
    return null;
  }
  return visit(data, 0);
}
