import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { VideoSocialService } from './video-social.service';
import { PropertyVideosService } from './property-videos.service';
import { EstateService } from './estate.service';
import { PushService } from './push.service';
import { ActivityService } from './activity.service';
import { Actor } from './rules';

describe('notification comment destinations', () => {
  const videoId = '00000000-0000-4000-8000-000000000001';
  const targetId = '00000000-0000-4000-8000-000000000002';
  const parentId = '00000000-0000-4000-8000-000000000003';
  const ownerId = '00000000-0000-4000-8000-000000000004';
  function setup({ visible = true, target = true, recent = false } = {}) {
    const row = { id: targetId, parent_id: parentId, body: 'Reply' };
    const query = jest.fn((sql: string, params: string[]) => {
      if (sql.includes('SELECT v.*'))
        return Promise.resolve([
          { can_view: visible ? 1 : 0, created_by: ownerId },
        ]);
      if (sql.includes('ORDER BY'))
        return Promise.resolve(
          recent ? [row, { id: parentId }] : [{ id: 'recent' }],
        );
      if (params[1] === targetId) return Promise.resolve(target ? [row] : []);
      if (params[1] === parentId)
        return Promise.resolve([{ id: parentId, body: 'Parent' }]);
      throw new Error('Unexpected query');
    });
    return {
      query,
      service: new VideoSocialService(
        { query } as unknown as DataSource,
        new ConfigService({ SOCIAL_VIDEOS_ENABLED: 'true' }),
        {} as PropertyVideosService,
        {} as EstateService,
        {} as PushService,
        {} as ActivityService,
      ),
    };
  }
  it('includes an old reply and its parent outside the latest page', async () => {
    const { service, query } = setup();
    expect(
      (await service.comments(videoId, undefined, targetId)).map((c) => c.id),
    ).toEqual([parentId, targetId, 'recent']);
    for (const [sql, params] of query.mock.calls.slice(1)) {
      expect(sql).toContain('c.video_id=?');
      expect(params[0]).toBe(videoId);
    }
  });
  it('does not duplicate a target or parent already in the page', async () => {
    const { service } = setup({ recent: true });
    expect(
      (await service.comments(videoId, undefined, targetId)).map((c) => c.id),
    ).toEqual([targetId, parentId]);
  });
  it('reports deleted comments or comments belonging to another video', async () => {
    const { service } = setup({ target: false });
    await expect(
      service.comments(videoId, undefined, targetId),
    ).rejects.toThrow('ya no está disponible');
  });
  it('does not expose a private video to another user', async () => {
    const { service, query } = setup({ visible: false });
    await expect(
      service.comments(videoId, { id: 'other' } as Actor, targetId),
    ).rejects.toThrow('Video no disponible');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('allows the owner to open a notification on their own draft', async () => {
    const { service } = setup({ visible: false });
    expect(
      await service.comments(videoId, { id: ownerId } as Actor, targetId),
    ).toHaveLength(3);
  });
  it('rejects malformed comment IDs', async () => {
    const { service } = setup();
    await expect(
      service.comments(videoId, undefined, '../other'),
    ).rejects.toThrow();
  });
});
