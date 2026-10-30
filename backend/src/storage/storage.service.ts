import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null;
  private bucket: string;
  private cdnUrl: string;
  private uploadDir: string;
  private useSpaces: boolean;

  constructor(private configService: ConfigService) {
    const spacesAccessKey = this.configService.get<string>('SPACES_ACCESS_KEY');
    const spacesSecretKey = this.configService.get<string>('SPACES_SECRET_KEY');
    const spacesEndpoint = this.configService.get<string>('SPACES_ENDPOINT');
    const spacesRegion = this.configService.get<string>('SPACES_REGION', 'nyc3');
    
    this.bucket = this.configService.get<string>('SPACES_BUCKET', '');
    this.cdnUrl = this.configService.get<string>('SPACES_CDN_URL', '');
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    
    this.useSpaces = this.configService.get('INTEGRATIONS_ENABLED') === 'true' && !!(spacesAccessKey && spacesSecretKey && spacesEndpoint && this.bucket);

    if (this.useSpaces) {
      this.s3Client = new S3Client({
        endpoint: spacesEndpoint!,
        region: spacesRegion,
        credentials: {
          accessKeyId: spacesAccessKey!,
          secretAccessKey: spacesSecretKey!,
        },
        forcePathStyle: false,
      });
      this.logger.log(`✅ DigitalOcean Spaces configured: ${this.cdnUrl}`);
    } else {
      this.s3Client = null;
      this.logger.warn('⚠️  Using local file storage (Spaces not configured)');
      // Crear directorio local si no existe
      if (!existsSync(this.uploadDir)) {
        mkdirSync(this.uploadDir, { recursive: true });
      }
    }
  }

  /**
   * Sube un archivo a Spaces o almacenamiento local
   */
  async uploadFile(
    file: any, // Compatible with Express.Multer.File
    folder: string = '',
  ): Promise<{ url: string; key: string }> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const key = folder ? `${folder}/${fileName}` : fileName;

    if (this.useSpaces && this.s3Client) {
      // Upload a Spaces
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ACL: 'public-read',
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);
      const url = `${this.cdnUrl}/${key}`;
      
      this.logger.log(`📤 Uploaded to Spaces: ${url}`);
      return { url, key };
    } else {
      // Guardar localmente
      const localFolder = join(this.uploadDir, folder);
      if (!existsSync(localFolder)) {
        mkdirSync(localFolder, { recursive: true });
      }
      
      const localPath = join(localFolder, fileName);
      writeFileSync(localPath, file.buffer);
      
      const url = `/uploads/${key}`;
      this.logger.log(`💾 Saved locally: ${url}`);
      return { url, key };
    }
  }

  /**
   * Elimina un archivo de Spaces o almacenamiento local
   */
  async deleteFile(key: string): Promise<void> {
    if (this.useSpaces && this.s3Client) {
      // Eliminar de Spaces
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`🗑️  Deleted from Spaces: ${key}`);
    } else {
      // Eliminar localmente
      const localPath = join(this.uploadDir, key);
      if (existsSync(localPath)) {
        unlinkSync(localPath);
        this.logger.log(`🗑️  Deleted locally: ${key}`);
      }
    }
  }

  /**
   * Obtiene la URL pública de un archivo
   */
  getFileUrl(key: string): string {
    if (this.useSpaces) {
      return `${this.cdnUrl}/${key}`;
    } else {
      return `/uploads/${key}`;
    }
  }

  /**
   * Verifica si está usando Spaces
   */
  isUsingSpaces(): boolean {
    return this.useSpaces;
  }
}
