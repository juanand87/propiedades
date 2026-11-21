import { ConfigService } from '@nestjs/config';
import { VideoSocialService } from './video-social.service';
import { DataSource } from 'typeorm';
import { PropertyVideosService } from './property-videos.service';
import { EstateService } from './estate.service';
import { PushService } from './push.service';
import { ActivityService } from './activity.service';
import { ModerationService } from './moderation.service';

describe('linking a video preserves its publication choice', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const propertyId = '00000000-0000-4000-8000-000000000002';
  const owner = {
    id: 'owner',
    role: 'vendor',
    firstName: 'QA',
    email: 'qa@example.test',
  };
  function setup(status: string, linked: string | null = null) {
    const current = { id, created_by: owner.id, status, property_id: linked };
    const query = jest.fn(async (sql: string) =>
      sql.startsWith('UPDATE') ? { affectedRows: 1 } : [current],
    );
    const estate = {
      get: jest
        .fn()
        .mockResolvedValue({
          id: propertyId,
          publication_status: 'pending_review',
        }),
    };
    const db = {
      query,
      transaction: async (fn: (tx: { query: typeof query }) => Promise<void>) =>
        fn({ query }),
    };
    const service = new VideoSocialService(
      db as unknown as DataSource,
      new ConfigService({ SOCIAL_VIDEOS_ENABLED: 'true' }),
      {} as PropertyVideosService,
      estate as unknown as EstateService,
      {} as PushService,
      {} as ActivityService,
      {} as ModerationService,
    );
    jest.spyOn(service, 'details').mockResolvedValue({} as never);
    return { service, query, estate };
  }
  it.each(['published', 'draft'])(
    'keeps %s when linking to a property awaiting review',
    async (status) => {
      const { service, query, estate } = setup(status);
      await service.link(owner, id, propertyId);
      expect(estate.get).toHaveBeenCalledWith(propertyId, owner);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE property_videos'),
        [propertyId, status, id],
      );
    },
  );
  it('keeps an already linked published video published on a repeated link', async () => {
    const { service, query } = setup('published', propertyId);
    await service.link(owner, id, propertyId);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE property_videos'),
      [propertyId, 'published', id],
    );
  });
  it('does not expose a linked video as standalone when unlinking', async () => {
    const { service, query } = setup('published', propertyId);
    await service.link(owner, id, null);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE property_videos'),
      [null, 'draft', id],
    );
  });
  it('refuses links by a different user', async () => {
    const { service, query } = setup('published');
    await expect(
      service.link({ ...owner, id: 'other' }, id, propertyId),
    ).rejects.toThrow();
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(
      false,
    );
  });
});
