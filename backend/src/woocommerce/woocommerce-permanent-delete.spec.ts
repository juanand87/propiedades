import { WoocommerceService } from './woocommerce.service';

describe('WoocommerceService permanentlyDeleteProduct', () => {
  const product = {
    id: 'product-1',
    title: 'Producto de prueba',
    woocommerceId: '123',
    vendor: {
      id: 'vendor-1',
      settings: {
        wooStoreUrl: 'https://tienda.example',
        wooClientKey: 'key',
        wooClientSecret: 'secret',
      },
    },
  };

  function createService(deleteMock: jest.Mock) {
    const service = new WoocommerceService(
      { findOne: jest.fn().mockResolvedValue(product) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service as any, 'createWooClient').mockReturnValue({ delete: deleteMock });
    return service;
  }

  it('requests a forced deletion in WooCommerce', async () => {
    const deleteMock = jest.fn().mockResolvedValue({ data: { id: 123 } });
    const result = await createService(deleteMock).permanentlyDeleteProduct('product-1', 'vendor-1');

    expect(deleteMock).toHaveBeenCalledWith('products/123', { force: true });
    expect(result.success).toBe(true);
    expect(result.alreadyDeleted).toBeUndefined();
  });

  it('treats a missing WooCommerce product as already deleted', async () => {
    const deleteMock = jest.fn().mockRejectedValue({ response: { status: 404 } });
    const result = await createService(deleteMock).permanentlyDeleteProduct('product-1', 'vendor-1');

    expect(result.success).toBe(true);
    expect(result.alreadyDeleted).toBe(true);
  });
});
