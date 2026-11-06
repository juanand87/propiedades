import { ConfigService } from '@nestjs/config';
import { ImageStorageService } from './image-storage.service';
const env = {
  SPACES_IMAGES_ENABLED: 'true',
  SPACES_BUCKET: 'propiedades-imagenes',
  SPACES_REGION: 'sfo3',
  SPACES_ENDPOINT: 'https://sfo3.digitaloceanspaces.com',
  SPACES_ACCESS_KEY_ID: 'test-only',
  SPACES_SECRET_ACCESS_KEY: 'test-only',
  NODE_ENV: 'test',
};
const id = '00000000-0000-4000-8000-000000000001';
describe('private image storage', () => {
  it('uses private ACL, exact bucket and WebP only', async () => {
    const storage = new ImageStorageService(new ConfigService(env));
    const send = jest.fn().mockResolvedValue({});
    (storage as any).client.send = send;
    const key = storage.objectKey(id);
    await storage.put(key, Buffer.from('webp'));
    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'propiedades-imagenes',
      Key: key,
      ACL: 'private',
      ContentType: 'image/webp',
      CacheControl: 'private,no-store',
    });
    storage.onModuleDestroy();
  });
  it('does not expose credentials when the provider fails', async () => {
    const storage = new ImageStorageService(new ConfigService(env));
    (storage as any).client.send = jest
      .fn()
      .mockRejectedValue(new Error('secret-key-raw-data'));
    await expect(
      storage.put(storage.objectKey(id), Buffer.from('image')),
    ).rejects.toThrow('No se pudo guardar');
    storage.onModuleDestroy();
  });
  it('signs a 60-second private URL without a remote request', async () => {
    const storage = new ImageStorageService(new ConfigService(env));
    const url = new URL(await storage.signedRead(storage.objectKey(id)));
    expect(url.hostname).toBe(
      'propiedades-imagenes.sfo3.digitaloceanspaces.com',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
    expect(url.searchParams.get('response-cache-control')).toBe(
      'private,no-store',
    );
    await expect(
      storage.signedRead(`propiedades/imagenes/${id}.webp`),
    ).rejects.toThrow('otro entorno');
    storage.onModuleDestroy();
  });
  it('rejects disabled operations', async () => {
    const storage = new ImageStorageService(new ConfigService({}));
    expect(storage.enabled).toBe(false);
    await expect(
      storage.remove(`propiedades/pruebas/imagenes/${id}.webp`),
    ).rejects.toThrow('no configurado');
  });
});
