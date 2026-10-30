import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Rastrear una sesión de usuario (endpoint público)
   * POST /api/analytics/track-session
   * Body:
   * {
   *   vendorId: string,
   *   sessionId: string,
   *   source?: 'google' | 'direct' | 'social' | 'referral' | 'other',
   *   referrer?: string,
   *   ipAddress?: string,
   *   userAgent?: string,
   *   region?: string,
   *   pagePath?: string,
   *   productId?: string,
   *   durationSeconds?: number
   * }
   */
  @Post('track-session')
  async trackSession(@Body() dto: any) {
    return this.analyticsService.trackSession(dto);
  }

  /**
   * Rastrear una conversión (carrito, compra)
   * POST /api/analytics/track-conversion
   * Body:
   * {
   *   sessionId: string,
   *   itemsAddedToCart?: number,
   *   purchaseCompleted?: boolean,
   *   purchaseValue?: number,
   *   orderId?: string
   * }
   */
  @Post('track-conversion')
  async trackConversion(@Body() dto: any) {
    return this.analyticsService.trackConversion(dto);
  }

  /**
   * Obtener estadísticas de tráfico para el vendor autenticado
   * GET /api/analytics/traffic-stats
   * Requiere autenticación
   */
  @Get('traffic-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async getTrafficStats(@Request() req, @Body('days') days?: number) {
    // Obtener vendorId del usuario autenticado
    // Esto requiere que el usuario tenga relación con un vendor
    const vendorId = req.user.vendorId || 'default-vendor'; // Temporal
    return this.analyticsService.getTrafficStats(vendorId, days || 7);
  }
}
