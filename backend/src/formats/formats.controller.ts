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
import { FormatsService } from './formats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../products/product.entity';
import { UserRole } from '../users/user.entity';

@Controller('formats')
export class FormatsController {
  constructor(
    private readonly formatsService: FormatsService,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  @Get()
  async findAll() {
    const formats = await this.formatsService.findAll();
    
    // Add product count for each format
    const formatsWithCount = await Promise.all(
      formats.map(async (format) => {
        const productCount = await this.productsRepository
          .createQueryBuilder('product')
          .innerJoin('product.formats', 'format')
          .where('format.id = :formatId', { formatId: format.id })
          .getCount();

        return {
          ...format,
          productCount,
        };
      }),
    );

    return formatsWithCount;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async create(@Body() body: { name: string }) {
    if (!body.name || !body.name.trim()) {
      throw new BadRequestException('El nombre no puede estar vacío');
    }

    const formats = await this.formatsService.findOrCreateByNames([body.name.trim()]);
    return formats[0];
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() body: { name: string }) {
    if (!body.name || !body.name.trim()) {
      throw new BadRequestException('El nombre no puede estar vacío');
    }

    const format = await this.formatsService.formatRepository.findOne({
      where: { id: parseInt(id) },
    });

    if (!format) {
      throw new BadRequestException('Formato no encontrado');
    }

    // Generate new slug from new name
    const slug = body.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    format.name = body.name.trim();
    format.slug = slug;

    return await this.formatsService.formatRepository.save(format);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async delete(@Param('id') id: string) {
    // Check if format has products assigned
    const productCount = await this.productsRepository
      .createQueryBuilder('product')
      .innerJoin('product.formats', 'format')
      .where('format.id = :formatId', { formatId: id })
      .getCount();

    if (productCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar este formato. Hay ${productCount} producto(s) asignado(s) a este formato.`,
      );
    }

    const result = await this.formatsService.formatRepository.delete(id);
    
    if (result.affected === 0) {
      throw new BadRequestException('Formato no encontrado');
    }

    return { message: 'Formato eliminado correctamente' };
  }
}
