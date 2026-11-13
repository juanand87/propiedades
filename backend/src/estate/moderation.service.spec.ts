import { DataSource } from 'typeorm';
import { ModerationService } from './moderation.service';
import { EstateService } from './estate.service';
import { PropertyVideosService } from './property-videos.service';
import { Actor } from './rules';
describe('moderation privilege boundaries', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const actor = {
    id: '00000000-0000-4000-8000-000000000002',
    role: 'customer',
  } as Actor;
  function setup() {
    const query = jest.fn().mockResolvedValue([]);
    const db = {
      query,
      transaction: jest.fn(
        async (fn: (tx: { query: typeof query }) => unknown) => fn({ query }),
      ),
    };
    return {
      query,
      service: new ModerationService(
        db as unknown as DataSource,
        {} as EstateService,
        {} as PropertyVideosService,
      ),
    };
  }
  it('denies all administrative operations before touching the database', async () => {
    const { service, query } = setup();
    for (const request of [
      service.list(actor, {}),
      service.detail(actor, id),
      service.review(actor, id, { action: 'hide', note: 'test' }),
      service.restore(actor, 'video', id, 'test'),
    ])
      await expect(request).rejects.toThrow('administración');
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects self-blocking and nonboolean block states', async () => {
    const { service, query } = setup();
    await expect(service.block(actor, actor.id, true)).rejects.toThrow(
      'propia cuenta',
    );
    await expect(service.block(actor, id, 'true')).rejects.toThrow(
      'Estado inválido',
    );
    expect(query).not.toHaveBeenCalled();
  });
  it('does not accept arbitrary target types or reasons', async () => {
    const { service, query } = setup();
    await expect(
      service.report(actor, { kind: 'sql', target_id: id, reason: 'spam' }),
    ).rejects.toThrow('Tipo de reporte');
    await expect(
      service.report(actor, {
        kind: 'video',
        target_id: id,
        reason: 'unknown',
      }),
    ).rejects.toThrow('motivo');
    expect(query).not.toHaveBeenCalled();
  });
  it('does not expose another private video through an own comment report', async () => {
    const { service, query } = setup();
    query.mockResolvedValue([
      { id, owner_id: actor.id, video_owner_id: 'other-owner', can_view: 0 },
    ]);
    await expect(
      service.report(actor, { kind: 'comment', target_id: id, reason: 'spam' }),
    ).rejects.toThrow('Contenido no disponible');
  });
  it('cannot restore administrator accounts through a restriction record', async () => {
    const { service, query } = setup();
    query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.startsWith('SELECT hidden')
          ? [{ hidden: 1 }]
          : sql.startsWith('SELECT role')
            ? [{ role: 'admin' }]
            : [],
      ),
    );
    await expect(
      service.restore({ ...actor, role: 'admin' }, 'user', id, 'QA restore'),
    ).rejects.toThrow('administradores');
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      expect.anything(),
    );
  });
  it('requires a note and compatible decision before changing content', async () => {
    const { service, query } = setup();
    await expect(
      service.review({ ...actor, role: 'admin' }, id, {
        action: 'hide',
        note: '',
      }),
    ).rejects.toThrow('motivo');
    expect(query).not.toHaveBeenCalled();
    query.mockResolvedValue([
      { id, target_kind: 'user', target_id: actor.id, status: 'open' },
    ]);
    await expect(
      service.review({ ...actor, role: 'admin' }, id, {
        action: 'hide',
        note: 'QA incompatible',
      }),
    ).rejects.toThrow('Acción no válida');
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE estate_reports'),
      expect.anything(),
    );
  });
});
