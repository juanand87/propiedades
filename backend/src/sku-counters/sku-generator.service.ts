import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkuCounter } from './sku-counter.entity';
import { Product, ProductType } from '../products/product.entity';
import { Category } from '../categories/category.entity';

@Injectable()
export class SkuGeneratorService {
  constructor(
    @InjectRepository(SkuCounter)
    private skuCounterRepository: Repository<SkuCounter>,
  ) {}

  /**
   * Genera un SKU automático en formato: {PREFIX}-{YEAR}-{NUMBER}
   * Ejemplo: VI-2026-0001, CD-2026-0052
   */
  async generateSku(vendorId: string, categories: Category[]): Promise<string> {
    const prefix = this.getFormatPrefix(categories);
    const year = new Date().getFullYear();

    // Buscar o crear contador para este vendor/formato/año
    let counter = await this.skuCounterRepository.findOne({
      where: {
        vendorId,
        formatPrefix: prefix,
        year,
      },
    });

    if (!counter) {
      // Crear nuevo contador
      counter = this.skuCounterRepository.create({
        vendorId,
        formatPrefix: prefix,
        year,
        lastNumber: 0,
      });
    }

    // Incrementar contador
    counter.lastNumber += 1;
    await this.skuCounterRepository.save(counter);

    // Formatear número con ceros a la izquierda (4 dígitos)
    const numberPart = counter.lastNumber.toString().padStart(4, '0');

    return `${prefix}-${year}-${numberPart}`;
  }

  /**
   * Determina el prefijo según las categorías del producto
   */
  private getFormatPrefix(categories: Category[]): string {
    if (!categories || categories.length === 0) {
      return 'PR'; // Default: PRoduct
    }

    // Buscar categoría que determine el tipo
    for (const category of categories) {
      const format = category.format?.toLowerCase();
      
      if (format === 'vinyl' || category.name.toLowerCase().includes('vinil')) {
        return 'VI';
      }
      if (format === 'cd' || category.name.toLowerCase().includes('cd')) {
        return 'CD';
      }
      if (format === 'cassette' || category.name.toLowerCase().includes('cassette')) {
        return 'CS';
      }
      if (category.name.toLowerCase().includes('merch') || 
          category.name.toLowerCase().includes('merchandising')) {
        return 'MC';
      }
      if (category.name.toLowerCase().includes('equip') || 
          category.name.toLowerCase().includes('accesorio')) {
        return 'EQ';
      }
    }

    return 'PR'; // Default si no se puede determinar
  }

  /**
   * Valida si un SKU ya existe en la base de datos
   */
  async skuExists(sku: string, productRepository: Repository<Product>): Promise<boolean> {
    const existing = await productRepository.findOne({ where: { sku } });
    return !!existing;
  }
}
