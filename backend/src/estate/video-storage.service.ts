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
          ContentType: key.endsWith('.ts') ? 'video/mp2t' : 'video/mp4',
          ACL: 'private',
          CacheControl: key.endsWith('.ts')
            ? 'private,max-age=120'
            : 'private,no-store',
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
            ResponseContentType: key.endsWith('.ts')
              ? 'video/mp2t'
              : 'video/mp4',
            ResponseCacheControl: key.endsWith('.ts')
              ? 'private,max-age=120'
              : 'private,no-store',
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
  async readOriginal(key: string) {
    const { client, config } = this.ready(key);
    const object = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    if (!object.Body)
      throw new ServiceUnavailableException('Video no disponible.');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const part of object.Body as AsyncIterable<Uint8Array>) {
      size += part.length;
      if (size > 50 * 1024 * 1024)
        throw new ServiceUnavailableException('Video demasiado grande.');
      chunks.push(Buffer.from(part));
    }
    return Buffer.concat(chunks);
  }
  onModuleDestroy() {
    this.client?.destroy();
  }
}
