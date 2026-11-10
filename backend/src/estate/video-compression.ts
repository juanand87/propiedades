import { execFile } from 'node:child_process';
import { readFile, rename, stat, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import { ServiceUnavailableException } from '@nestjs/common';

const exec = promisify(execFile);
let encoding = false;

export async function compressVideo(
  filename: string,
  original: Buffer,
  durationMs: number,
) {
  // Small uploads already fit the feed budget. Keep the original when encoding would not save space.
  if ((original.length * 8) / (durationMs / 1000) <= 2_500_000) return original;
  if (encoding)
    throw new ServiceUnavailableException(
      'Se está procesando otro video. Reintenta en unos segundos.',
    );
  const output = filename + '.optimized.mp4';
  encoding = true;
  try {
    const ffmpeg = require('ffmpeg-static') as string | null;
    if (!ffmpeg) throw new Error('FFmpeg unavailable');
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
        filename,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-map_metadata',
        '-1',
        '-filter_threads',
        '1',
        '-vf',
        "scale=trunc(iw*sar/2)*2:ih,setsar=1,scale=w='if(gte(iw,ih),min(1280,iw),min(720,iw))':h='if(gte(iw,ih),min(720,ih),min(1280,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2",
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'veryfast',
        '-threads',
        '2',
        '-crf',
        '22',
        '-maxrate',
        '3M',
        '-bufsize',
        '6M',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-movflags',
        '+faststart',
        '-n',
        output,
      ],
      { timeout: 50000, maxBuffer: 64 * 1024, windowsHide: true },
    );
    const info = await stat(output);
    if (!info.size || info.size >= original.length) return original;
    const optimized = await readFile(output);
    await rename(output, filename);
    return optimized;
  } catch {
    throw new ServiceUnavailableException(
      'No pudimos optimizar el video. Intenta subirlo nuevamente.',
    );
  } finally {
    await unlink(output).catch(() => {});
    encoding = false;
  }
}
