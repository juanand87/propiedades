import { normalizeSavedFilters } from './saved-search.service';
import { propertyFilters } from './property-filters';
describe('saved property search filters', () => {
  it('canonicalizes filter order and removes an unused currency', () => {
    expect(
      normalizeSavedFilters({
        price_unit: 'UF',
        search: ' Los Lagos ',
        type_id: 'house',
      }),
    ).toEqual({ search: 'Los Lagos', type_id: 'house' });
    expect(
      JSON.stringify(
        normalizeSavedFilters({ type_id: 'house', search: 'Los Lagos' }),
      ),
    ).toBe(
      JSON.stringify(
        normalizeSavedFilters({ search: 'Los Lagos', type_id: 'house' }),
      ),
    );
  });
  it('keeps precise monetary limits', () => {
    expect(
      normalizeSavedFilters({
        max_price: '99999999999999.1234',
        price_unit: 'UF',
      }).max_price,
    ).toBe('99999999999999.1234');
  });
  it.each([
    {},
    [],
    null,
    { status: 'draft' },
    { price_unit: 'USD', max_price: '1' },
    { max_price: '80000000' },
    { price_unit: 'CLP', min_price: '100', max_price: '90' },
    { bedrooms: '-1' },
    { search: ['private'] },
    { operation_type: 'drop' },
  ])('rejects invalid filters %o', (input) => {
    expect(() => normalizeSavedFilters(input)).toThrow();
  });
  it('uses the same parameterized predicates as the catalog', () => {
    const result = propertyFilters(
      normalizeSavedFilters({
        search: "Los Lagos' OR 1=1",
        type_id: 'house',
        price_unit: 'CLP',
        max_price: '80000000',
      }),
    );
    expect(result.where.join(' AND ')).not.toContain('Los Lagos');
    expect(result.where.join(' AND ')).toContain('r.name LIKE ?');
    expect(result.params).toContain('80000000');
    expect(result.params).toContain('CLP');
  });
});
