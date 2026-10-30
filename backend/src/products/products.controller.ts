import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ValidationPipe,
  BadRequestException,
  Res,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { ProductStatus } from './product.entity';
import { ProductImportService } from '../product-import/product-import.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => ProductImportService))
    private readonly productImportService: ProductImportService,
  ) {}

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('vendorId') vendorId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('marketplaceOnly') marketplaceOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('condition') condition?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('isOnSale') isOnSale?: string,
    @Query('sortBy') sortBy?: string,
    @Query('format') format?: string | string[], // Catálogo: filtro por formato
    @Query('genre') genre?: string | string[], // Catálogo: filtro por género
    @Query('mediaGrade') mediaGrade?: string | string[], // Catálogo: filtro por estado del disco
    @Query('sleeveGrade') sleeveGrade?: string | string[], // Catálogo: filtro por estado de la funda
    @Query('artist') artist?: string, // Catálogo: filtro por artista
    @Query('country') country?: string, // Busqueda avanzada: pais de edicion
    @Query('barcode') barcode?: string, // Búsqueda por código de barras
    @Query('includeOutOfStock') includeOutOfStock?: string,
  ) {
    console.log('🔍 [ProductsController] Query params:', { 
      condition, isFeatured, sortBy, format, genre, mediaGrade, sleeveGrade, artist 
    });
    return this.productsService.findAll({
      type,
      search,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      vendorId,
      categoryId,
      marketplaceOnly: marketplaceOnly === 'true',
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      condition,
      isFeatured: isFeatured === 'true',
      isOnSale: isOnSale === 'true' ? true : undefined,
      sortBy,
      format: Array.isArray(format) ? format : (format ? [format] : undefined),
      genre: Array.isArray(genre) ? genre : (genre ? [genre] : undefined),
      mediaGrade: Array.isArray(mediaGrade) ? mediaGrade : (mediaGrade ? [mediaGrade] : undefined),
      sleeveGrade: Array.isArray(sleeveGrade) ? sleeveGrade : (sleeveGrade ? [sleeveGrade] : undefined),
      artist,
      country,
      barcode,
      includeOutOfStock: includeOutOfStock === 'true',
    });
  }

  // ==================== MIGRATION ENDPOINTS ====================
  // IMPORTANTE: Estos deben estar ANTES de @Get(':id') para evitar conflictos de rutas
  
  @Get('migrate-relations')
  async migrateRelations() {
    return this.productsService.migrateProductRelations();
  }

  @Get('migrate-status')
  async getMigrationStatus() {
    return this.productsService.getMigrationStatus();
  }

  /**
   * Exporta productos a Excel
   * POST /products/export
   */
  @Post('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async exportProducts(
    @Request() req,
    @Body('fields') fields: string[],
    @Body('status') status: string,
    @Res() res: Response,
  ) {
    try {
      const vendorId = await this.productsService.getVendorIdByUserId(req.user.userId);
      if (!vendorId) {
        return res.status(400).json({ message: 'User does not have an associated vendor' });
      }

      if (!fields || fields.length === 0) {
        return res.status(400).json({ message: 'No fields specified for export' });
      }

      const buffer = await this.productsService.exportToExcel(vendorId, fields, status);
      
      const filename = `productos_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ message: error.message || 'Error exporting products' });
    }
  }

  /**
   * Descarga imágenes desde Discogs y las sube a DigitalOcean Spaces
   * POST /products/download-discogs-images
   * Body: { images: [{ uri: string }], slug: string }
   * Returns: { images: string[] } - URLs de las imágenes en Spaces
   */
  @Post('download-discogs-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async downloadDiscogsImages(
    @Body() body: { images: Array<{ uri: string }>; slug: string },
    @Request() req,
  ) {
    try {
      if (!body.images || !body.slug) {
        throw new BadRequestException('Images and slug are required');
      }

      console.log(`📸 [ProductsController] Downloading ${body.images.length} images for slug: ${body.slug}`);
      
      // Usar el método público de ProductImportService
      const localImages = await this.productImportService.downloadProductImages(
        body.images,
        body.slug,
      );

      console.log(`✅ [ProductsController] Successfully downloaded ${localImages.length} images`);
      
      return { images: localImages };
    } catch (error) {
      console.error('[ProductsController] Error downloading images:', error);
      throw new BadRequestException(error.message || 'Error downloading images from Discogs');
    }
  }

  /**
   * Migra todas las imágenes de Discogs a DigitalOcean Spaces
   * POST /products/migrate-discogs-images
   * Query: ?dryRun=true (opcional, para ver qué se haría sin ejecutar)
   * Returns: { migrated: number, failed: number, skipped: number, details: [] }
   */
  @Post('migrate-discogs-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async migrateDiscogsImages(
    @Query('dryRun') dryRun?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.productsService.migrateDiscogsImagesToSpaces(
      dryRun === 'true',
      vendorId,
    );
  }

  // ==================== ESTADÍSTICAS ====================

  // Tracking de visitas al producto (público, sin auth)
  @Post(':id/view')
  async trackView(@Param('id') id: string) {
    return this.productsService.incrementViewCount(id);
  }

  // Tracking de "agregar al carrito" (público, sin auth)
  @Post(':id/cart')
  async trackCart(@Param('id') id: string) {
    return this.productsService.incrementCartCount(id);
  }

  // Estadísticas de tráfico del sitio del vendor autenticado
  @Get('vendor/site-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getSiteStats(
    @Request() req,
    @Query('days') days?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const vendorId = await this.productsService.getVendorIdByUserId(req.user.userId);
    if (!vendorId) {
      return {
        totalVisits: 0,
        avgTimeOnSite: 0,
        bounceRate: 0,
        trafficBySource: [],
        visitsByRegion: [],
        devices: [],
        browsers: [],
        newVsReturning: [],
        dailySessions: [],
        topPages: [],
        conversionRate: 0,
        totalPurchases: 0,
        totalRevenue: 0,
      };
    }
    return this.productsService.getVendorSiteStats(
      vendorId,
      days ? parseInt(days, 10) : undefined,
      startDate,
      endDate,
    );
  }

  // Estadísticas de productos del vendor autenticado
  @Get('vendor/product-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getProductStats(@Request() req) {
    const vendorId = await this.productsService.getVendorIdByUserId(req.user.userId);
    if (!vendorId) {
      return [];
    }
    return this.productsService.getVendorProductStats(vendorId);
  }

  // ==================== STANDARD CRUD ====================

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async create(
    @Body() createProductDto: CreateProductDto,
    @Request() req,
  ) {
    // Obtener vendorId del usuario autenticado (desde userId, no desde el token)
    const vendorId = await this.productsService.getVendorIdByUserId(req.user.userId);
    if (!vendorId) {
      throw new BadRequestException('User does not have an associated vendor');
    }
    return this.productsService.create(createProductDto, vendorId);
  }

  @Post('bulk-update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async bulkUpdate(
    @Body() body: {
      productIds: string[];
      updates: {
        status?: string;
        condition?: string;
        mediaGrade?: string;
        sleeveGrade?: string;
        stock?: number;
        categoryIds?: string[];
        formatName?: string;
      };
    },
    @Request() req,
  ) {
    const vendorId = await this.productsService.getVendorIdByUserId(req.user.userId);
    if (!vendorId) {
      throw new BadRequestException('User does not have an associated vendor');
    }
    if (!body.productIds || body.productIds.length === 0) {
      throw new BadRequestException('No product IDs provided');
    }
    return this.productsService.bulkUpdate(vendorId, body.productIds, body.updates || {});
  }

  @Post('trash/sync-woocommerce')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async syncTrashToWooCommerce(
    @Body() body: { productIds?: string[] },
    @Request() req,
  ) {
    const vendorId = await this.productsService.getVendorIdByUserId(req.user.userId);
    if (!vendorId) {
      throw new BadRequestException('User does not have an associated vendor');
    }

    return this.productsService.syncTrashToWooCommerce(vendorId, body?.productIds);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateProductDto: UpdateProductDto,
    @Request() req,
  ) {
    return this.productsService.update(
      id,
      updateProductDto,
      req.user.userId,
      req.user.role,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  remove(@Param('id') id: string, @Request() req) {
    return this.productsService.remove(id, req.user.userId, req.user.role);
  }

  // ==================== GESTIÓN DE ESTADOS ====================

  /**
   * Obtiene productos del vendedor con filtro por estado
   * GET /products/vendor/me?status=active,inactive
   */
  @Get('vendor/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getMyProducts(
    @Request() req,
    @Query('status') statusQuery?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const vendorId = await this.productsService.getVendorIdByUserId(req.user.userId);
    if (!vendorId) {
      throw new BadRequestException('User does not have an associated vendor');
    }

    // Parsear status query (puede ser "active" o "active,inactive")
    let statuses: ProductStatus[] | undefined;
    if (statusQuery) {
      statuses = statusQuery.split(',').map(s => s.trim() as ProductStatus);
    }

    const [products, total] = await this.productsService.findByVendorAndStatus(
      vendorId,
      statuses,
      {
        search,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      }
    );

    return { products, total };
  }

  /**
   * Obtiene productos en papelera del vendedor
   * GET /products/trash
   */
  @Get('trash')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getTrashed(@Request() req) {
    const vendorId = await this.productsService.getVendorIdByUserId(req.user.userId);
    if (!vendorId) {
      throw new BadRequestException('User does not have an associated vendor');
    }

    return this.productsService.findTrashedByVendor(vendorId);
  }

  /**
   * Cambia el estado de un producto
   * PATCH /products/:id/status
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: ProductStatus,
    @Request() req,
  ) {
    return this.productsService.updateStatus(id, status, req.user.userId, req.user.role);
  }

  /**
   * Restaura un producto de la papelera
   * POST /products/:id/restore
   */
  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  restore(@Param('id') id: string, @Request() req) {
    return this.productsService.restoreFromTrash(id, req.user.userId, req.user.role);
  }

  /**
   * Elimina permanentemente un producto de la papelera
   * DELETE /products/:id/permanent
   */
  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  permanentDelete(@Param('id') id: string, @Request() req) {
    return this.productsService.permanentDelete(id, req.user.userId, req.user.role);
  }

  /**
   * Vacía la papelera (elimina productos con más de X días)
   * POST /products/trash/empty?days=30
   */
  @Post('trash/empty')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async emptyTrash(
    @Request() req,
    @Query('days') days?: string,
  ) {
    const vendorId = await this.productsService.getVendorIdByUserId(req.user.userId);
    if (!vendorId) {
      throw new BadRequestException('User does not have an associated vendor');
    }

    return this.productsService.emptyTrash(vendorId, days ? parseInt(days) : 30);
  }
}
