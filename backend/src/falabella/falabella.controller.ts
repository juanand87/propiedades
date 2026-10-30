import { Body, Controller, Get, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FalabellaService } from './falabella.service';

@Controller('falabella')
@UseGuards(JwtAuthGuard)
export class FalabellaController {
  constructor(private readonly falabellaService: FalabellaService) {}

  @Get('configuration')
  getConfiguration(@Req() req: any) {
    return this.falabellaService.getConfiguration(req.user.vendorId);
  }

  @Put('configuration')
  saveConfiguration(@Body() body: { userId?: string; apiKey?: string; country?: string; config?: Record<string, unknown> }, @Req() req: any) {
    return this.falabellaService.saveConfiguration(req.user.vendorId, body);
  }

  @Post('connection/test')
  testConnection(@Req() req: any) {
    return this.falabellaService.testConnection(req.user.vendorId);
  }

  @Get('categories')
  getCategories(@Req() req: any) {
    return this.falabellaService.getCategories(req.user.vendorId);
  }

  @Post('products/:productId/publish')
  publishProduct(@Param('productId') productId: string, @Req() req: any) {
    return this.falabellaService.publishProduct(productId, req.user.vendorId);
  }

  @Post('webhook/register')
  registerWebhook(@Req() req: any) {
    return this.falabellaService.registerOrderWebhook(req.user.vendorId);
  }

  @Post('orders/sync')
  syncOrders(@Req() req: any) {
    return this.falabellaService.syncOrdersNow(req.user.vendorId);
  }

  @Get('orders/:orderId/label')
  async getOrderLabel(@Param('orderId') orderId: string, @Req() req: any, @Res() res: Response) {
    const label = await this.falabellaService.getOrderLabel(orderId, req.user.vendorId);
    res.setHeader('Content-Type', label.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="etiqueta-falabella-${orderId}.${label.mimeType.includes('pdf') ? 'pdf' : 'txt'}"`);
    res.send(label.buffer);
  }
}
