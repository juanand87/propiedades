import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import {
  videoSpacesConfig,
  videoSpacesKeys,
  assertVideoObjectKey,
} from '../config/video-spaces';
@Injectable()
export class VideoStorageService implements OnModuleDestroy {
  readonly config: ReturnType<typeof videoSpacesConfig>;
  private client: S3Client | null;
  constructor(config: ConfigService) {
    this.config = videoSpacesConfig(
      Object.fromEntries(videoSpacesKeys.map((k) => [k, config.get(k)])),
    );
    this.client = this.config
      ? new S3Client({
          endpoint: this.config.endpoint,
          region: 'us-east-1',
          forcePathStyle: false,
          credentials: {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
          },
          maxAttempts: 2,
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
          requestHandler: new NodeHttpHandler({
            connectionTimeout: 5000,
            socketTimeout: 60000,
          }),
        })
      : null;
  }
  get enabled() {
    return !!this.client;
  }
  objectKey(id: string) {
    const key = `${this.config?.prefix}/${id}.mp4`;
    assertVideoObjectKey(key);
    return key;
  }
  private ready(key: string) {
    assertVideoObjectKey(key);
    if (
      !this.client ||
      !this.config ||
      !key.startsWith(this.config.prefix + '/')
    )
      throw new ServiceUnavailableException(
        'Almacenamiento de videos no disponible para este entorno.',
      );
    return { client: this.client, config: this.config };
  }
  async put(key: string, bytes: Buffer) {
    const { client, config } = this.ready(key);
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: bytes,
          ContentLength: bytes.length,
          ContentType: 'video/mp4',
          ACL: 'private',
          CacheControl: 'private,no-store',
        }),
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo guardar el video en Spaces. Reintenta sin volver a grabarlo.',
      );
    }
  }
  async signedRead(key: string, head = false) {
    const { client, config } = this.ready(key);
    const input = { Bucket: config.bucket, Key: key };
    return getSignedUrl(
      client,
      head
        ? new HeadObjectCommand(input)
        : new GetObjectCommand({
            ...input,
            ResponseContentType: 'video/mp4',
            ResponseCacheControl: 'private,no-store',
          }),
      { expiresIn: 120 },
    );
  }
  async remove(key: string) {
    const { client, config } = this.ready(key);
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      );
    } catch {
      throw new ServiceUnavailableException(
        'La retirada del video de Spaces quedó pendiente.',
      );
    }
  }
  onModuleDestroy() {
    this.client?.destroy();
  }
}
