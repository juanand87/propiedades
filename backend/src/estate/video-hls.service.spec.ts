import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { VideoHlsService } from './video-hls.service';
import { VideoStorageService } from './video-storage.service';
import { EstateService } from './estate.service';
import { JwtService } from '@nestjs/jwt';
describe('durable HLS worker recovery', () => {
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
