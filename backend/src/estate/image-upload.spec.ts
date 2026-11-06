import { EstateService } from './estate.service';
import sharp from 'sharp';
const actor = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'test@qa.invalid',
  role: 'customer',
  firstName: 'Test',
};
function mockService() {
  const queries: { sql: string; params: any[] }[] = [];
  const query = jest.fn(async (sql: string, params: any[] = []) => {
    queries.push({ sql, params });
    if (sql.includes('COUNT(*) n,COALESCE')) return [{ n: 0, bytes: 0 }];
    if (sql.includes("SET status='pending_delete'"))
      return { affectedRows: 1 } as any;
    return [];
  });
  const transaction = jest.fn(async (fn: any) => fn({ query }));
  const images = {
    enabled: true,
    config: { bucket: 'propiedades-imagenes' },
    objectKey: (id: string) => `propiedades/pruebas/imagenes/${id}.webp`,
    put: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const estate = new EstateService(
    { query, transaction } as any,
    { sign: () => 'test-signature' } as any,
    images as any,
  );
  return { estate, queries, query, transaction, images };
}
describe('Spaces image upload consistency', () => {
  async function image() {
    return sharp({
      create: { width: 12, height: 12, channels: 3, background: '#668877' },
    })
      .png()
      .toBuffer();
  }
  it('stores processed bytes remotely and keeps only a private reference in MySQL', async () => {
    const { estate, queries, images } = mockService();
    const result = await estate.upload(actor, {
      buffer: await image(),
      size: 100,
      originalname: 'Casa.png',
    });
    expect(images.put).toHaveBeenCalledTimes(1);
    expect((await sharp(images.put.mock.calls[0][1]).metadata()).format).toBe(
      'webp',
    );
    const record = queries.find((q) =>
      q.sql.startsWith('INSERT INTO estate_media('),
    );
    expect(record?.params[3]).toEqual(Buffer.alloc(0));
    expect(result.url).toContain('?signature=');
    expect(queries.some((q) => q.sql.includes("SET status='ready'"))).toBe(
      true,
    );
  });
  it('removes an orphan and keeps no media row when the DB transaction fails', async () => {
    const { estate, transaction, images, queries } = mockService();
    transaction.mockRejectedValueOnce(new Error('local db failed'));
    await expect(
      estate.upload(actor, { buffer: await image(), size: 100 }),
    ).rejects.toThrow('local db failed');
    expect(images.remove).toHaveBeenCalledTimes(1);
    expect(
      queries.some((q) => q.sql.includes("SET status='pending_delete'")),
    ).toBe(true);
  });
  it('retains durable cleanup metadata if Spaces cleanup is unavailable', async () => {
    const { estate, transaction, images, queries } = mockService();
    transaction.mockRejectedValueOnce(new Error('local db failed'));
    images.remove.mockRejectedValueOnce(new Error('provider offline'));
    await expect(
      estate.upload(actor, { buffer: await image(), size: 100 }),
    ).rejects.toThrow('local db failed');
    expect(
      queries.some((q) => q.sql.startsWith('DELETE FROM estate_media_objects')),
    ).toBe(false);
  });
  it('fails before upload if the migration has not been applied', async () => {
    const { estate, query, images } = mockService();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM estate_media_objects'))
        throw Error('schema missing');
      return [{ n: 0, bytes: 0 }];
    });
    await expect(
      estate.upload(actor, { buffer: await image(), size: 100 }),
    ).rejects.toThrow('schema missing');
    expect(images.put).not.toHaveBeenCalled();
  });
  it('does not delete an object when the commit succeeded but its acknowledgement was lost', async () => {
    const { estate, transaction, query, images } = mockService();
    transaction.mockRejectedValueOnce(new Error('commit acknowledgement lost'));
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*) n,COALESCE')) return [{ n: 0, bytes: 0 }];
      if (sql.includes("SET status='pending_delete'"))
        return { affectedRows: 0 } as any;
      if (sql.includes('SELECT m.id FROM estate_media'))
        return [{ id: actor.id }];
      return [];
    });
    const uploaded = await estate.upload(actor, {
      buffer: await image(),
      size: 100,
    });
    expect(uploaded.url).toContain('/api/media/');
    expect(images.remove).not.toHaveBeenCalled();
  });
});
