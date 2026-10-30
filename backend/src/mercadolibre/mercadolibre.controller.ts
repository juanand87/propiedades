import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { MercadoLibreService } from './mercadolibre.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('mercadolibre')
export class MercadoLibreController {
  constructor(private readonly mercadoLibreService: MercadoLibreService) {}

  @Get('admin/configuration')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAppConfiguration() {
    return this.mercadoLibreService.getAppConfiguration();
  }

  @Put('admin/configuration')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  saveAppConfiguration(@Body() body: { clientId: string; clientSecret?: string; redirectUri: string }) {
    return this.mercadoLibreService.saveAppConfiguration(body);
  }

  @Get('connection')
  @UseGuards(JwtAuthGuard)
  getConnection(@Req() req: any) {
    return this.mercadoLibreService.getConnection(req.user.vendorId);
  }

  @Get('configuration')
  @UseGuards(JwtAuthGuard)
  getConfiguration(@Req() req: any) {
    return this.mercadoLibreService.getPublicationConfiguration(req.user.vendorId);
  }

  @Put('configuration')
  @UseGuards(JwtAuthGuard)
  saveConfiguration(@Body() body: any, @Req() req: any) {
    return this.mercadoLibreService.savePublicationConfiguration(req.user.vendorId, body);
  }

  @Get('default-music-category')
  @UseGuards(JwtAuthGuard)
  getDefaultMusicCategory(@Req() req: any) {
    return this.mercadoLibreService.getDefaultMusicCategory(req.user.vendorId);
  }

  @Post('authorize')
  @UseGuards(JwtAuthGuard)
  beginAuthorization(@Req() req: any) {
    return this.mercadoLibreService.beginAuthorization(req.user.vendorId);
  }

  @Post('account/disconnect')
  @UseGuards(JwtAuthGuard)
  disconnectAccount(@Req() req: any) {
    return this.mercadoLibreService.disconnectAccount(req.user.vendorId);
  }

  @Post('account/close-publications')
  @UseGuards(JwtAuthGuard)
  closeAccountPublications(@Req() req: any) {
    return this.mercadoLibreService.closeAccountPublications(req.user.vendorId);
  }

  @Get('account/publication-removal-status')
  @UseGuards(JwtAuthGuard)
  getAccountPublicationRemovalStatus(@Req() req: any) {
    return this.mercadoLibreService.getAccountPublicationRemovalStatus(req.user.vendorId);
  }

  @Get('callback')
  async completeAuthorization(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const redirectUrl = new URL('/dashboard/settings', frontendUrl);
    redirectUrl.searchParams.set('section', 'integraciones');
    redirectUrl.searchParams.set('subsection', 'mercadolibre');

    try {
      await this.mercadoLibreService.completeAuthorization(code, state);
      redirectUrl.searchParams.set('mlStatus', 'success');
    } catch (error: any) {
      redirectUrl.searchParams.set('mlStatus', 'error');
      redirectUrl.searchParams.set('mlMessage', this.getCallbackErrorMessage(error));
    }

    return res.redirect(HttpStatus.FOUND, redirectUrl.toString());
  }

  private getCallbackErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message?: string | string[] }).message;
        if (Array.isArray(message)) return message.join(' ');
        if (message) return message;
      }
    }
    return 'No pudimos conectar la cuenta de Mercado Libre. Inténtalo nuevamente o verifica que la cuenta no esté vinculada a otra tienda.';
  }

  @Post('notifications')
  @HttpCode(HttpStatus.OK)
  receiveNotification(@Body() payload: unknown) {
    return this.mercadoLibreService.acceptNotification(payload);
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  receiveWebhook(@Body() payload: unknown) {
    return this.mercadoLibreService.acceptNotification(payload);
  }

  @Get('questions/sync-status')
  @UseGuards(JwtAuthGuard)
  getQuestionSyncStatus(@Req() req: any) {
    return this.mercadoLibreService.getQuestionSyncStatus(req.user.vendorId);
  }

  @Post('questions/sync')
  @UseGuards(JwtAuthGuard)
  syncQuestions(@Req() req: any) {
    return this.mercadoLibreService.syncQuestions(req.user.vendorId, true);
  }

  @Get('products/:productId/category-suggestions')
  @UseGuards(JwtAuthGuard)
  getCategorySuggestions(@Param('productId') productId: string, @Req() req: any) {
    return this.mercadoLibreService.getCategorySuggestions(productId, req.user.vendorId);
  }

  @Get('categories/:categoryId/attributes')
  @UseGuards(JwtAuthGuard)
  getCategoryAttributes(@Param('categoryId') categoryId: string, @Req() req: any) {
    return this.mercadoLibreService.getCategoryAttributes(categoryId, req.user.vendorId);
  }

  @Post('products/:productId/publish')
  @UseGuards(JwtAuthGuard)
  publishProduct(@Param('productId') productId: string, @Query('categoryId') categoryId: string, @Req() req: any) {
    return this.mercadoLibreService.publishProduct(productId, req.user.vendorId, categoryId);
  }

  @Post('products/:productId/disconnect')
  @UseGuards(JwtAuthGuard)
  disconnectProduct(@Param('productId') productId: string, @Req() req: any) {
    return this.mercadoLibreService.disconnectPublishedProduct(productId, req.user.vendorId);
  }

  @Post('products/:productId/reconnect')
  @UseGuards(JwtAuthGuard)
  reconnectProduct(@Param('productId') productId: string, @Req() req: any) {
    return this.mercadoLibreService.reconnectPublishedProduct(productId, req.user.vendorId);
  }

  @Get('orders/:orderId/shipping')
  @UseGuards(JwtAuthGuard)
  getOrderShipping(@Param('orderId') orderId: string, @Req() req: any) {
    return this.mercadoLibreService.getOrderShipping(orderId, req.user.vendorId);
  }

  @Get('orders/:orderId/label')
  @UseGuards(JwtAuthGuard)
  async getOrderLabel(@Param('orderId') orderId: string, @Req() req: any, @Res() res: Response) {
    const pdf = await this.mercadoLibreService.getShippingLabel(orderId, req.user.vendorId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="etiqueta-mercadolibre-${orderId}.pdf"`);
    res.send(pdf);
  }

  @Post('orders/:orderId/cancel')
  @UseGuards(JwtAuthGuard)
  cancelOrder(@Param('orderId') orderId: string, @Body() body: { reason: string }, @Req() req: any) {
    return this.mercadoLibreService.cancelOrder(orderId, req.user.vendorId, body.reason);
  }
}
