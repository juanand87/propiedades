import { JwtService } from '@nestjs/jwt';
import { PropertyVideosService } from './property-videos.service';
import { Actor } from './rules';

describe('private property video previews', () => {
  const videoId = '11111111-1111-4111-8111-111111111111';
  const actor: Actor = {
    id: 'user-a',
    email: 'qa@example.com',
    firstName: 'QA',
    role: 'customer',
    advertiser_id: 'advertiser-a',
  };
  const env: Record<string, string> = {
    NODE_ENV: 'test',
    PROJECT_ID: 'propiedades',
    DB_DATABASE: 'propiedades',
    DB_HOST: '127.0.0.1',
    DB_PORT: '3327',
    PROPERTY_VIDEOS_ENABLED: 'true',
  };
  let jwt: JwtService;
  let db: { query: jest.Mock };
  let estate: { actor: jest.Mock };
  let service: PropertyVideosService;
  beforeEach(() => {
    jwt = new JwtService({ secret: 'qa-private-preview-secret-at-least-32' });
    db = {
      query: jest
        .fn()
        .mockResolvedValue([
          { id: videoId, size_bytes: 1024, advertiser_id: 'advertiser-a' },
        ]),
    };
    estate = { actor: jest.fn().mockResolvedValue(actor) };
    service = new PropertyVideosService(
      db as any,
      { get: (key: string) => env[key] } as any,
      estate as any,
      { enabled: false } as any,
      jwt,
      { urls: async () => new Map(), available: async () => false } as any,
    );
  });
  it('issues a two-minute capability bound to a single video and user', async () => {
    const result = await service.preview(actor, videoId);
    const token = new URL(result.url, 'http://localhost').searchParams.get(
      'signature',
    )!;
    const claims = jwt.verify(token, { audience: 'estate-video-preview' });
    expect(claims.sub).toBe(actor.id);
    expect(claims.videoId).toBe(videoId);
    expect(claims.exp - claims.iat).toBe(120);
    expect(() => jwt.verify(token, { audience: 'estate-session' })).toThrow();
  });
  it('denies other advertisers while allowing administrators', async () => {
    await expect(
      service.preview({ ...actor, advertiser_id: 'other' }, videoId),
    ).rejects.toThrow('no te pertenece');
    await expect(
      service.preview(
        { ...actor, role: 'admin', advertiser_id: undefined },
        videoId,
      ),
    ).resolves.toHaveProperty('url');
    db.query.mockResolvedValue([]);
    await expect(service.preview(actor, videoId)).rejects.toThrow(
      'Video no encontrado',
    );
  });
  it('rejects session tokens, expired signatures and signatures for another video', async () => {
    for (const token of [
      jwt.sign({ sub: actor.id, videoId, aud: 'estate-session' }),
      jwt.sign(
        { sub: actor.id, videoId, aud: 'estate-video-preview' },
        { expiresIn: -1 },
      ),
      jwt.sign({
        sub: actor.id,
        videoId: 'different',
        aud: 'estate-video-preview',
      }),
    ])
      await expect(
        service.previewContent(videoId, token, undefined, {}),
      ).rejects.toThrow('vista previa venció');
    expect(estate.actor).not.toHaveBeenCalled();
  });
  it('rechecks account and ownership before streaming, including ranges', async () => {
    const token = jwt.sign({
      sub: actor.id,
      videoId,
      aud: 'estate-video-preview',
    });
    const stream = jest
      .spyOn(service as any, 'serveContent')
      .mockResolvedValue('stream');
    const response = {};
    await expect(
      service.previewContent(videoId, token, 'bytes=0-99', response),
    ).resolves.toBe('stream');
    expect(estate.actor).toHaveBeenCalledWith(actor.id);
    expect(stream).toHaveBeenCalledWith(videoId, 1024, 'bytes=0-99', response);
    estate.actor.mockResolvedValue({ ...actor, advertiser_id: 'other' });
    await expect(
      service.previewContent(videoId, token, undefined, response),
    ).rejects.toThrow('no te pertenece');
    expect(stream).toHaveBeenCalledTimes(1);
  });
  it('continues denying public access to unpublished videos', async () => {
    db.query.mockResolvedValue([]);
    await expect(service.content(videoId, undefined, {})).rejects.toThrow(
      'Video no disponible',
    );
  });
  it('does not treat two missing advertiser IDs as ownership of a standalone video', async () => {
    db.query.mockResolvedValue([
      {
        id: videoId,
        size_bytes: 1024,
        created_by: actor.id,
        advertiser_id: null,
      },
    ]);
    await expect(
      service.preview(
        { ...actor, id: 'another-user', advertiser_id: null as any },
        videoId,
      ),
    ).rejects.toThrow('no te pertenece');
    await expect(
      service.preview({ ...actor, advertiser_id: undefined }, videoId),
    ).resolves.toHaveProperty('url');
  });
});
