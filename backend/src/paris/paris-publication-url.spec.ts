import { getParisPublicationUrl } from './paris-publication-url';
import { ParisService } from './paris.service';

describe('Paris publication link', () => {
  it.each([
    { productUrl: 'https://www.paris.cl/product/test' },
    { data: { product: { publicUrl: '/producto/test.html' } } },
    { variants: [{ permalink: 'https://paris.cl/product/test' }] },
  ])('reads a public Paris URL from the product response', data => {
    expect(getParisPublicationUrl(data)).toMatch(/^https:\/\/(www\.)?paris\.cl\//);
  });
  it.each(['javascript:alert(1)', 'https://paris.cl.evil.test/product/test', 'https://evil.test/test', 'https://user:password@paris.cl/product/test', '//evil.test/product', 'CD-2026-001', 'https://www.paris.cl/image.jpg'])('rejects unsafe URLs or non-public identifiers %s', url => {
    expect(getParisPublicationUrl({ url })).toBeNull();
  });
  it('returns no link when Paris only supplies internal IDs', () => {
    expect(getParisPublicationUrl({ id: '123', sellerSku: 'CD-001' })).toBeNull();
  });
  it('checks ownership before querying Paris', async () => {
    const service: any = new ParisService({} as any, { findOne: jest.fn().mockResolvedValue(null) } as any);
    service.request = jest.fn();
    await expect(service.getPublicationLink('product', 'other-vendor')).rejects.toThrow('Producto no encontrado');
    expect(service.request).not.toHaveBeenCalled();
  });
  it('only reads the linked product and does not synchronize it', async () => {
    const products: any = { findOne: jest.fn().mockResolvedValue({ parisProductId: 'linked-id' }), save: jest.fn() };
    const service: any = new ParisService({} as any, products);
    service.request = jest.fn().mockResolvedValue({ productUrl: 'https://www.paris.cl/product/test' });
    await expect(service.getPublicationLink('product', 'vendor')).resolves.toEqual({ url: 'https://www.paris.cl/product/test' });
    expect(service.request).toHaveBeenCalledWith('vendor', '/v2/products/linked-id');
    expect(products.save).not.toHaveBeenCalled();
  });
  it('explains when the linked product has no public URL', async () => {
    const service: any = new ParisService({} as any, { findOne: jest.fn().mockResolvedValue({ parisProductId: 'linked-id' }) } as any);
    service.request = jest.fn().mockResolvedValue({ id: 'linked-id' });
    await expect(service.getPublicationLink('product', 'vendor')).rejects.toThrow('no entrega un enlace público');
  });
});
