import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';

export async function videoPoster(filename: string): Promise<Buffer> {
  if (!ffmpeg) throw new Error('FFmpeg no disponible.');
  const { stdout } = await promisify(execFile)(
    ffmpeg,
    [
      '-nostdin',
      '-v',
      'error',
      '-protocol_whitelist',
      'file',
      '-threads',
      '1',
      '-i',
      filename,
      '-map',
      '0:v:0',
      '-frames:v',
      '1',
      '-filter_threads',
      '1',
      '-vf',
      'scale=trunc(iw*sar/2)*2:ih,setsar=1,scale=480:640:force_original_aspect_ratio=decrease',
      '-q:v',
      '4',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      'pipe:1',
    ],
    {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      encoding: 'buffer',
      windowsHide: true,
    },
  );
  if (!stdout.length) throw new Error('No se pudo crear la portada.');
  return stdout;
}
