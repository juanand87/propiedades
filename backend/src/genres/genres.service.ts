import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Genre } from './genre.entity';

@Injectable()
export class GenresService {
  constructor(
    @InjectRepository(Genre)
    public readonly genreRepository: Repository<Genre>,
  ) {}

  async findAll(): Promise<Genre[]> {
    return await this.genreRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findByIds(ids: number[]): Promise<Genre[]> {
    if (!ids || ids.length === 0) return [];
    return await this.genreRepository.findByIds(ids);
  }

  async findOrCreateByNames(names: string[]): Promise<Genre[]> {
    if (!names || names.length === 0) return [];

    const genres: Genre[] = [];

    for (const name of names) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;

      const slug = this.generateSlug(trimmedName);

      let genre = await this.genreRepository.findOne({ where: { slug } });

      if (!genre) {
        genre = this.genreRepository.create({ name: trimmedName, slug });
        genre = await this.genreRepository.save(genre);
      }

      genres.push(genre);
    }

    return genres;
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
