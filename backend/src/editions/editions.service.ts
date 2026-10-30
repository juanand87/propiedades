import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Edition } from './edition.entity';

@Injectable()
export class EditionsService {
  constructor(
    @InjectRepository(Edition)
    private editionsRepository: Repository<Edition>,
  ) {}

  async findAll(): Promise<Edition[]> {
    return this.editionsRepository.find({
      order: {
        name: 'ASC',
      },
    });
  }

  async findByNames(names: string[]): Promise<Edition[]> {
    if (!names || names.length === 0) {
      return [];
    }

    // Buscar ediciones que coincidan con los nombres normalizados
    const editions = await this.editionsRepository.find({
      where: {
        name: In(names),
      },
    });

    // Filtrar solo las que existen en BD (no crear nuevas)
    const foundNames = editions.map(e => e.name);
    const notFound = names.filter(name => !foundNames.includes(name));
    
    if (notFound.length > 0) {
      console.log(`⚠️ [EditionsService] Ediciones no encontradas (se omiten): ${notFound.join(', ')}`);
    }

    return editions;
  }

  async findById(id: number): Promise<Edition | null> {
    return this.editionsRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Edition | null> {
    return this.editionsRepository.findOne({ where: { slug } });
  }
}
