import ffmpeg from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export type HlsQuality = 'q360' | 'q540' | 'q720';
export type HlsRendition = {
  quality: HlsQuality;
  width: number;
  height: number;
  bandwidth: number;
  segments: { name: string; duration: number; bytes: number }[];
};
export type HlsMetadata = { audio: boolean; renditions: HlsRendition[] };
type Probe = {
  streams?: {
    codec_type?: string;
    width?: number;
    height?: number;
    sample_aspect_ratio?: string;
    avg_frame_rate?: string;
    side_data_list?: { rotation?: number }[];
    tags?: { rotate?: string };
  }[];
  format?: { duration?: string };
};
export function hlsPlan(probe: Probe) {
  const stream = probe.streams?.find((s) => s.codec_type === 'video');
  if (
    !stream?.width ||
    !stream.height ||
    stream.width * stream.height > 3840 * 2160
  )
    throw Error('Unsupported video dimensions');
  const [sn, sd] = (stream.sample_aspect_ratio || '1:1').split(':').map(Number);
  const sar = sn > 0 && sd > 0 ? sn / sd : 1;
  let width = stream.width * sar,
    height = stream.height;
  const rotation = Number(
    stream.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ??
      stream.tags?.rotate ??
      0,
  );
  if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];
  if (
    !Number.isFinite(width) ||
    width < 2 ||
    height < 2 ||
    width / height > 10 ||
    height / width > 10
  )
    throw Error('Unsupported aspect ratio');
  const sizes = new Set<string>();
  return ([360, 540, 720] as const).flatMap((edge) => {
    const factor = Math.min(
      1,
      edge / Math.min(width, height),
      1280 / Math.max(width, height),
    );
    const w = Math.max(2, Math.floor((width * factor) / 2) * 2),
      h = Math.max(2, Math.floor((height * factor) / 2) * 2);
    const size = `${w}x${h}`;
    if (sizes.has(size)) return [];
    sizes.add(size);
    return [
      {
        quality: `q${edge}` as HlsQuality,
        width: w,
        height: h,
        bandwidth: edge === 360 ? 900000 : edge === 540 ? 1550000 : 2750000,
        rate: edge === 360 ? 650 : edge === 540 ? 1150 : 2100,
      },
    ];
  });
}
export function validHlsSegment(name: string) {
  return /^seg[0-9]{5}\.ts$/.test(name);
}
export function parseHlsPlaylist(text: string) {
  if (!text.startsWith('#EXTM3U') || !text.includes('#EXT-X-ENDLIST'))
    throw Error('Incomplete HLS playlist');
  const segments: { name: string; duration: number; bytes: number }[] = [];
  let duration = 0;
  for (const line of text.trim().split(/\r?\n/)) {
    if (line.startsWith('#EXTINF:')) {
      duration = Number(line.slice(8).split(',')[0]);
      if (!(duration > 0 && duration <= 5)) throw Error('Invalid HLS duration');
    } else if (line && !line.startsWith('#')) {
      if (!validHlsSegment(line) || !duration || segments.length >= 30)
        throw Error('Invalid HLS segment');
      segments.push({ name: line, duration, bytes: 0 });
      duration = 0;
    }
  }
  if (!segments.length) throw Error('Empty HLS playlist');
  return segments;
}
export function validateHlsMetadata(input: unknown): HlsMetadata {
  const m = input as HlsMetadata;
  if (
    !m ||
    typeof m.audio !== 'boolean' ||
    !Array.isArray(m.renditions) ||
    !m.renditions.length ||
    m.renditions.length > 3
  )
    throw Error('Invalid HLS metadata');
  const qualities = new Set<string>();
  for (const r of m.renditions) {
    if (
      !['q360', 'q540', 'q720'].includes(r.quality) ||
      qualities.has(r.quality) ||
      !Number.isInteger(r.width) ||
      !Number.isInteger(r.height) ||
      r.width < 2 ||
      r.height < 2 ||
      r.width > 1280 ||
      r.height > 1280 ||
      !Number.isFinite(r.bandwidth) ||
      r.bandwidth < 1 ||
      !Array.isArray(r.segments) ||
      !r.segments.length ||
      r.segments.length > 30
    )
      throw Error('Invalid HLS rendition');
    qualities.add(r.quality);
    const names = new Set<string>();
    for (const s of r.segments) {
      if (
        !validHlsSegment(s.name) ||
        names.has(s.name) ||
        !(s.duration > 0 && s.duration <= 5) ||
        !Number.isInteger(s.bytes) ||
        s.bytes < 1 ||
        s.bytes > 4 * 1024 * 1024
      )
        throw Error('Invalid HLS segment metadata');
      names.add(s.name);
    }
  }
  return m;
}
export async function encodeHls(
  input: string,
  output: string,
): Promise<HlsMetadata> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- This package exposes a platform-specific executable path.
  const probePath = (require('ffprobe-static') as { path: string }).path;
  const { stdout } = await exec(
    probePath,
    [
      '-v',
      'error',
      '-protocol_whitelist',
      'file',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      input,
    ],
    { timeout: 15000, maxBuffer: 512 * 1024, windowsHide: true },
  );
  const probe = JSON.parse(stdout) as Probe;
  const duration = Number(probe.format?.duration);
  if (!(duration >= 1 && duration <= 45.75))
    throw Error('Unsupported HLS duration');
  if (!ffmpeg) throw Error('FFmpeg unavailable');
  const video = probe.streams?.find((s) => s.codec_type === 'video');
  const [fn, fd] = (video?.avg_frame_rate || '30/1').split('/').map(Number);
  const fps = Math.max(1, Math.min(30, Math.round(fn / fd) || 30));
  const result: HlsMetadata = {
    audio: !!probe.streams?.some((s) => s.codec_type === 'audio'),
    renditions: [],
  };
  for (const plan of hlsPlan(probe)) {
    const folder = join(output, plan.quality);
    await mkdir(folder, { recursive: true });
    await exec(
      ffmpeg,
      [
        '-nostdin',
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-threads',
        '2',
        '-i',
        input,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-map_metadata',
        '-1',
        '-filter_threads',
        '1',
        '-vf',
        `scale=trunc(iw*sar/2)*2:ih,setsar=1,scale=${plan.width}:${plan.height}:flags=lanczos,setsar=1`,
        '-r',
        String(fps),
        '-c:v',
        'libx264',
        '-profile:v',
        'main',
        '-level:v',
        '3.1',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'veryfast',
        '-threads',
        '2',
        '-crf',
        '23',
        '-b:v',
        `${plan.rate}k`,
        '-maxrate',
        `${Math.round(plan.rate * 1.2)}k`,
        '-bufsize',
        `${plan.rate * 2}k`,
        '-g',
        String(fps * 2),
        '-keyint_min',
        String(fps * 2),
        '-sc_threshold',
        '0',
        '-force_key_frames',
        'expr:gte(t,n_forced*2)',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-ac',
        '2',
        '-f',
        'hls',
        '-hls_time',
        '2',
        '-hls_playlist_type',
        'vod',
        '-hls_flags',
        'independent_segments',
        '-hls_segment_filename',
        join(folder, 'seg%05d.ts'),
        '-n',
        join(folder, 'index.m3u8'),
      ],
      { timeout: 120000, maxBuffer: 128 * 1024, windowsHide: true },
    );
    const segments = parseHlsPlaylist(
      await readFile(join(folder, 'index.m3u8'), 'utf8'),
    );
    for (const segment of segments)
      segment.bytes = (await stat(join(folder, segment.name))).size;
    result.renditions.push({
      quality: plan.quality,
      width: plan.width,
      height: plan.height,
      bandwidth: plan.bandwidth,
      segments,
    });
  }
  return validateHlsMetadata(result);
}
export function hlsMaster(metadata: HlsMetadata, query: string) {
  return (
    '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-INDEPENDENT-SEGMENTS\n' +
    metadata.renditions
      .map(
        (r) =>
          `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height},CODECS="avc1.4d401f${metadata.audio ? ',mp4a.40.2' : ''}"\n${r.quality}/index.m3u8${query}\n`,
      )
      .join('')
  );
}
export function hlsVariant(r: HlsRendition, query: string) {
  return (
    `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...r.segments.map((s) => s.duration)))}\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-INDEPENDENT-SEGMENTS\n` +
    r.segments
      .map((s) => `#EXTINF:${s.duration.toFixed(6)},\n${s.name}${query}\n`)
      .join('') +
    '#EXT-X-ENDLIST\n'
  );
}
