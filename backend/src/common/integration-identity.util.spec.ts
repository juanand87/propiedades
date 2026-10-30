import { fingerprintIntegrationSecret, normalizeWooCommerceStoreUrl } from './integration-identity.util';

describe('integration identities', () => {
  it('normalizes equivalent WooCommerce store URLs to the same identity', () => {
    expect(normalizeWooCommerceStoreUrl('https://www.Tienda.cl/').identity).toBe('tienda.cl');
    expect(normalizeWooCommerceStoreUrl('http://tienda.cl').identity).toBe('tienda.cl');
  });

  it('keeps subdirectory installations in the WooCommerce identity', () => {
    expect(normalizeWooCommerceStoreUrl('https://tienda.cl/catalogo/').identity).toBe('tienda.cl/catalogo');
  });

  it('generates a stable, irreversible fingerprint for integration secrets', () => {
    const fingerprint = fingerprintIntegrationSecret(' api-key ');
    expect(fingerprint).toBe(fingerprintIntegrationSecret('api-key'));
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain('api-key');
  });
});
