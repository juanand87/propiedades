import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ParisService } from './paris.service';

@Controller('paris')
@UseGuards(JwtAuthGuard)
export class ParisController {
  constructor(private readonly parisService: ParisService) {}

  @Get('configuration')
  getConfiguration(@Req() req: any) {
    return this.parisService.getConfiguration(req.user.vendorId);
  }

  @Put('configuration')
  saveConfiguration(@Body() body: { apiKey?: string; config?: { familyId?: string; categoryId?: string } }, @Req() req: any) {
    return this.parisService.saveConfiguration(req.user.vendorId, body);
  }

  @Post('connection/test')
  testConnection(@Req() req: any) {
    return this.parisService.testConnection(req.user.vendorId);
  }

  @Get('families')
  getFamilies(@Req() req: any) {
    return this.parisService.getFamilies(req.user.vendorId);
  }

  @Get('price-types')
  getPriceTypes(@Req() req: any) {
    return this.parisService.getPriceTypes(req.user.vendorId);
  }

  @Get('families/:familyId/categories')
  getCategories(@Param('familyId') familyId: string, @Req() req: any) {
    return this.parisService.getCategories(req.user.vendorId, familyId);
  }

  @Get('families/:familyId/attributes')
  getAttributes(@Param('familyId') familyId: string, @Req() req: any) {
    return this.parisService.getAttributes(req.user.vendorId, familyId);
  }

  @Post('products/:productId/publish')
  publishProduct(@Param('productId') productId: string, @Req() req: any) {
    return this.parisService.publishProduct(productId, req.user.vendorId);
  }

  @Get('products/:productId/publication-link')
  getPublicationLink(@Param('productId') productId: string, @Req() req: any) {
    return this.parisService.getPublicationLink(productId, req.user.vendorId);
  }
}
