import { Controller, Get, Put, Param, Body, Post, Patch } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  // Settings endpoints
  @Get('settings')
  getAllSettings() {
    return this.marketplaceService.getAllSettings();
  }

  @Get('settings/:key')
  getSetting(@Param('key') key: string) {
    return this.marketplaceService.getSetting(key);
  }

  @Put('settings/:key')
  updateSetting(@Param('key') key: string, @Body('value') value: string) {
    return this.marketplaceService.updateSetting(key, value);
  }

  // Payment methods endpoints
  @Get('payment-methods')
  getAllPaymentMethods() {
    return this.marketplaceService.getAllPaymentMethods();
  }

  @Get('payment-methods/active')
  getActivePaymentMethods() {
    return this.marketplaceService.getActivePaymentMethods();
  }

  @Get('payment-methods/code/:code')
  getPaymentMethodByCode(@Param('code') code: string) {
    return this.marketplaceService.getPaymentMethodByCode(code);
  }

  @Patch('payment-methods/:id')
  updatePaymentMethod(@Param('id') id: string, @Body() data: any) {
    return this.marketplaceService.updatePaymentMethod(id, data);
  }

  // Vendor payment methods endpoints
  @Get('vendors/:vendorId/payment-methods')
  getVendorPaymentMethods(@Param('vendorId') vendorId: string) {
    return this.marketplaceService.getVendorPaymentMethods(vendorId);
  }

  @Post('vendors/:vendorId/payment-methods/:methodId/enable')
  enableVendorPaymentMethod(
    @Param('vendorId') vendorId: string,
    @Param('methodId') methodId: number,
    @Body('customConfig') customConfig?: any,
  ) {
    return this.marketplaceService.enableVendorPaymentMethod(vendorId, methodId, customConfig);
  }

  @Post('vendors/:vendorId/payment-methods/:methodId/disable')
  disableVendorPaymentMethod(
    @Param('vendorId') vendorId: string,
    @Param('methodId') methodId: number,
  ) {
    return this.marketplaceService.disableVendorPaymentMethod(vendorId, methodId);
  }

  // Vendor management endpoints
  @Get('vendors')
  getAllVendors() {
    return this.marketplaceService.getAllVendors();
  }

  @Patch('vendors/:vendorId/payku')
  updateVendorPaykuCredentials(
    @Param('vendorId') vendorId: string,
    @Body() data: { paykuClientId?: string; paykuAffiliationToken?: string },
  ) {
    return this.marketplaceService.updateVendorPaykuCredentials(vendorId, data);
  }

  // Crear cliente y afiliación de Payku automáticamente
  @Post('vendors/:vendorId/payku/setup')
  async setupVendorPayku(
    @Param('vendorId') vendorId: string,
    @Body() data: { 
      vendorName: string;
      vendorEmail: string;
      vendorRut: string;
      vendorPhone: string;
      accountBankRut: string;
      accountBankSbif: string;
      accountBankType: string;
      accountBankNum: string;
      commissionPercentage?: number;
    },
  ) {
    return this.marketplaceService.setupVendorPayku(vendorId, data);
  }
}
