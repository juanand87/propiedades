import { BadRequestException } from '@nestjs/common';
import { text, decimal } from './rules';
export const publicPropertyJoins = `FROM properties p JOIN advertisers a ON a.id=p.advertiser_id JOIN users owner ON CONVERT(owner.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id AND owner.isActive=1 LEFT JOIN estate_regions r ON r.id=p.region_id LEFT JOIN estate_communes c ON c.id=p.commune_id`;
export const publicPropertyConditions =
  "p.publication_status='published' AND a.status='approved'";
export function propertyFilters(q: Record<string, string | undefined>) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.search) {
    where.push(
      '(p.title LIKE ? OR p.description LIKE ? OR c.name LIKE ? OR r.name LIKE ? OR p.code=?)',
    );
    const term = `%${text(q.search, 100)}%`;
    params.push(term, term, term, term, text(q.search, 100));
  }
  for (const key of [
    'type_id',
    'region_id',
    'commune_id',
    'advertiser_id',
    'price_unit',
    'availability',
    'operation_type',
  ])
    if (q[key]) {
      where.push(`p.${key}=?`);
      params.push(text(q[key], 100));
    }
  for (const [key, operator, col] of [
    ['min_price', '>=', 'price_amount'],
    ['max_price', '<=', 'price_amount'],
    ['min_area', '>=', 'built_area'],
    ['max_area', '<=', 'built_area'],
    ['bedrooms', '>=', 'bedrooms'],
    ['bathrooms', '>=', 'bathrooms'],
  ] as const)
    if (q[key] !== undefined && q[key] !== '') {
      if (col === 'price_amount' && !['CLP', 'UF'].includes(q.price_unit || ''))
        throw new BadRequestException(
          'Selecciona CLP o UF para comparar precios.',
        );
      where.push(`p.${col}${operator}?`);
      params.push(decimal(q[key], key));
    }
  if (q.featured === 'true') where.push('p.featured=1');
  for (const a of text(q.amenities, 500)
    .split(',')
    .filter(Boolean)
    .slice(0, 20)) {
    where.push(
      'EXISTS(SELECT 1 FROM property_amenities pa WHERE pa.property_id=p.id AND pa.amenity_id=?)',
    );
    params.push(a);
  }
  return { where, params };
}
