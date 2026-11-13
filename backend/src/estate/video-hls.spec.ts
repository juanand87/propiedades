import {
  hlsPlan,
  hlsMaster,
  hlsVariant,
  parseHlsPlaylist,
  validateHlsMetadata,
} from './video-hls';
import { assertVideoObjectKey } from '../config/video-spaces';
describe('adaptive private video renditions', () => {
  it('preserves portrait aspect and supplies three distinct sizes', () => {
    const plans = hlsPlan({
      streams: [{ codec_type: 'video', width: 1080, height: 1920 }],
    });
    expect(plans.map((p) => [p.width, p.height])).toEqual([
      [360, 640],
      [540, 960],
      [720, 1280],
    ]);
  });
  it('preserves landscape, square and rotated dimensions without upscaling', () => {
    expect(
      hlsPlan({
        streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
      }).map((p) => [p.width, p.height]),
    ).toEqual([
      [640, 360],
      [960, 540],
      [1280, 720],
    ]);
    expect(
      hlsPlan({ streams: [{ codec_type: 'video', width: 320, height: 240 }] }),
    ).toHaveLength(1);
    expect(
      hlsPlan({
        streams: [
          {
            codec_type: 'video',
            width: 1920,
            height: 1080,
            side_data_list: [{ rotation: 90 }],
          },
        ],
      })[0],
    ).toMatchObject({ width: 360, height: 640 });
    expect(
      hlsPlan({
        streams: [
          {
            codec_type: 'video',
            width: 720,
            height: 576,
            sample_aspect_ratio: '16:15',
          },
        ],
      })[0],
    ).toMatchObject({ width: 480, height: 360 });
  });
  it.each([
    '../seg00001.ts',
    'https://other.invalid/video.ts',
    '/etc/passwd',
    'seg00000.ts?url=private',
  ])('rejects unsafe segment names %s', (name) => {
    expect(() =>
      parseHlsPlaylist('#EXTM3U\n#EXTINF:2,\n' + name + '\n#EXT-X-ENDLIST'),
    ).toThrow();
  });
  it('generates bounded VOD playlists with signed relative URLs', () => {
    const metadata = validateHlsMetadata({
      audio: true,
      renditions: [
        {
          quality: 'q360',
          width: 360,
          height: 640,
          bandwidth: 900000,
          segments: [{ name: 'seg00000.ts', duration: 2, bytes: 100 }],
        },
      ],
    });
    expect(hlsMaster(metadata, '?v=g&signature=s')).toContain(
      'q360/index.m3u8?v=g&signature=s',
    );
    expect(hlsVariant(metadata.renditions[0], '?v=g&signature=s')).toContain(
      'seg00000.ts?v=g&signature=s',
    );
    expect(hlsVariant(metadata.renditions[0], '')).toContain('#EXT-X-ENDLIST');
  });
  it('accepts only canonical private HLS segment keys', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(() =>
      assertVideoObjectKey(
        `propiedades/videos/hls/${id}/${id}/q360/seg00000.ts`,
      ),
    ).not.toThrow();
    for (const part of [
      '../q360/seg00000.ts',
      'q1080/seg00000.ts',
      'q360/master.m3u8',
      'q360/seg00000.ts/other',
    ])
      expect(() =>
        assertVideoObjectKey(`propiedades/videos/hls/${id}/${id}/${part}`),
      ).toThrow();
  });
});
