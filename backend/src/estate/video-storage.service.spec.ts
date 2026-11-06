import { ConfigService } from '@nestjs/config';
import { VideoStorageService } from './video-storage.service';
const env = {
  NODE_ENV: 'test',
  SPACES_VIDEOS_ENABLED: 'true',
  SPACES_BUCKET: 'propiedades-imagenes',
  SPACES_REGION: 'sfo3',
  SPACES_ENDPOINT: 'https://sfo3.digitaloceanspaces.com',
  SPACES_ACCESS_KEY_ID: 'fake-only',
  SPACES_SECRET_ACCESS_KEY: 'fake-only',
};
const id = '00000000-0000-4000-8000-000000000001';
describe('private video storage', () => {
  it('stores MP4 files as private and signs short-lived playback URLs', async () => {
    const storage = new VideoStorageService(new ConfigService(env)),
      send = jest.fn().mockResolvedValue({});
    (storage as any).client.send = send;
    const key = storage.objectKey(id);
    await storage.put(key, Buffer.from('mp4'));
    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'propiedades-imagenes',
      Key: key,
      ContentType: 'video/mp4',
      ACL: 'private',
    });
    const url = new URL(await storage.signedRead(key));
    expect(url.hostname).toBe(
      'propiedades-imagenes.sfo3.digitaloceanspaces.com',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('120');
    await expect(
      storage.signedRead(`propiedades/videos/${id}.mp4`),
    ).rejects.toThrow();
    storage.onModuleDestroy();
  });
  it('does not expose provider secrets in errors and refuses disabled operations', async () => {
    const s = new VideoStorageService(new ConfigService(env));
    (s as any).client.send = jest
      .fn()
      .mockRejectedValue(Error('secret-provider-detail'));
    await expect(s.put(s.objectKey(id), Buffer.from('mp4'))).rejects.toThrow(
      'No se pudo guardar',
    );
    s.onModuleDestroy();
    const disabled = new VideoStorageService(new ConfigService({}));
    expect(disabled.enabled).toBe(false);
    await expect(
      disabled.remove(`propiedades/pruebas/videos/${id}.mp4`),
    ).rejects.toThrow();
  });
});
