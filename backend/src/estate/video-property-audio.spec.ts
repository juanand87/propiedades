import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extractPropertyAudio } from './video-property-audio';
import { PropertyVideosService } from './property-videos.service';
import { ConfigService } from '@nestjs/config';
describe('Property video audio', () => {
  it('extracts actual audio without video, rejects silent/corrupt/long media and cleans temporary files', async () => {
    const before = (await readdir(tmpdir())).filter((x) =>
      x.startsWith('proppix-video-audio-'),
    );
    const folder = await mkdtemp(join(tmpdir(), 'proppix-audio-test-'));
    try {
      const ff = require('ffmpeg-static') as string;
      const run = (args: string[]) =>
        promisify(execFile)(ff, ['-nostdin', '-v', 'error', ...args], {
          timeout: 15000,
          windowsHide: true,
        });
      const video = join(folder, 'video.mp4');
      await run([
        '-f',
        'lavfi',
        '-i',
        'color=c=blue:s=32x32:r=1',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=16000',
        '-t',
        '1',
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        video,
      ]);
      const result = await extractPropertyAudio(await readFile(video));
      expect(result.buffer.length).toBeGreaterThan(64);
      expect(result.originalname).toBe('video.m4a');
      const silent = join(folder, 'silent.mp4');
      await run([
        '-f',
        'lavfi',
        '-i',
        'color=c=blue:s=32x32:r=1',
        '-t',
        '1',
        '-c:v',
        'libx264',
        silent,
      ]);
      await expect(
        extractPropertyAudio(await readFile(silent)),
      ).rejects.toThrow('no tiene audio');
      const long = join(folder, 'long.mp4');
      await run([
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=8000',
        '-t',
        '182',
        '-c:a',
        'aac',
        long,
      ]);
      await expect(extractPropertyAudio(await readFile(long))).rejects.toThrow(
        '3 minutos',
      );
      await expect(extractPropertyAudio(Buffer.alloc(100))).rejects.toThrow(
        'No se pudo extraer',
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
    expect(
      (await readdir(tmpdir())).filter((x) =>
        x.startsWith('proppix-video-audio-'),
      ),
    ).toEqual(before);
  }, 30000);
  it('denies another users video before reading any object', async () => {
    const db: any = {
      query: jest
        .fn()
        .mockResolvedValue([
          {
            id: '11111111-1111-4111-8111-111111111111',
            created_by: 'other',
            advertiser_id: 'other',
          },
        ]),
    };
    const storage: any = { enabled: true, readOriginal: jest.fn() };
    const svc = new PropertyVideosService(
      db,
      new ConfigService(),
      {} as any,
      storage,
      {} as any,
      {} as any,
    );
    jest.spyOn(svc as any, 'guard').mockImplementation(() => {});
    await expect(
      svc.dictationAudio(
        { id: 'owner', role: 'vendor', advertiser_id: 'mine' } as any,
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toThrow();
    expect(storage.readOriginal).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
