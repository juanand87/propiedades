export interface PackageProductDimensions {
  weight?: number | string | null;
  height?: number | string | null;
  width?: number | string | null;
  depth?: number | string | null;
  categories?: PackageProductDimensions[] | null;
}

export interface PackageMetricItem {
  quantity?: number | null;
  product?: PackageProductDimensions | null;
}

export interface PackageSummary {
  weight: number;
  length: number;
  width: number;
  height: number;
  weightUnit: 'KG';
  lengthUnit: 'CM';
  itemCount: number;
  usesFallback: boolean;
}

const DEFAULTS = {
  weight: 0.5,
  length: 30,
  width: 20,
  height: 10,
};

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculatePackageSummary(items: PackageMetricItem[]): PackageSummary {
  let totalWeight = 0;
  let totalVolume = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let maxItemHeight = 0;
  let itemCount = 0;
  let usesFallback = false;

  for (const item of items || []) {
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1));
    const product = item.product || {};
    const category = product.categories?.[0] || {};
    const weight = positiveNumber(product.weight) ?? positiveNumber(category.weight) ?? DEFAULTS.weight;
    const length = positiveNumber(product.depth) ?? positiveNumber(category.depth) ?? DEFAULTS.length;
    const width = positiveNumber(product.width) ?? positiveNumber(category.width) ?? DEFAULTS.width;
    const height = positiveNumber(product.height) ?? positiveNumber(category.height) ?? DEFAULTS.height;

    usesFallback ||= (!positiveNumber(product.weight) && !positiveNumber(category.weight)
      || !positiveNumber(product.depth) && !positiveNumber(category.depth)
      || !positiveNumber(product.width) && !positiveNumber(category.width)
      || !positiveNumber(product.height) && !positiveNumber(category.height));
    itemCount += quantity;
    totalWeight += weight * quantity;
    totalVolume += length * width * height * quantity;
    maxLength = Math.max(maxLength, length);
    maxWidth = Math.max(maxWidth, width);
    maxItemHeight = Math.max(maxItemHeight, height);
  }

  if (itemCount === 0) usesFallback = true;
  const baseLength = Math.max(10, maxLength || DEFAULTS.length);
  const baseWidth = Math.max(10, maxWidth || DEFAULTS.width);
  const packedHeight = totalVolume > 0 ? Math.ceil(totalVolume / (baseLength * baseWidth)) : DEFAULTS.height;

  return {
    weight: round(Math.max(0.1, totalWeight || DEFAULTS.weight)),
    length: round(baseLength),
    width: round(baseWidth),
    height: round(Math.max(5, maxItemHeight, packedHeight)),
    weightUnit: 'KG',
    lengthUnit: 'CM',
    itemCount,
    usesFallback,
  };
}
