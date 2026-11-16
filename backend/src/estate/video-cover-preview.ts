import sharp from 'sharp';
import { createHash } from 'node:crypto';
const cache = new Map<string, string>();
// Small embedded cover: avoids an extra network round trip before the first image.
export async function videoCoverPreview(jpeg: Buffer) {
  if (!Buffer.isBuffer(jpeg) || jpeg.length > 1024 * 1024) return undefined;
  const key = createHash('sha256').update(jpeg).digest('hex');
  const saved = cache.get(key);
  if (saved) return saved;
  try {
    const tiny = await sharp(jpeg, { limitInputPixels: 4_000_000 })
      .resize({
        width: 32,
        height: 64,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 30 })
      .toBuffer();
    if (tiny.length > 4096) return undefined;
    const result = 'data:image/jpeg;base64,' + tiny.toString('base64');
    cache.set(key, result);
    if (cache.size > 256) cache.delete(cache.keys().next().value!);
    return result;
  } catch {
    return undefined;
  }
}
