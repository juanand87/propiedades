import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaFile } from './media-file.entity';
import { MediaFolder } from './media-folder.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(MediaFile)
    private mediaFileRepository: Repository<MediaFile>,
    @InjectRepository(MediaFolder)
    private mediaFolderRepository: Repository<MediaFolder>,
  ) {}

  async getFiles(vendorId: string, folderId?: string) {
    const where: any = { vendorId };
    
    if (folderId) {
      where.folderId = folderId;
    } else {
      where.folderId = null; // Solo archivos en la raíz
    }

    return this.mediaFileRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getFolders(vendorId: string, parentId?: string) {
    const where: any = { vendorId };
    
    if (parentId) {
      where.parentId = parentId;
    } else {
      where.parentId = null; // Solo carpetas en la raíz
    }

    return this.mediaFolderRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async createFile(data: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    vendorId: string;
    folderId?: string;
  }) {
    const file = this.mediaFileRepository.create(data);
    return this.mediaFileRepository.save(file);
  }

  async createFolder(data: {
    name: string;
    vendorId: string;
    parentId?: string;
  }) {
    const folder = this.mediaFolderRepository.create(data);
    return this.mediaFolderRepository.save(folder);
  }

  async deleteFile(vendorId: string, fileId: string) {
    const file = await this.mediaFileRepository.findOne({
      where: { id: fileId, vendorId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Eliminar archivo físico
    try {
      const filePath = path.join(process.cwd(), 'uploads', 'media', file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error deleting physical file:', error);
    }

    await this.mediaFileRepository.remove(file);
    return { success: true };
  }

  async deleteFolder(vendorId: string, folderId: string) {
    const folder = await this.mediaFolderRepository.findOne({
      where: { id: folderId, vendorId },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Eliminar todos los archivos de la carpeta
    const files = await this.mediaFileRepository.find({
      where: { folderId, vendorId },
    });

    for (const file of files) {
      await this.deleteFile(vendorId, file.id);
    }

    // Eliminar subcarpetas recursivamente
    const subFolders = await this.mediaFolderRepository.find({
      where: { parentId: folderId, vendorId },
    });

    for (const subFolder of subFolders) {
      await this.deleteFolder(vendorId, subFolder.id);
    }

    await this.mediaFolderRepository.remove(folder);
    return { success: true };
  }
}
