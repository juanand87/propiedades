import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { VideoHlsService } from './video-hls.service';
import { VideoStorageService } from './video-storage.service';
import { EstateService } from './estate.service';
import { JwtService } from '@nestjs/jwt';
describe('durable HLS worker recovery', () => {
  it.each([true, false])(
    'only signs direct segment URLs after authorizing the video: visible=%s',
    async (visible) => {
      const id = randomUUID(),
        generation = randomUUID();
      const query = jest.fn(async (sql: string) =>
        sql.includes('information_schema')
          ? [{ n: 1 }]
          : sql.startsWith('SELECT * FROM property_video_hls')
            ? [
                {
                  generation_id: generation,
                  metadata_json: JSON.stringify({
                    audio: true,
                    renditions: [
                      {
                        quality: 'q720',
                        width: 720,
                        height: 1280,
                        bandwidth: 2750000,
                        segments: [
                          { name: 'seg00000.ts', duration: 2, bytes: 100 },
                        ],
                      },
                    ],
                  }),
                },
              ]
            : visible
              ? [{ id }]
              : [],
      );
      const signedHlsSegment = jest.fn(
        async () =>
          'https://private-space.sfo3.digitaloceanspaces.com/seg00000.ts?X-Amz-Signature=test',
      );
      const storage = {
        enabled: true,
        config: { prefix: 'propiedades/pruebas/videos' },
        signedHlsSegment,
      } as unknown as VideoStorageService;
      const service = new VideoHlsService(
        { query } as unknown as DataSource,
        new ConfigService({
          NODE_ENV: 'test',
          PROJECT_ID: 'propiedades',
          DB_DATABASE: 'propiedades',
          DB_HOST: '127.0.0.1',
          DB_PORT: '3327',
          PROPERTY_VIDEOS_ENABLED: 'true',
        }),
        storage,
        {} as EstateService,
        {} as JwtService,
      );
      const res: any = {
        set: jest.fn(),
        type: jest.fn(),
        send: jest.fn(),
        req: { method: 'GET' },
      };
      res.type.mockReturnValue(res);
      const action = service.serve(
        id,
        'q720',
        'index.m3u8',
        generation,
        undefined,
        res,
      );
      if (!visible) {
        await expect(action).rejects.toThrow('Video no disponible');
        expect(signedHlsSegment).not.toHaveBeenCalled();
      } else {
        await action;
        expect(signedHlsSegment).toHaveBeenCalledWith(
          `propiedades/pruebas/videos/hls/${id}/${generation}/q720/seg00000.ts`,
        );
        expect(res.send).toHaveBeenCalledWith(
          expect.stringContaining(
            'https://private-space.sfo3.digitaloceanspaces.com/seg00000.ts?X-Amz-Signature=test',
          ),
        );
        expect(res.send.mock.calls[0][0]).toContain('#EXTINF:2.000000');
      }
    },
  );
  it.each([0, 3])(
    'persists a bounded retry after missing source, attempt %s',
    async (attempts) => {
      const id = randomUUID();
      const query = jest.fn((sql: string) =>
        Promise.resolve(
          sql.includes('information_schema')
            ? [{ n: 1 }]
            : sql.includes("v.status='archived'")
              ? []
              : sql.startsWith('SELECT h.*')
                ? [
                    {
                      video_id: id,
                      generation_id: null,
                      metadata_json: null,
                      attempts,
                      status: 'pending',
                    },
                  ]
                : { affectedRows: 1 },
        ),
      );
      const runner = {
        connect: jest.fn(),
        release: jest.fn(),
        query: jest.fn().mockResolvedValue([{ locked: 1 }]),
      };
      const service = new VideoHlsService(
        { query, createQueryRunner: () => runner } as unknown as DataSource,
        new ConfigService({
          NODE_ENV: 'test',
          PROJECT_ID: 'propiedades',
          DB_DATABASE: 'propiedades',
          DB_HOST: '127.0.0.1',
          DB_PORT: '3327',
          PROPERTY_VIDEOS_ENABLED: 'true',
        }),
        { enabled: false } as VideoStorageService,
        {} as EstateService,
        {} as JwtService,
      );
      await service.processNext(id);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SET status=?,due_at='),
        [attempts === 3 ? 'failed' : 'pending', 60 * 2 ** attempts, id],
      );
      expect(runner.query).toHaveBeenCalledWith(
        expect.stringContaining('RELEASE_LOCK'),
      );
      expect(runner.release).toHaveBeenCalled();
    },
  );
});
