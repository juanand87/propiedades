export function calculateDiscount(
  base: number,
  percentage: number,
  maximum?: number | null,
): number {
  return Math.max(
    0,
    Math.min(Math.round((base * percentage) / 100), maximum ?? Infinity, base),
  );
}

export function matchesDiscount(
  product: {
    id: string;
    categories?: { id: string }[];
    genres?: { id: string | number }[];
  },
  rule: { categoryIds: string[]; genreIds: string[]; productIds: string[] },
): boolean {
  return (
    (!rule.categoryIds.length ||
      product.categories?.some((item) => rule.categoryIds.includes(item.id)) ===
        true) &&
    (!rule.genreIds.length ||
      product.genres?.some((item) =>
        rule.genreIds.includes(String(item.id)),
      ) === true) &&
    (!rule.productIds.length || rule.productIds.includes(product.id))
  );
}
