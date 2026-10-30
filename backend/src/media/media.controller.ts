import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly storageService: StorageService,
  ) {}

  @Get(':vendorId/files')
  async getFiles(
    @Param('vendorId') vendorId: string,
    @Query('folderId') folderId?: string,
  ) {
    return this.mediaService.getFiles(vendorId, folderId);
  }

  @Get(':vendorId/folders')
  async getFolders(
    @Param('vendorId') vendorId: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.mediaService.getFolders(vendorId, parentId);
  }

  @Post(':vendorId/upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async uploadFiles(
    @Param('vendorId') vendorId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folderId') folderId?: string,
  ) {
    const uploadedFiles: any[] = [];

    for (const file of files) {
      const { url, key } = await this.storageService.uploadFile(file, 'media');
      
      const mediaFile = await this.mediaService.createFile({
        filename: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: url,
        vendorId,
        folderId: folderId || undefined,
      });
      uploadedFiles.push(mediaFile);
    }

    return uploadedFiles;
  }

  @Post(':vendorId/folders')
  async createFolder(
    @Param('vendorId') vendorId: string,
    @Body() body: { name: string; parentId?: string },
  ) {
    return this.mediaService.createFolder({
      name: body.name,
      vendorId,
      parentId: body.parentId || undefined,
    });
  }

  @Delete(':vendorId/files/:fileId')
  async deleteFile(
    @Param('vendorId') vendorId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.mediaService.deleteFile(vendorId, fileId);
  }

  @Delete(':vendorId/folders/:folderId')
  async deleteFolder(
    @Param('vendorId') vendorId: string,
    @Param('folderId') folderId: string,
  ) {
    return this.mediaService.deleteFolder(vendorId, folderId);
  }

  @Post('upload-icon')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        // Solo permitir imágenes
        if (!file.mimetype.match(/^image\/(svg\+xml|png|jpeg|jpg)$/)) {
          return cb(new Error('Solo se permiten archivos SVG, PNG y JPG'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
      },
    }),
  )
  async uploadIcon(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No se recibió ningún archivo');
    }

    const { url, key } = await this.storageService.uploadFile(file, 'icons');

    return {
      url: url,
      path: url,
      filename: key,
      originalName: file.originalname,
      size: file.size,
    };
  }
}
