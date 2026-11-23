/* Database doubles intentionally accept heterogeneous query results. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { ProfileStoriesService } from './profile-stories.service';
const id = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
function setup() {
  const query = jest.fn<any>(),
    profile = jest.fn<any>().mockResolvedValue({ id });
  const db: any = {
    query,
    transaction: (fn: (tx: { query: typeof query }) => Promise<unknown>) =>
      fn({ query }),
  };
  return {
    query,
    profile,
    service: new ProfileStoriesService(
      db,
      { profile } as any,
      { mediaUrl: () => '/signed-image' } as any,
      {} as any,
    ),
  };
}
describe('Profile stories', () => {
  it('checks profile visibility before retrieving stories', async () => {
    const t = setup();
    t.profile.mockRejectedValueOnce(new Error('blocked'));
    await expect(t.service.list(other, { id } as any)).rejects.toThrow(
      'blocked',
    );
    expect(t.query).not.toHaveBeenCalled();
  });
  it('filters expired and deleted stories at the database', async () => {
    const t = setup();
    t.query.mockResolvedValueOnce([]);
    expect(await t.service.list(id, { id } as any)).toEqual({ items: [] });
    expect(t.query.mock.calls[0][0]).toContain('expires_at>UTC_TIMESTAMP()');
    expect(t.query.mock.calls[0][0]).toContain('deleted_at IS NULL');
  });
  it('rejects ambiguous story content', async () => {
    const t = setup();
    await expect(
      t.service.create({ id } as any, { media_id: id, video_id: other }),
    ).rejects.toThrow();
    expect(t.query).not.toHaveBeenCalled();
  });
  it('rejects a photo owned by someone else', async () => {
    const t = setup();
    t.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ n: 0 }])
      .mockResolvedValueOnce([]);
    await expect(
      t.service.create({ id } as any, { media_id: other }),
    ).rejects.toThrow('pertenecer');
    expect(t.query.mock.calls[2][1]).toEqual([other, id]);
    expect(t.query).toHaveBeenCalledTimes(3);
  });
  it('limits active stories under an owner lock', async () => {
    const t = setup();
    t.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ n: 20 }]);
    await expect(
      t.service.create({ id } as any, { media_id: other }),
    ).rejects.toThrow('20');
    expect(t.query.mock.calls[0][0]).toContain('FOR UPDATE');
  });
  it('publishes an owned photo for exactly 24 hours', async () => {
    const t = setup();
    t.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ n: 0 }])
      .mockResolvedValueOnce([{ id: other }])
      .mockResolvedValueOnce({});
    await expect(
      t.service.create({ id } as any, { media_id: other }),
    ).resolves.toHaveProperty('id');
    expect(t.query.mock.calls[3][0]).toContain('INTERVAL 24 HOUR');
  });
  it('only lets the owner delete a story', async () => {
    const t = setup();
    t.query.mockResolvedValueOnce({ affectedRows: 0 });
    await expect(t.service.remove({ id } as any, other)).rejects.toThrow();
    expect(t.query.mock.calls[0][1]).toEqual([other, id]);
  });
});
