import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { CreatePageDTO, UpdatePageDTO, PageDTO } from './dto/page.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('pages')
export class PagesController {
  constructor(private pagesService: PagesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Post()
  async create(@Request() req: any, @Body() createPageDto: CreatePageDTO): Promise<PageDTO> {
    // Si es admin del marketplace sin vendorId, usar el vendor del marketplace
    let vendorId = req.user.vendorId;
    if (!vendorId && req.user.role === UserRole.ADMIN) {
      vendorId = '00000000-0000-0000-0000-000000000001'; // Marketplace vendor ID
    }
    
    if (!vendorId) {
      throw new BadRequestException('Must be a vendor to create pages');
    }
    return this.pagesService.create(vendorId, createPageDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Get()
  async findAll(@Request() req: any): Promise<PageDTO[]> {
    // Si es admin del marketplace sin vendorId, usar el vendor del marketplace
    let vendorId = req.user.vendorId;
    if (!vendorId && req.user.role === UserRole.ADMIN) {
      vendorId = '00000000-0000-0000-0000-000000000001'; // Marketplace vendor ID
    }
    
    if (!vendorId) {
      throw new BadRequestException('Must be a vendor to access pages');
    }
    return this.pagesService.findAll(vendorId);
  }

  // Public routes MUST come before :pageId route to avoid conflicts
  @Get('public/:vendorSlug/all')
  async findAllPublic(@Param('vendorSlug') vendorSlug: string): Promise<PageDTO[]> {
    return this.pagesService.findAllByVendorSlug(vendorSlug);
  }

  @Get('public/:vendorSlug/homepage')
  async findHomepage(
    @Param('vendorSlug') vendorSlug: string,
  ): Promise<PageDTO | null> {
    console.log('🚨 [CONTROLLER] Homepage endpoint HIT! Vendor slug:', vendorSlug);
    console.log('🚨 [CONTROLLER] Request received at:', new Date().toISOString());
    
    try {
      const result = await this.pagesService.findHomepageByVendorSlug(vendorSlug);
      console.log('🚨 [CONTROLLER] Service result:', result ? 'FOUND' : 'NOT FOUND');
      return result;
    } catch (error) {
      console.error('🚨 [CONTROLLER] Error in homepage endpoint:', error);
      throw error;
    }
  }

  @Get('public/page/:pageId')
  async findPageById(@Param('pageId') pageId: string): Promise<PageDTO> {
    return this.pagesService.findById(pageId);
  }

  @Get('public/:vendorSlug/:pageSlug')
  async findBySlug(
    @Param('vendorSlug') vendorSlug: string,
    @Param('pageSlug') pageSlug: string,
  ): Promise<PageDTO> {
    return this.pagesService.findBySlug(vendorSlug, pageSlug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Get(':pageId')
  async findOne(@Request() req: any, @Param('pageId') pageId: string): Promise<PageDTO> {
    // Si es admin sin vendorId (admin del marketplace), permitir acceso directo sin requerir isPublished
    if (req.user.role === UserRole.ADMIN && !req.user.vendorId) {
      return this.pagesService.findById(pageId, false);
    }
    
    const vendorId = req.user.vendorId;
    if (!vendorId) {
      throw new BadRequestException('Must be a vendor to access pages');
    }
    return this.pagesService.findOne(vendorId, pageId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Patch(':pageId')
  async update(
    @Request() req: any,
    @Param('pageId') pageId: string,
    @Body() updatePageDto: UpdatePageDTO,
  ): Promise<PageDTO> {
    // Si es admin sin vendorId, actualizar directamente por pageId
    if (req.user.role === UserRole.ADMIN && !req.user.vendorId) {
      return this.pagesService.updateById(pageId, updatePageDto);
    }
    
    const vendorId = req.user.vendorId;
    if (!vendorId) {
      throw new BadRequestException('Must be a vendor to update pages');
    }
    return this.pagesService.update(vendorId, pageId, updatePageDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Delete(':pageId')
  async delete(@Request() req: any, @Param('pageId') pageId: string): Promise<void> {
    // Si es admin sin vendorId, eliminar directamente por pageId
    if (req.user.role === UserRole.ADMIN && !req.user.vendorId) {
      return this.pagesService.deleteById(pageId);
    }
    
    const vendorId = req.user.vendorId;
    if (!vendorId) {
      throw new BadRequestException('Must be a vendor to delete pages');
    }
    return this.pagesService.delete(vendorId, pageId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Post(':pageId/blocks')
  async addBlock(
    @Request() req: any,
    @Param('pageId') pageId: string,
    @Body() block: any,
  ): Promise<PageDTO> {
    const vendorId = req.user.vendorId;
    if (!vendorId) {
      throw new BadRequestException('Must be a vendor to add blocks');
    }
    return this.pagesService.addBlock(vendorId, pageId, block);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Patch(':pageId/blocks/:blockId')
  async updateBlock(
    @Request() req: any,
    @Param('pageId') pageId: string,
    @Param('blockId') blockId: string,
    @Body() blockData: any,
  ): Promise<PageDTO> {
    const vendorId = req.user.vendorId;
    if (!vendorId) {
      throw new BadRequestException('Must be a vendor to update blocks');
    }
    return this.pagesService.updateBlock(vendorId, pageId, blockId, blockData);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  @Delete(':pageId/blocks/:blockId')
  async deleteBlock(
    @Request() req: any,
    @Param('pageId') pageId: string,
    @Param('blockId') blockId: string,
  ): Promise<PageDTO> {
    const vendorId = req.user.vendorId;
    if (!vendorId) {
      throw new BadRequestException('Must be a vendor to delete blocks');
    }
    return this.pagesService.deleteBlock(vendorId, pageId, blockId);
  }
}
