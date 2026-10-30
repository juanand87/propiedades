export function inventoryConflict(
  line: { snapshotStock: number; snapshotUpdatedAt: Date | string },
  product: { stock: number; updatedAt: Date | string },
) {
  return (
    Number(line.snapshotStock) !== Number(product.stock) ||
    new Date(line.snapshotUpdatedAt).getTime() !==
      new Date(product.updatedAt).getTime()
  );
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return -1;
  let dot = 0,
    a = 0,
    b = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
    a += left[i] ** 2;
    b += right[i] ** 2;
  }
  return a && b && Number.isFinite(dot) && Number.isFinite(a * b)
    ? Math.max(-1, Math.min(1, dot / Math.sqrt(a * b)))
    : -1;
}

export const embeddingStorage = {
  to(vector: number[] | null): Buffer | null {
    if (!vector) return null;
    const buffer = Buffer.alloc(vector.length * 4);
    vector.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
    return buffer;
  },
  from(buffer: Buffer | null): number[] | null {
    if (!buffer) return null;
    if (buffer.length % 4) return [];
    return Array.from({ length: buffer.length / 4 }, (_, index) =>
      buffer.readFloatLE(index * 4),
    );
  },
};
