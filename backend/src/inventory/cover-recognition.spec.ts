import { CoverRecognitionService, COVER_MODEL } from './cover-recognition.service';
import { InventoryCover } from './inventory.entity';

describe('inventory cover matching boundaries', () => {
  it('requires indexed images before running model inference', async () => {
    const covers = { countBy: jest.fn().mockResolvedValue(0) };
    const service = new CoverRecognitionService({ getRepository: () => covers } as any, { requireReady: async () => {} } as any);
    const embed = jest.spyOn(service, 'embed');
    await expect(service.search('vendor', Buffer.alloc(0))).rejects.toThrow('aún no tiene portadas');
    expect(embed).not.toHaveBeenCalled();
    expect(covers.countBy).toHaveBeenCalledWith({ vendorId: 'vendor', status: 'ready', model: COVER_MODEL });
  });
  it('scopes both vectors and products to the store and discards changed covers', async () => {
    const url = 'https://mundobeat.nyc3.cdn.digitaloceanspaces.com/media/cover.jpg';
    const covers = { countBy: jest.fn().mockResolvedValue(2), find: jest.fn() };
    const products = { find: jest.fn().mockResolvedValue([{ id: 'current', images: [url] }, { id: 'stale', images: [url + '?new'] }]) };
    const service = new CoverRecognitionService({ getRepository: entity => entity === InventoryCover ? covers : products } as any, { requireReady: async () => {} } as any);
    covers.find.mockResolvedValue([{ productId: 'current', vector: [1, 0], sourceHash: service.hash(url) }, { productId: 'stale', vector: [1, 0], sourceHash: service.hash(url) }]);
    jest.spyOn(service, 'embed').mockResolvedValue([1, 0]);
    const result = await service.search('vendor', Buffer.alloc(0));
    expect(result.matches.map(match => match.product!.id)).toEqual(['current']);
    expect(covers.find).toHaveBeenCalledWith(expect.objectContaining({ where: { vendorId: 'vendor', status: 'ready', model: COVER_MODEL }, take: 250 }));
    expect(products.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ vendor: { id: 'vendor' } }) }));
  });
  it.each(['http://localhost/a.jpg', 'https://127.0.0.1/a.jpg', 'file:///etc/passwd', 'https://user:secret@i.discogs.com/a.jpg', 'https://i.discogs.com:8443/a.jpg'])('rejects unsafe image source %s', async value => {
    const service = new CoverRecognitionService({} as any, {} as any);
    await expect((service as any).fetchCover(value)).rejects.toThrow();
  });
});
