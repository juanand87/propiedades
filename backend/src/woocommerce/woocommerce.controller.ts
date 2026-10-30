import { Controller, Get, Post, Param, Body, UseGuards, Req, Query, Headers } from '@nestjs/common';
import { WoocommerceService } from './woocommerce.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WooCommerceCredentialsDto } from './dto/woocommerce-credentials.dto';

@Controller('woocommerce')
@UseGuards(JwtAuthGuard)
export class WoocommerceController {
  constructor(private readonly woocommerceService: WoocommerceService) {}

  @Post('plugin-code/:vendorId')
  async generatePluginCode(@Param('vendorId') vendorId: string, @Req() req: any) {
    if (req.user.vendorId !== vendorId) {
      return { success: false, message: 'Unauthorized' };
    }
    return this.woocommerceService.generatePluginConnectionCode(vendorId);
  }

  @Get('test-connection/:vendorId')
  async testConnection(@Param('vendorId') vendorId: string, @Req() req: any) {
    // Verify vendor owns this store
    if (req.user.vendorId !== vendorId) {
      return { success: false, message: 'Unauthorized' };
    }
    return this.woocommerceService.testConnection(vendorId);
  }

  @Post('export/:productId')
  async exportProduct(@Param('productId') productId: string, @Req() req: any) {
    return this.woocommerceService.exportProduct(productId, req.user.vendorId);
  }

  @Post('export-all/:vendorId')
  async exportAllProducts(@Param('vendorId') vendorId: string, @Req() req: any) {
    if (req.user.vendorId !== vendorId) {
      return { success: false, message: 'Unauthorized' };
    }
    // TODO: Export all products for vendor
    return { success: true, message: 'Export all not yet implemented' };
  }

  @Post('import/:vendorId')
  async importProducts(@Param('vendorId') vendorId: string, @Req() req: any) {
    if (req.user.vendorId !== vendorId) {
      return { success: false, message: 'Unauthorized' };
    }
    return this.woocommerceService.importProducts(vendorId);
  }

  @Get('categories/:vendorId')
  async getCategories(@Param('vendorId') vendorId: string, @Req() req: any) {
    if (req.user.vendorId !== vendorId) {
      return { success: false, message: 'Unauthorized' };
    }
    const categories = await this.woocommerceService.getCategories(vendorId);
    return { categories };
  }

  @Get('products/:vendorId')
  async getProducts(
    @Param('vendorId') vendorId: string,
    @Query('category') category: string,
    @Query('page') page: string,
    @Query('perPage') perPage: string,
    @Req() req: any,
  ) {
    if (req.user.vendorId !== vendorId) {
      return { success: false, message: 'Unauthorized' };
    }
    const pageNum = page ? parseInt(page) : 1;
    // perPage=0 means "all"
    const perPageNum = perPage !== undefined ? parseInt(perPage) : 50;
    return this.woocommerceService.getProducts(vendorId, category, pageNum, perPageNum);
  }

  @Post('import-selected/:vendorId')
  async importSelectedProducts(
    @Param('vendorId') vendorId: string,
    @Body() body: { products: Array<{ productId: number; condition: string; mediaGrade?: string; sleeveGrade?: string; categoryIds?: string[]; enableSpotify?: boolean }> },
    @Req() req: any,
  ) {
    if (req.user.vendorId !== vendorId) {
      return { success: false, message: 'Unauthorized' };
    }
    return this.woocommerceService.importSelectedProducts(vendorId, body.products);
  }

  // SYNC ENDPOINTS - Export from MundoBeat to WooCommerce
  @Post('sync/:productId')
  async syncProduct(@Param('productId') productId: string, @Req() req: any) {
    return this.woocommerceService.syncProductToWooCommerce(productId, req.user.vendorId);
  }

  @Post('sync-all/:vendorId')
  async syncAllProducts(@Param('vendorId') vendorId: string, @Req() req: any) {
    if (req.user.vendorId !== vendorId) {
      return { success: false, message: 'Unauthorized' };
    }
    return this.woocommerceService.syncAllProducts(vendorId);
  }

}
