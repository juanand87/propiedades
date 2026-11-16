import sharp from 'sharp';
import { videoCoverPreview } from './video-cover-preview';
describe('embedded video covers', () => {
  it('returns a small JPEG with preserved portrait proportions', async () => {
    const input = await sharp({
      create: { width: 360, height: 640, channels: 3, background: '#1680c0' },
    })
      .jpeg()
      .toBuffer();
    const preview = await videoCoverPreview(input);
    expect(preview).toMatch(/^data:image\/jpeg;base64,/);
    const bytes = Buffer.from(preview!.split(',')[1], 'base64'),
      meta = await sharp(bytes).metadata();
    expect(bytes.length).toBeLessThan(4096);
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(57);
    expect(meta.exif).toBeUndefined();
  });
  it('does not fail a feed when a stored cover is invalid', async () => {
    expect(await videoCoverPreview(Buffer.from('invalid'))).toBeUndefined();
    expect(
      await videoCoverPreview(Buffer.alloc(1024 * 1024 + 1)),
    ).toBeUndefined();
  });
});
