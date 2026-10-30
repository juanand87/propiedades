import { calculateDiscount, matchesDiscount } from './discount-rules';

describe('discount rules', () => {
  it('rounds CLP, caps the benefit and never discounts beyond the eligible value', () => {
    expect(calculateDiscount(7999, 10)).toBe(800);
    expect(calculateDiscount(100000, 40, 5000)).toBe(5000);
    expect(calculateDiscount(100, 200)).toBe(100);
  });
  it('requires both category and genre when both are restricted', () => {
    const rule = { categoryIds: ['cd'], genreIds: ['rock'], productIds: [] };
    expect(
      matchesDiscount(
        { id: 'a', categories: [{ id: 'cd' }], genres: [{ id: 'rock' }] },
        rule,
      ),
    ).toBe(true);
    expect(
      matchesDiscount(
        { id: 'a', categories: [{ id: 'cd' }], genres: [{ id: 'jazz' }] },
        rule,
      ),
    ).toBe(false);
    expect(matchesDiscount({ id: 'a' }, rule)).toBe(false);
  });
  it('supports unrestricted campaigns and explicit product restrictions', () => {
    expect(
      matchesDiscount(
        { id: 'a' },
        { categoryIds: [], genreIds: [], productIds: [] },
      ),
    ).toBe(true);
    expect(
      matchesDiscount(
        { id: 'b' },
        { categoryIds: [], genreIds: [], productIds: ['a'] },
      ),
    ).toBe(false);
  });
});
