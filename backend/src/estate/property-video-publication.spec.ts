import { EntityManager } from 'typeorm';
import { PropertyVideoPublicationService } from './property-video-publication.service';

describe('publishing the source video with an approved property', () => {
  const service = new PropertyVideoPublicationService();
  function setup() {
    const query = jest.fn(async (sql: string, _params?: unknown[]) =>
      sql.includes('information_schema') ? [{ n: 1 }] : { affectedRows: 1 },
    );
    return { query, tx: { query } as unknown as EntityManager };
  }
  it.each(['draft', 'pending_review'])(
    'registers a source video linked to a %s property without publishing it',
    async (status) => {
      const { tx, query } = setup();
      await service.link(tx, 'video', 'property', 'owner', status);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining(
          'INSERT INTO estate_property_video_publication',
        ),
        ['video', 'property', 'owner'],
      );
      expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(
        false,
      );
    },
  );
  it('does not publish a draft linked to an already published property without explicit intent', async () => {
    const { tx, query } = setup();
    await service.link(tx, 'video', 'property', 'owner', 'published');
    expect(
      query.mock.calls.some(
        ([sql]) => sql.startsWith('INSERT') || sql.startsWith('UPDATE'),
      ),
    ).toBe(false);
  });
  it('handles approval before the explicit source-link request', async () => {
    const { tx, query } = setup();
    await service.link(tx, 'video', 'property', 'owner', 'published', true);
    const update = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'));
    expect(update?.[1]).toEqual(['property', 'video']);
  });
  it('requires approved property, active accounts and a non-moderated draft', async () => {
    const { tx, query } = setup();
    await expect(service.approve(tx, 'property')).resolves.toBe(1);
    const sql =
      query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'))?.[0] || '';
    for (const condition of [
      "p.publication_status='published'",
      "a.status='approved'",
      "v.status='draft'",
      'owner.isActive=1',
      'creator.isActive=1',
      'restriction.hidden=1',
      'intent.property_id=v.property_id',
    ])
      expect(sql).toContain(condition);
  });
  it('cancels the intent when unlinking or manually changing video state', async () => {
    const { tx, query } = setup();
    await service.link(tx, 'video', null, 'owner');
    await service.cancel(tx, 'video');
    expect(
      query.mock.calls.filter(([sql]) => sql.startsWith('DELETE')),
    ).toHaveLength(2);
    expect(
      query.mock.calls.some(
        ([sql]) => sql.startsWith('INSERT') || sql.startsWith('UPDATE'),
      ),
    ).toBe(false);
  });
  it('does not require the video migration for unrelated existing deployments', async () => {
    const query = jest.fn().mockResolvedValue([{ n: 0 }]);
    const tx = { query } as unknown as EntityManager;
    await service.link(tx, 'video', 'property', 'owner', 'draft');
    await expect(service.approve(tx, 'property')).resolves.toBe(0);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
