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
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import {
  imageSpacesConfig,
  imageSpacesKeys,
  ImageSpacesConfig,
  assertImageObjectKey,
} from '../config/image-spaces';

@Injectable()
export class ImageStorageService implements OnModuleDestroy {
  readonly config: ImageSpacesConfig | null;
  private client: S3Client | null;
  constructor(configService: ConfigService) {
    this.config = imageSpacesConfig(
      Object.fromEntries(imageSpacesKeys.map((k) => [k, configService.get(k)])),
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
            socketTimeout: 15000,
          }),
        })
      : null;
  }
  get enabled() {
    return !!this.client;
  }
  objectKey(id: string) {
    const key = `${this.config?.prefix}/${id}.webp`;
    assertImageObjectKey(key);
    return key;
  }
  private ready(key: string) {
    assertImageObjectKey(key);
    if (!this.client || !this.config)
      throw new ServiceUnavailableException(
        'Almacenamiento privado de imágenes no configurado.',
      );
    if (!key.startsWith(this.config.prefix + '/'))
      throw new ServiceUnavailableException(
        'La imagen pertenece a otro entorno de almacenamiento.',
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
          ContentType: 'image/webp',
          ContentLength: bytes.length,
          ACL: 'private',
          CacheControl: 'private,no-store',
        }),
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo guardar la imagen en Spaces. Intenta nuevamente.',
      );
    }
  }
  async signedRead(key: string) {
    const { client, config } = this.ready(key);
    try {
      return await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ResponseContentType: 'image/webp',
          ResponseCacheControl: 'private,no-store',
        }),
        { expiresIn: 60 },
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo abrir la imagen privada.',
      );
    }
  }
  async remove(key: string) {
    const { client, config } = this.ready(key);
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo retirar el archivo de Spaces.',
      );
    }
  }
  onModuleDestroy() {
    this.client?.destroy();
  }
}
