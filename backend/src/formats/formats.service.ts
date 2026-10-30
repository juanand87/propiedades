import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Format } from './format.entity';

@Injectable()
export class FormatsService {
  constructor(
    @InjectRepository(Format)
    public readonly formatRepository: Repository<Format>,
  ) {}

  async findAll(): Promise<Format[]> {
    return await this.formatRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findByIds(ids: number[]): Promise<Format[]> {
    if (!ids || ids.length === 0) return [];
    return await this.formatRepository.findByIds(ids);
  }

  async findOrCreateByNames(names: string[]): Promise<Format[]> {
    if (!names || names.length === 0) return [];

    const formats: Format[] = [];

    for (const name of names) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;

      const slug = this.generateSlug(trimmedName);

      let format = await this.formatRepository.findOne({ where: { slug } });

      // NO CREAR FORMATOS NUEVOS - Solo usar los 13 formatos normalizados existentes
      // Los formatos basura de Discogs NO deben guardarse
      if (!format) {
        // Intentar buscar por nombre exacto
        format = await this.formatRepository.findOne({ where: { name: trimmedName } });
        
        if (!format) {
          console.warn(`⚠️ Formato ignorado (no normalizado): ${trimmedName}`);
          continue; // Saltar este formato, no agregarlo a la lista
        }
      }

      formats.push(format);
    }

    return formats;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
