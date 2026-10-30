import { createHash } from 'crypto';

export function normalizeWooCommerceStoreUrl(value: string): { storeUrl: string; identity: string } {
  const raw = String(value || '').trim();
  if (!raw) return { storeUrl: '', identity: '' };

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(withProtocol);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('La URL de WooCommerce debe usar HTTP o HTTPS');
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';

  const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
  const storeUrl = `${parsed.protocol}//${parsed.host}${pathname}`;
  const identityHost = parsed.hostname.replace(/^www\./, '');
  const defaultPort = (parsed.protocol === 'https:' && parsed.port === '443')
    || (parsed.protocol === 'http:' && parsed.port === '80');
  const identityPort = parsed.port && !defaultPort ? `:${parsed.port}` : '';

  return {
    storeUrl,
    identity: `${identityHost}${identityPort}${pathname}`.toLowerCase(),
  };
}

export function fingerprintIntegrationSecret(value: string): string {
  return createHash('sha256').update(String(value || '').trim()).digest('hex');
}
