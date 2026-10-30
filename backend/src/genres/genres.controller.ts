import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { GenresService } from './genres.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../products/product.entity';
import { UserRole } from '../users/user.entity';

@Controller('genres')
export class GenresController {
  constructor(
    private readonly genresService: GenresService,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  @Get()
  async findAll() {
    const genres = await this.genresService.findAll();
    
    // Add product count for each genre
    const genresWithCount = await Promise.all(
      genres.map(async (genre) => {
        const productCount = await this.productsRepository
          .createQueryBuilder('product')
          .innerJoin('product.genres', 'genre')
          .where('genre.id = :genreId', { genreId: genre.id })
          .getCount();

        return {
          ...genre,
          productCount,
        };
      }),
    );

    return genresWithCount;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async create(@Body() body: { name: string }) {
    if (!body.name || !body.name.trim()) {
      throw new BadRequestException('El nombre no puede estar vacío');
    }

    const genres = await this.genresService.findOrCreateByNames([body.name.trim()]);
    return genres[0];
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() body: { name: string }) {
    if (!body.name || !body.name.trim()) {
      throw new BadRequestException('El nombre no puede estar vacío');
    }

    const genre = await this.genresService.genreRepository.findOne({
      where: { id: parseInt(id) },
    });

    if (!genre) {
      throw new BadRequestException('Género no encontrado');
    }

    // Generate new slug from new name
    const slug = body.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    genre.name = body.name.trim();
    genre.slug = slug;

    return await this.genresService.genreRepository.save(genre);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async delete(@Param('id') id: string) {
    // Check if genre has products assigned
    const productCount = await this.productsRepository
      .createQueryBuilder('product')
      .innerJoin('product.genres', 'genre')
      .where('genre.id = :genreId', { genreId: id })
      .getCount();

    if (productCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar este género. Hay ${productCount} producto(s) asignado(s) a este género.`,
      );
    }

    const result = await this.genresService.genreRepository.delete(id);
    
    if (result.affected === 0) {
      throw new BadRequestException('Género no encontrado');
    }

    return { message: 'Género eliminado correctamente' };
  }
}
