import { EstateService } from './estate.service';
describe('API inmobiliaria: privacidad y filtros', () => {
  const row = {
    id: 'p',
    advertiser_id: 'a',
    title: 'Casa',
    publication_status: 'published',
    show_exact_address: 0,
    moderation_reason: 'privado',
    created_by: 'secret',
    display_name: 'Anunciante',
    price_amount: '12000.1234',
  };
  function service() {
    const query = jest.fn(async (sql: string) => {
      if (sql.startsWith('SELECT p.')) return [row];
      if (sql === 'SELECT status FROM advertisers WHERE id=?')
        return [{ status: 'approved' }];
      return [];
    });
    return { api: new EstateService({ query } as any, {} as any), query };
  }
  it('no incluye notas, identidad interna ni dirección privada en la ficha pública', async () => {
    const { api, query } = service();
    const p = await api.get('p');
    expect(p.location).toBeNull();
    expect(p).not.toHaveProperty('moderation_reason');
    expect(p).not.toHaveProperty('created_by');
    expect(p.price_amount).toBe('12000.1234');
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes('property_private_locations'),
      ),
    ).toBe(false);
  });
  it('rechaza acceso de otro anunciante antes de hidratar información privada', async () => {
    const { api } = service();
    await expect(
      api.get('p', {
        id: 'u',
        email: 'u@e.test',
        role: 'vendor',
        firstName: 'User',
        advertiser_id: 'other',
      }),
    ).rejects.toThrow();
  });
  it('exige unidad explícita para comparar y ordenar importes', async () => {
    const { api } = service();
    await expect(api.list({ min_price: '100' })).rejects.toThrow('CLP o UF');
    await expect(api.list({ sort: 'price_asc' })).rejects.toThrow('CLP o UF');
  });
});
