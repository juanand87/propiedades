import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // ========== REGIONES Y COMUNAS (público) ==========

  @Get('regions')
  async getAllRegions() {
    return this.shippingService.getAllRegions();
  }

  @Get('regions/:regionId/communes')
  async getCommunesByRegion(@Param('regionId') regionId: number) {
    return this.shippingService.getCommunesByRegion(regionId);
  }

  @Get('communes')
  async getAllCommunes() {
    return this.shippingService.getAllCommunes();
  }

  // ========== MÉTODOS DE ENVÍO ==========

  @Get('methods')
  async getAllShippingMethods() {
    return this.shippingService.getAllShippingMethods();
  }

  @Get('methods/:code')
  async getShippingMethodByCode(@Param('code') code: string) {
    return this.shippingService.getShippingMethodByCode(code);
  }

  // ========== CONFIGURACIÓN DE VENDOR (requiere autenticación) ==========

  @UseGuards(JwtAuthGuard)
  @Get('vendor/:vendorId/methods')
  async getVendorShippingMethods(@Param('vendorId') vendorId: string) {
    return this.shippingService.getVendorShippingMethods(vendorId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('vendor/:vendorId/methods/:methodId/enable')
  async enableShippingMethod(
    @Param('vendorId') vendorId: string,
    @Param('methodId') methodId: number,
    @Body() body: { config: any },
  ) {
    return this.shippingService.enableShippingMethodForVendor(
      vendorId,
      methodId,
      body.config,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('vendor/:vendorId/methods/:methodId/disable')
  async disableShippingMethod(
    @Param('vendorId') vendorId: string,
    @Param('methodId') methodId: number,
  ) {
    return this.shippingService.disableShippingMethodForVendor(
      vendorId,
      methodId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put('vendor/:vendorId/methods/:methodId/config')
  async updateMethodConfig(
    @Param('vendorId') vendorId: string,
    @Param('methodId') methodId: number,
    @Body() body: { config: any },
  ) {
    return this.shippingService.updateVendorShippingMethodConfig(
      vendorId,
      methodId,
      body.config,
    );
  }

  // ========== CONFIGURACIÓN DE COMUNAS ==========

  @UseGuards(JwtAuthGuard)
  @Get('vendor-method/:vendorMethodId/communes')
  async getCommuneConfig(@Param('vendorMethodId') vendorMethodId: number) {
    return this.shippingService.getCommuneConfigForVendorMethod(vendorMethodId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('vendor-method/:vendorMethodId/communes/:communeId')
  async setCommuneConfig(
    @Param('vendorMethodId') vendorMethodId: number,
    @Param('communeId') communeId: number,
    @Body()
    body: {
      isAvailable: boolean;
      baseCost: number;
      estimatedDays: number;
      additionalConfig?: any;
    },
  ) {
    return this.shippingService.setCommuneConfig(
      vendorMethodId,
      communeId,
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('vendor-method/:vendorMethodId/communes/bulk')
  async bulkSetCommuneConfig(
    @Param('vendorMethodId') vendorMethodId: string,
    @Body()
    body: {
      communes: Array<{
        communeId: number;
        isAvailable: boolean;
        baseCost: number;
        estimatedDays: number;
        additionalConfig?: any;
      }>;
    },
  ) {
    console.log('🚨🚨🚨 ENDPOINT HIT - vendorMethodId:', vendorMethodId);
    console.log('🚨🚨🚨 Body communes count:', body.communes?.length);
    console.log('🚨🚨🚨 First 3 communes:', body.communes?.slice(0, 3));
    
    try {
      const vendorMethodIdNum = parseInt(vendorMethodId, 10);
      console.log('bulkSetCommuneConfig called with:', {
        vendorMethodId: vendorMethodIdNum,
        communesCount: body.communes?.length,
        firstCommune: body.communes?.[0],
      });
      return await this.shippingService.bulkSetCommuneConfig(
        vendorMethodIdNum,
        body.communes,
      );
    } catch (error) {
      console.error('Error in bulkSetCommuneConfig:', error);
      throw error;
    }
  }

  // ========== COTIZACIÓN (público o semi-público) ==========

  @Post('calculate-with-products')
  async calculateShippingWithProducts(
    @Body()
    body: {
      vendorId: string;
      communeId: number;
      products: Array<{ productId: string; quantity: number }>;
      declaredValue: number;
    },
  ) {
    return this.shippingService.calculateShippingWithProducts(
      body.vendorId,
      body.communeId,
      body.products,
      body.declaredValue,
    );
  }

  @Post('calculate')
  async calculateShipping(
    @Body()
    body: {
      vendorId: string;
      communeId: number;
      weight: number;
      dimensions: { length: number; width: number; height: number };
      declaredValue: number;
    },
  ) {
    return this.shippingService.calculateShipping(
      body.vendorId,
      body.communeId,
      body.weight,
      body.dimensions,
      body.declaredValue,
    );
  }

  // ========== TEST CONNECTION ==========

  @Post('test-connection')
  async testConnection(
    @Body()
    body: {
      methodCode: string;
      config: any;
    },
  ) {
    return this.shippingService.testConnection(body.methodCode, body.config);
  }
}
