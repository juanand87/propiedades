import {
  assertLocalVideos,
  validateMp4,
  videoRange,
  videoTitle,
  recordingLimit,
  validateVideoProbe,
} from './property-videos';
describe('local property videos', () => {
  const probe = (duration: number, codec = 'h264') => ({
    format: { duration: String(duration) },
    streams: [
      { codec_type: 'video', codec_name: codec, width: 720, height: 1280 },
    ],
  });
  it('accepts the three recording modes and checks actual video duration', () => {
    for (const duration of [15, 30, 45]) {
      expect(recordingLimit(String(duration))).toBe(duration);
      expect(validateVideoProbe(probe(duration), duration)).toBe(
        duration * 1000,
      );
      expect(() => validateVideoProbe(probe(duration + 1), duration)).toThrow();
    }
    expect(recordingLimit(undefined)).toBeNull();
    for (const bad of [0, 10, 60, '', 'abc'])
      expect(() => recordingLimit(bad)).toThrow();
    for (const invalid of [
      probe(0.2),
      probe(46),
      probe(15, 'hevc'),
      {},
      probe(Infinity),
    ])
      expect(() => validateVideoProbe(invalid, null)).toThrow();
    expect(validateVideoProbe(probe(15.1), 15)).toBe(15100);
  });
  const local = {
    NODE_ENV: 'test',
    PROJECT_ID: 'propiedades',
    DB_DATABASE: 'propiedades',
    DB_HOST: '127.0.0.1',
    DB_PORT: '3327',
    PROPERTY_VIDEOS_ENABLED: 'true',
  };
  it('refuses production, remote DBs and disabled feature', () => {
    expect(() => assertLocalVideos(local)).not.toThrow();
    for (const patch of [
      { NODE_ENV: 'production' },
      { DB_HOST: 'db.digitalocean.com' },
      { DB_PORT: '3306' },
      { PROPERTY_VIDEOS_ENABLED: 'false' },
      { DB_DATABASE: 'other' },
    ])
      expect(() => assertLocalVideos({ ...local, ...patch })).toThrow();
  });
  it('validates titles and MP4 signature', () => {
    expect(videoTitle(' Casa ')).toBe('Casa');
    expect(() => videoTitle('')).toThrow();
    expect(() => videoTitle('a'.repeat(161))).toThrow();
    expect(() =>
      validateMp4({
        mimetype: 'video/mp4',
        buffer: Buffer.from('not a video'),
      }),
    ).toThrow();
    const b = Buffer.alloc(32);
    b.write('ftyp', 4);
    b.write('isom', 8);
    expect(() =>
      validateMp4({ mimetype: 'video/mp4', buffer: b }),
    ).not.toThrow();
    expect(() => validateMp4({ mimetype: 'image/png', buffer: b })).toThrow();
  });
  it('serves bounded and suffix byte ranges and rejects invalid requests', () => {
    expect(videoRange(undefined, 100)).toBeNull();
    expect(videoRange('bytes=0-9', 100)).toEqual({ start: 0, end: 9 });
    expect(videoRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(videoRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(videoRange('bytes=0-1000', 100)).toEqual({ start: 0, end: 99 });
    for (const r of [
      'bytes=100-',
      'bytes=20-10',
      'bytes=-0',
      'bytes=-',
      'bytes=0-1,5-6',
      'garbage',
    ])
      expect(videoRange(r, 100)).toBe(false);
  });
});
