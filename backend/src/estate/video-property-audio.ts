import { BadRequestException } from '@nestjs/common';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
// Only accepts already-authorized, bounded bytes; never a client-provided URL/path.
export async function extractPropertyAudio(bytes: Buffer) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 64 ||
    bytes.length > 50 * 1024 * 1024
  )
    throw new BadRequestException(
      'El video no está disponible o supera 50 MB.',
    );
  const folder = await mkdtemp(join(tmpdir(), 'proppix-video-audio-'));
  try {
    const input = join(folder, 'video.mp4'),
      output = join(folder, 'voice.m4a');
    await writeFile(input, bytes, { flag: 'wx' });
    const probe = await promisify(execFile)(
      (require('ffprobe-static') as { path: string }).path,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration:stream=codec_type',
        '-of',
        'json',
        input,
      ],
      { timeout: 5000, maxBuffer: 65536, windowsHide: true },
    );
    const meta = JSON.parse(probe.stdout),
      duration = Number(meta.format?.duration);
    if (!meta.streams?.some((s: any) => s.codec_type === 'audio'))
      throw new BadRequestException(
        'Este video no tiene audio. Puedes dictar o escribir los datos.',
      );
    if (!Number.isFinite(duration) || duration < 0.5 || duration > 181)
      throw new BadRequestException(
        'Usa un video de hasta 3 minutos para completar la propiedad.',
      );
    await promisify(execFile)(
      require('ffmpeg-static') as string,
      [
        '-nostdin',
        '-v',
        'error',
        '-i',
        input,
        '-map',
        '0:a:0',
        '-vn',
        '-t',
        '181',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-c:a',
        'aac',
        '-b:a',
        '64000',
        '-movflags',
        '+faststart',
        output,
      ],
      { timeout: 20000, maxBuffer: 65536, windowsHide: true },
    );
    return { buffer: await readFile(output), originalname: 'video.m4a' };
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException(
      'No se pudo extraer el audio del video. Puedes dictar o escribir los datos.',
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
