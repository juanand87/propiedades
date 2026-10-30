import { getRegionCode } from './envia.interface';

describe('getRegionCode', () => {
  it.each([
    ['Valparaíso', 'VS'],
    ['Region de Valparaiso', 'VS'],
    ['Región de Valparaíso', 'VS'],
  ])('maps %s to the Envia state code %s', (regionName, expected) => {
    expect(getRegionCode(regionName)).toBe(expected);
  });
});
