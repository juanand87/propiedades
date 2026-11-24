import { CompanyTeamService } from './company-team.service';
import {
  invitationToken,
  invitedEmail,
  proposalChanges,
} from './company-team.rules';
import { EstateService } from './estate.service';
import { DataSource, EntityManager } from 'typeorm';
import { ReviewMailService } from './review-mail.service';
import { ConfigService } from '@nestjs/config';
import { Actor } from './rules';
const id = '11111111-1111-4111-8111-111111111111';
const agent = '22222222-2222-4222-8222-222222222222';
const property = '33333333-3333-4333-8333-333333333333';
const actor: Actor = {
  id,
  email: 'owner@example.invalid',
  firstName: 'Owner',
  role: 'vendor',
};
function setup(rows: unknown[][]) {
  const query = jest
    .fn()
    .mockImplementation(() => Promise.resolve(rows.shift() || []));
  const tx = { query };
  const db = {
    query,
    transaction: async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx),
  };
  const estate = {
    saveProperty: jest.fn().mockResolvedValue({ id: property }),
  };
  const service = new CompanyTeamService(
    db as unknown as DataSource,
    estate as unknown as EstateService,
    {} as ReviewMailService,
    {} as ConfigService,
  );
  return { service, query, estate, tx };
}
describe('Company team boundaries', () => {
  it('accepts exactly 32 random bytes encoded in hex', () =>
    expect(invitationToken('a'.repeat(64))).toHaveLength(64));
  it.each(['', undefined, 'a'.repeat(63), '../owner', 'z'.repeat(64)])(
    'rejects malformed invitation %s',
    (v) => expect(() => invitationToken(v)).toThrow(),
  );
  it('matches only the invited email, ignoring case and whitespace', () => {
    expect(() =>
      invitedEmail(' Agent@Example.invalid ', 'agent@example.invalid'),
    ).not.toThrow();
    expect(() =>
      invitedEmail('other@example.invalid', 'agent@example.invalid'),
    ).toThrow();
  });
  it.each([
    'advertiser_id',
    'publication_status',
    'role',
    'media_ids',
    'direct_publication',
    '__proto__',
  ])('rejects privileged field %s', (key) =>
    expect(() => proposalChanges(Object.fromEntries([[key, 'x']]))).toThrow(),
  );
  it.each([
    null,
    [],
    {},
    { price_amount: Infinity },
    { description: 'x'.repeat(10001) },
  ])('rejects invalid changes %#', (v) =>
    expect(() => proposalChanges(v)).toThrow(),
  );
  it('preserves allowed descriptive edits only', () =>
    expect(proposalChanges({ title: 'Casa', price_amount: 123 })).toEqual({
      title: 'Casa',
      price_amount: 123,
    }));
  it('denies team ownership before assigning any property', async () => {
    const { service, query } = setup([[]]);
    await expect(
      service.assign(actor, {
        user_id: agent,
        property_id: property,
        can_edit: true,
      }),
    ).rejects.toThrow('empresa propietaria');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('rejects properties from another company', async () => {
    const { service, query } = setup([
      [{ id, advertiser_id: id }],
      [{ user_id: agent }],
      [],
    ]);
    await expect(
      service.assign(actor, {
        user_id: agent,
        property_id: property,
        can_edit: true,
      }),
    ).rejects.toThrow('tus propiedades');
    expect(
      query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT')),
    ).toBe(false);
  });
  it('rejects non-members even with a company property', async () => {
    const { service } = setup([
      [{ id, advertiser_id: id }],
      [],
      [{ id: property }],
    ]);
    await expect(
      service.assign(actor, {
        user_id: agent,
        property_id: property,
        can_edit: true,
      }),
    ).rejects.toThrow('agentes activos');
  });
  it('rejects a revoked assignment', async () => {
    const { service } = setup([[]]);
    await expect(
      service.propose(actor, id, property, {
        revision: 1,
        changes: { title: 'Casa' },
      }),
    ).rejects.toThrow('acceso fue retirado');
  });
  it('rejects edits with read-only permission', async () => {
    const { service } = setup([[{ can_edit: 0, revision: 1 }]]);
    await expect(
      service.propose(actor, id, property, {
        revision: 1,
        changes: { title: 'Casa' },
      }),
    ).rejects.toThrow('lectura');
  });
  it('rejects outdated proposals before writing', async () => {
    const { service, query } = setup([[{ can_edit: 1, revision: 2 }]]);
    await expect(
      service.propose(actor, id, property, {
        revision: 1,
        changes: { title: 'Casa' },
      }),
    ).rejects.toThrow('cambió');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('denies acceptance by another email', async () => {
    const { service, query } = setup([
      [{ n: 6 }],
      [
        {
          id,
          team_id: id,
          email: 'other@example.invalid',
          owner_user_id: agent,
        },
      ],
    ]);
    await expect(service.accept(actor, 'a'.repeat(64))).rejects.toThrow(
      'correo',
    );
    expect(
      query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT')),
    ).toBe(false);
  });
  it('rejects expired, revoked or already consumed invitations', async () => {
    const { service, query } = setup([[{ n: 6 }], []]);
    await expect(service.accept(actor, 'a'.repeat(64))).rejects.toThrow(
      'venció',
    );
    const calls = query.mock.calls as [string, unknown[]][];
    expect(calls[1][0]).toContain("i.status='pending'");
    expect(calls[1][0]).toContain('i.expires_at>UTC_TIMESTAMP(3) FOR UPDATE');
  });
  it('revokes assignments and pending proposals with membership', async () => {
    const { service, query } = setup([[{ id, advertiser_id: id }]]);
    await service.revoke(actor, agent);
    expect(query.mock.calls.map(([sql]) => String(sql)).join(' ')).toMatch(
      /status='revoked'.*DELETE FROM estate_company_property_assignments.*status='rejected'/,
    );
  });
  it('applies a proposal as the company owner in the same transaction', async () => {
    const { service, estate, tx } = setup([
      [{ id, advertiser_id: id }],
      [
        {
          id,
          property_id: property,
          user_id: agent,
          base_revision: 7,
          changes_json: { title: 'Nueva casa' },
        },
      ],
      [{ user_id: agent }],
      [{ advertiser_id: id }],
    ]);
    await service.review(actor, id, true);
    expect(estate.saveProperty).toHaveBeenCalledWith(
      actor,
      { title: 'Nueva casa', revision: 7 },
      property,
      tx as unknown as EntityManager,
    );
  });
  it('cannot apply after permission is withdrawn', async () => {
    const { service, estate } = setup([
      [{ id, advertiser_id: id }],
      [
        {
          id,
          property_id: property,
          user_id: agent,
          base_revision: 7,
          changes_json: { title: 'Nueva casa' },
        },
      ],
      [],
    ]);
    await expect(service.review(actor, id, true)).rejects.toThrow(
      'ya no tiene permiso',
    );
    expect(estate.saveProperty).not.toHaveBeenCalled();
  });
});
