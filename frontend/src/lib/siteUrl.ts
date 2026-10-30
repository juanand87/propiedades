export function getSiteUrl(configured = process.env.NEXT_PUBLIC_SITE_URL): string {
  const url = new URL(configured || 'http://localhost:3000');
  if (/mundobeat|clownfish-app-x3a5k|tiendas-chi/i.test(url.hostname)) {
    throw new Error('NEXT_PUBLIC_SITE_URL apunta al proyecto heredado.');
  }
  return url.origin;
}
