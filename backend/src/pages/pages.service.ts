import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page } from './page.entity';
import { Vendor } from '../vendors/vendor.entity';
import { CreatePageDTO, UpdatePageDTO, PageDTO } from './dto/page.dto';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(Page)
    private pagesRepository: Repository<Page>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
  ) {}

  async create(vendorId: string, createPageDto: CreatePageDTO): Promise<PageDTO> {
    // Validar que el slug sea único para este vendor
    const existingPage = await this.pagesRepository.findOne({
      where: {
        vendorId,
        slug: createPageDto.slug,
      },
    });

    if (existingPage) {
      throw new BadRequestException('El slug ya existe para esta tienda');
    }

    const page = this.pagesRepository.create({
      ...createPageDto,
      vendorId,
      blocks: createPageDto.blocks || [],
    });

    const savedPage = await this.pagesRepository.save(page) as any;
    return this.mapToDTO(savedPage);
  }

  async findAll(vendorId: string): Promise<PageDTO[]> {
    const pages = await this.pagesRepository.find({
      where: { vendorId },
      order: { createdAt: 'DESC' },
    });

    return pages.map((page) => this.mapToDTO(page));
  }

  async findAllByVendorSlug(vendorSlug: string): Promise<PageDTO[]> {
    const pages = await this.pagesRepository.find({
      where: { 
        isPublished: true,
      },
      relations: ['vendor'],
      order: { createdAt: 'DESC' },
    });

    // Filter by vendor slug
    const vendorPages = pages.filter(page => page.vendor && page.vendor.slug === vendorSlug);
    return vendorPages.map((page) => this.mapToDTO(page));
  }

  async findOne(vendorId: string, pageId: string): Promise<PageDTO> {
    const page = await this.pagesRepository.findOne({
      where: {
        id: pageId,
        vendorId,
      },
    });

    if (!page) {
      throw new NotFoundException('Pagina no encontrada');
    }

    if (page.blocks) {
      const slidesBlocks = page.blocks.filter(b => b.type === 'slides');
      console.log(`[Pages Service] 🎬 Slides blocks in findOne:`, JSON.stringify(slidesBlocks, null, 2));
    }

    return this.mapToDTO(page);
  }

  async findBySlug(vendorSlug: string, pageSlug: string): Promise<PageDTO> {
    const vendor = await this.vendorRepository.findOne({
      where: { slug: vendorSlug },
    });

    if (!vendor) {
      throw new NotFoundException('Pagina no encontrada');
    }

    const page = await this.pagesRepository.findOne({
      where: {
        vendorId: vendor.id,
        slug: pageSlug,
        isPublished: true,
      },
      relations: ['vendor'],
    });

    if (!page) {
      throw new NotFoundException('Pagina no encontrada');
    }

    return this.mapToDTO(page);
  }

  async findById(pageId: string, requirePublished: boolean = true): Promise<PageDTO> {
    const whereClause: any = { id: pageId };
    
    // Solo requerir isPublished si se especifica
    if (requirePublished) {
      whereClause.isPublished = true;
    }
    
    const page = await this.pagesRepository.findOne({
      where: whereClause,
    });

    if (!page) {
      throw new NotFoundException('Pagina no encontrada');
    }

    return this.mapToDTO(page);
  }

  async update(vendorId: string, pageId: string, updatePageDto: UpdatePageDTO): Promise<PageDTO> {
    console.log(`[Pages Service] Updating page ${pageId} - blocks: ${updatePageDto.blocks ? updatePageDto.blocks.length : 0}`);
    if (updatePageDto.blocks) {
      const slidesBlocks = updatePageDto.blocks.filter(b => b.type === 'slides');
      console.log(`[Pages Service] 🎬 Slides blocks being saved:`, JSON.stringify(slidesBlocks, null, 2));
    }
    
    const page = await this.pagesRepository.findOne({
      where: {
        id: pageId,
        vendorId,
      },
    });

    if (!page) {
      throw new NotFoundException('Pagina no encontrada');
    }

    // Validar que el slug sea único si se cambió
    if (updatePageDto.slug && updatePageDto.slug !== page.slug) {
      const existingPage = await this.pagesRepository.findOne({
        where: {
          vendorId,
          slug: updatePageDto.slug,
        },
      });

      if (existingPage) {
        throw new BadRequestException('El slug ya existe para esta tienda');
      }
    }

    // Si se marca como homepage, desmarcar las otras páginas
    if (updatePageDto.isHomepage && !page.isHomepage) {
      await this.pagesRepository.update(
        { vendorId, isHomepage: true },
        { isHomepage: false }
      );
    }

    Object.assign(page, updatePageDto);
    const updatedPage = await this.pagesRepository.save(page);
    
    console.log(`[Pages Service] ✅ Page saved successfully with ${updatedPage.blocks ? updatedPage.blocks.length : 0} blocks`);
    if (updatedPage.blocks) {
      const slidesBlocks = updatedPage.blocks.filter(b => b.type === 'slides');
      console.log(`[Pages Service] 🎬 Slides blocks after save:`, JSON.stringify(slidesBlocks, null, 2));
    }
    
    return this.mapToDTO(updatedPage);
  }

  async updateById(pageId: string, updatePageDto: UpdatePageDTO): Promise<PageDTO> {
    console.log(`[Pages Service] Admin updating page ${pageId} - blocks: ${updatePageDto.blocks ? updatePageDto.blocks.length : 0}`);
    
    const page = await this.pagesRepository.findOne({
      where: { id: pageId },
    });

    if (!page) {
      throw new NotFoundException('Pagina no encontrada');
    }

    // Validar que el slug sea único si se cambió
    if (updatePageDto.slug && updatePageDto.slug !== page.slug) {
      const existingPage = await this.pagesRepository.findOne({
        where: {
          vendorId: page.vendorId,
          slug: updatePageDto.slug,
        },
      });

      if (existingPage) {
        throw new BadRequestException('El slug ya existe para esta tienda');
      }
    }

    // Si se marca como homepage, desmarcar las otras páginas del mismo vendor
    if (updatePageDto.isHomepage && !page.isHomepage) {
      await this.pagesRepository.update(
        { vendorId: page.vendorId, isHomepage: true },
        { isHomepage: false }
      );
    }

    Object.assign(page, updatePageDto);
    const updatedPage = await this.pagesRepository.save(page);
    
    console.log(`[Pages Service] ✅ Admin saved page successfully with ${updatedPage.blocks ? updatedPage.blocks.length : 0} blocks`);
    
    return this.mapToDTO(updatedPage);
  }

  async delete(vendorId: string, pageId: string): Promise<void> {
    const page = await this.pagesRepository.findOne({
      where: {
        id: pageId,
        vendorId,
      },
    });

    if (!page) {
      throw new NotFoundException('Pagina no encontrada');
    }

    if (page.isHomepage) {
      throw new BadRequestException('No se puede eliminar la página de inicio');
    }

    await this.pagesRepository.remove(page);
  }

  async deleteById(pageId: string): Promise<void> {
    const page = await this.pagesRepository.findOne({
      where: { id: pageId },
    });

    if (!page) {
      throw new NotFoundException('Pagina no encontrada');
    }

    if (page.isHomepage) {
      throw new BadRequestException('No se puede eliminar la página de inicio');
    }

    await this.pagesRepository.remove(page);
  }

  async addBlock(vendorId: string, pageId: string, block: any): Promise<PageDTO> {
    const page = await this.pagesRepository.findOne({
      where: {
        id: pageId,
        vendorId,
      },
    });

    if (!page) {
      throw new NotFoundException('Pagina no encontrada');
    }

    if (!page.blocks) {
      page.blocks = [];
    }

    page.blocks.push(block);
    const updatedPage = await this.pagesRepository.save(page);
    return this.mapToDTO(updatedPage);
  }

  async updateBlock(vendorId: string, pageId: string, blockId: string, blockData: any): Promise<PageDTO> {
    const page = await this.pagesRepository.findOne({
      where: {
        id: pageId,
        vendorId,
      },
    });

    if (!page) {
      throw new NotFoundException('Pagina no encontrada');
    }

    if (!page.blocks) {
      throw new NotFoundException('Bloque no encontrado');
    }

    const blockIndex = page.blocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) {
      throw new NotFoundException('Bloque no encontrado');
    }

    page.blocks[blockIndex] = { ...page.blocks[blockIndex], ...blockData };
    const updatedPage = await this.pagesRepository.save(page);
    return this.mapToDTO(updatedPage);
  }

  async deleteBlock(vendorId: string, pageId: string, blockId: string): Promise<PageDTO> {
    const page = await this.pagesRepository.findOne({
      where: {
        id: pageId,
        vendorId,
      },
    });

    if (!page) {
      throw new NotFoundException('Pagina no encontrada');
    }

    page.blocks = page.blocks?.filter((b) => b.id !== blockId) || [];
    const updatedPage = await this.pagesRepository.save(page);
    return this.mapToDTO(updatedPage);
  }

  async findHomepageByVendorSlug(vendorSlug: string): Promise<PageDTO | null> {
    try {
      console.log('🎯 [Pages Controller] Homepage endpoint called for vendor slug:', vendorSlug);
      
      // First find the vendor by slug
      const vendor = await this.vendorRepository.findOne({
        where: { slug: vendorSlug }
      });

      console.log('👤 Vendor found:', vendor ? { id: vendor.id, slug: vendor.slug } : 'NOT FOUND');

      if (!vendor) {
        console.log('❌ Vendor not found with slug:', vendorSlug);
        return null;
      }

      // Then find the homepage for this vendor
      const page = await this.pagesRepository.findOne({
        where: { 
          vendorId: vendor.id, 
          isHomepage: true,
          isPublished: true 
        },
      });

      console.log('🏠 Homepage found:', page ? { 
        id: page.id, 
        title: page.title, 
        slug: page.slug, 
        isHomepage: page.isHomepage, 
        isPublished: page.isPublished,
        vendorId: page.vendorId
      } : 'NOT FOUND');

      if (!page) {
        console.log('❌ No homepage found for vendor:', vendor.id);
        return null;
      }

      // Convert to DTO
      const dto = this.mapToDTO(page);
      console.log('✅ DTO created successfully with blocks count:', dto.blocks?.length || 0);
      return dto;
    } catch (error) {
      console.error('❌ Error finding homepage:', error);
      return null;
    }
  }

  private mapToDTO(page: Page): PageDTO {
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      description: page.description,
      blocks: page.blocks || [],
      rowsConfig: page.rowsConfig || [],
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      isPublished: page.isPublished,
      isHomepage: page.isHomepage,
      vendorId: page.vendorId,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }
}
