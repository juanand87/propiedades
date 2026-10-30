import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { Product } from '../products/product.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(includeInactive = false) {
    const categories = await this.categoriesRepository.find({
      where: includeInactive ? {} : { isActive: true },
      relations: ['parent', 'children'],
      order: { name: 'ASC' },
    });

    // Agregar conteo de productos activos por categoría
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const productCount = await this.productsRepository
          .createQueryBuilder('product')
          .innerJoin('product.categories', 'category')
          .where('category.id = :categoryId', { categoryId: category.id })
          .andWhere('product.status = :status', { status: 'active' })
          .getCount();
        return { ...category, productCount };
      })
    );

    return categoriesWithCounts.filter(
      (category) => includeInactive || !category.parent || category.parent.isActive,
    );
  }

  async findOne(id: string) {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async create(categoryData: any) {
    const slug = categoryData.slug || this.generateSlug(categoryData.name);

    await this.ensureUniqueSlug(slug);
    const parent = await this.resolveParent(categoryData.parentId);
    const { parentId: _parentId, ...data } = categoryData;

    const category = this.categoriesRepository.create({
      ...data,
      slug,
      usesMusicMetadata: data.usesMusicMetadata ?? Boolean(data.format),
      parent,
      parentId: parent?.id || null,
    });
    
    return await this.categoriesRepository.save(category);
  }

  async update(id: string, categoryData: any) {
    const category = await this.findOne(id);

    if (categoryData.name && !categoryData.slug) {
      categoryData.slug = this.generateSlug(categoryData.name);
    }

    if (categoryData.slug && categoryData.slug !== category.slug) {
      await this.ensureUniqueSlug(categoryData.slug, id);
    }

    const { parentId, ...data } = categoryData;
    if (parentId !== undefined) {
      if (parentId === id) {
        throw new BadRequestException('Una categoría no puede ser su propia categoría padre');
      }
      const parent = await this.resolveParent(parentId);
      category.parent = parent;
      category.parentId = parent?.id || null;
    }

    Object.assign(category, data);
    return await this.categoriesRepository.save(category);
  }

  async delete(id: string) {
    const category = await this.findOne(id);
    
    // Verificar si hay productos asociados a esta categoría
    const productCount = await this.productsRepository
      .createQueryBuilder('product')
      .innerJoin('product.categories', 'category')
      .where('category.id = :categoryId', { categoryId: id })
      .getCount();

    if (productCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar la categoría "${category.name}" porque tiene ${productCount} producto(s) asociado(s). ` +
        `Por favor, reasigna o elimina primero los productos de esta categoría.`
      );
    }

    if (category.children?.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar la categoría "${category.name}" porque tiene subcategorías. ` +
        'Reasigna o elimina primero sus subcategorías.'
      );
    }

    await this.categoriesRepository.delete(id);
    return { success: true, message: 'Categoría eliminada correctamente' };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async resolveParent(parentId?: string | null): Promise<Category | null> {
    if (!parentId) return null;

    const parent = await this.categoriesRepository.findOne({ where: { id: parentId } });
    if (!parent) {
      throw new BadRequestException('La categoría padre seleccionada no existe');
    }
    return parent;
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.categoriesRepository.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Ya existe una categoría con el identificador "${slug}"`);
    }
  }
}
