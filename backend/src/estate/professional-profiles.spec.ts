import { EstateService } from './estate.service';
import type { Actor } from './rules';
const actor: Actor = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'admin',
  email: 'admin@example.invalid',
  firstName: 'Admin',
};
describe('professional profile permissions', () => {
  function setup() {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query = (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return Promise.resolve(
        sql.startsWith('SELECT') ? [{ id: actor.id, user_id: actor.id }] : [],
      );
    };
    const service = Object.create(EstateService.prototype) as EstateService;
    Object.assign(service, {
      db: {
        query,
        transaction: (fn: (tx: { query: typeof query }) => Promise<unknown>) =>
          fn({ query }),
      },
    });
    return { service, calls };
  }
  it('requires an administrator to change another account profile type', async () => {
    const { service, calls } = setup();
    await expect(
      service.updateUser({ ...actor, role: 'customer' }, actor.id, {
        profile_kind: 'company',
      }),
    ).rejects.toThrow('administración');
    expect(calls).toHaveLength(0);
  });
  it.each(['person', 'agent', 'company'])(
    'changes %s independently of roles, memberships and publication permissions',
    async (profile_kind) => {
      const { service, calls } = setup();
      await service.updateUser(actor, actor.id, { profile_kind });
      expect(
        calls.some((c) => c.sql.startsWith('UPDATE estate_profile_identity')),
      ).toBe(true);
      expect(
        calls.some((c) =>
          /UPDATE users|estate_user_memberships|publication_permissions/.test(
            c.sql,
          ),
        ),
      ).toBe(false);
    },
  );
  it('rejects unrecognized profile types', async () => {
    const { service, calls } = setup();
    await expect(
      service.updateUser(actor, actor.id, { profile_kind: 'admin' }),
    ).rejects.toThrow('Opción inválida');
    expect(calls).toHaveLength(0);
  });
});
