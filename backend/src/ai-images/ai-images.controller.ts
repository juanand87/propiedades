import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards, ValidationPipe } from '@nestjs/common';
import { AiImagesService } from './ai-images.service';
import { GenerateAiImagesDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('ai-images')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiImagesController {
  constructor(private readonly aiImagesService: AiImagesService) {}

  @Get('access')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  getAccess(@Request() req) {
    return this.aiImagesService.getAccessStatus(req.user);
  }

  @Get('history')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  getHistory(@Request() req, @Query('limit') limit?: string) {
    return this.aiImagesService.findHistory(req.user, limit ? Number(limit) : 40);
  }

  @Post('generate')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  generate(@Request() req, @Body(new ValidationPipe({ transform: true })) dto: GenerateAiImagesDto) {
    return this.aiImagesService.generateImages(req.user, dto);
  }

  @Patch('vendors/:vendorId/access')
  @Roles(UserRole.ADMIN)
  setVendorAccess(
    @Param('vendorId') vendorId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.aiImagesService.setVendorAccess(vendorId, enabled);
  }
}