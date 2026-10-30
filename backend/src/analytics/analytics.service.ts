import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between, In } from 'typeorm';
import { AnalyticsSession } from './analytics-session.entity';
import { AnalyticsDailySummary } from './analytics-daily-summary.entity';
import { Product } from '../products/product.entity';

export interface TrackSessionDto {
  vendorId: string;
  sessionId: string;
  userId?: string;
  email?: string;
  source?: string; // 'google', 'direct', 'social', 'referral', 'other'
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
  ipAddress?: string;
  userAgent?: string;
  region?: string;
  pagePath?: string;
  productId?: string;
  durationSeconds?: number;
}

export interface TrackConversionDto {
  sessionId: string;
  vendorId?: string;
  productId?: string;
  pagePath?: string;
  itemsAddedToCart?: number;
  purchaseCompleted?: boolean;
  purchaseValue?: number;
  orderId?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsSession)
    private analyticsSessionRepository: Repository<AnalyticsSession>,
    @InjectRepository(AnalyticsDailySummary)
    private dailySummaryRepository: Repository<AnalyticsDailySummary>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * Rastrear una sesión de usuario
   */
  async trackSession(dto: TrackSessionDto): Promise<AnalyticsSession> {
    // Parsear User-Agent de forma simple
    const deviceType = this.detectDeviceType(dto.userAgent);
    const browser = this.detectBrowser(dto.userAgent);

    // Determinar el origen del tráfico
    const source = this.detectTrafficSource(dto.referrer, dto.source);

    // Extraer región del IP o usar la proporcionada
    const region = dto.region || this.extractRegionFromCountry(dto.ipAddress);

    const session = this.analyticsSessionRepository.create({
      vendorId: dto.vendorId,
      sessionId: dto.sessionId,
      userId: dto.userId,
      email: dto.email,
      source,
      utmSource: dto.utmSource,
      utmMedium: dto.utmMedium,
      utmCampaign: dto.utmCampaign,
      referrer: dto.referrer,
      ipAddress: dto.ipAddress,
      region,
      deviceType,
      browser,
      userAgent: dto.userAgent,
      pagePath: dto.pagePath,
      productId: dto.productId,
      durationSeconds: dto.durationSeconds || 0,
      isNewUser: true, // Por ahora, siempre es nuevo. En futuro verificar con userId
    });

    return this.analyticsSessionRepository.save(session);
  }

  /**
   * Actualizar conversión de una sesión
   */
  async trackConversion(dto: TrackConversionDto): Promise<AnalyticsSession> {
    let session = await this.analyticsSessionRepository.findOneBy(
      dto.vendorId ? { sessionId: dto.sessionId, vendorId: dto.vendorId } : { sessionId: dto.sessionId },
    );

    if (!session) {
      if (!dto.vendorId) {
        throw new Error(`Session not found: ${dto.sessionId}`);
      }

      session = this.analyticsSessionRepository.create({
        vendorId: dto.vendorId,
        sessionId: dto.sessionId,
        pagePath: dto.pagePath,
        productId: dto.productId,
        source: 'direct',
        isNewUser: true,
      });
    }

    session.itemsAddedToCart =
      (session.itemsAddedToCart || 0) + (dto.itemsAddedToCart || 0);
    session.purchaseCompleted = dto.purchaseCompleted || false;
    if (dto.purchaseValue !== undefined) {
      session.purchaseValue = dto.purchaseValue;
    }
    if (dto.orderId !== undefined) {
      session.orderId = dto.orderId;
    }

    return this.analyticsSessionRepository.save(session);
  }

  /**
   * Obtener estadisticas de trafico para un vendor en un rango de fechas.
   */
  async getTrafficStats(
    vendorId: string,
    days: number = 7,
    startDate?: string,
    endDate?: string,
  ) {
    const { fromDate, toDate, rangeDays } = this.resolveDateRange(days, startDate, endDate);
    const createdAt = toDate
      ? Between(fromDate, toDate)
      : MoreThanOrEqual(fromDate);

    const sessions = await this.analyticsSessionRepository.find({
      where: {
        vendorId,
        createdAt,
      },
    });

    // Calcular estadísticas
    const totalVisits = sessions.length;
    const newUsers = sessions.filter((s) => s.isNewUser).length;
    const returningUsers = totalVisits - newUsers;

    const bounceCount = sessions.filter((s) => s.bounceEvent).length;
    const bounceRate = totalVisits > 0 ? (bounceCount / totalVisits) * 100 : 0;

    const totalDuration = sessions.reduce(
      (sum, s) => sum + (s.durationSeconds || 0),
      0,
    );
    const avgTimeOnSite = totalVisits > 0 ? totalDuration / totalVisits : 0;

    // Agrupar por origen
    const trafficBySource = this.groupBy(sessions, 'source');
    const trafficSources = this.calculatePercentages(trafficBySource, totalVisits);

    // Agrupar por región
    const byRegion = this.groupBy(sessions, 'region');
    const visitsByRegion = this.calculatePercentages(byRegion, totalVisits).map(
      (r) => ({ region: r.name, visits: r.visits, percentage: r.percentage }),
    );

    // Agrupar por dispositivo
    const byDevice = this.groupBy(sessions, 'deviceType');
    const devices = this.calculatePercentages(byDevice, totalVisits).map((d) => ({
      type: d.name,
      visits: d.visits,
      percentage: d.percentage,
    }));

    // Agrupar por navegador
    const byBrowser = this.groupBy(sessions, 'browser');
    const topBrowsers = this.getTopN(byBrowser, 5);
    const browsers = this.calculatePercentages(topBrowsers, totalVisits);

    // Sesiones diarias segun el rango seleccionado
    const dailySessions = this.getDailyBreakdown(sessions, fromDate, toDate, rangeDays);

    // Páginas más visitadas (productos)
    const byProduct = this.groupBy(
      sessions.filter((s) => s.productId),
      'productId',
    );
    const productIds = Object.keys(byProduct);
    const products = productIds.length
      ? await this.productRepository.find({
          where: { id: In(productIds) },
          select: ['id', 'title'],
        })
      : [];
    const productTitleById = new Map(
      products.map((product) => [product.id, product.title]),
    );
    const topPages = Object.entries(byProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([productId, count]) => ({
        page: `/productos/${productId}`,
        productId,
        productTitle: productTitleById.get(productId) || `Producto ${productId}`,
        url: `/productos/${productId}`,
        visits: count,
      }));

    // Datos de conversión
    const purchases = sessions.filter((s) => s.purchaseCompleted).length;
    const revenue = sessions.reduce(
      (sum, s) => sum + (s.purchaseValue || 0),
      0,
    );
    const conversionRate =
      totalVisits > 0 ? (purchases / totalVisits) * 100 : 0;

    return {
      totalVisits,
      avgTimeOnSite: Math.round(avgTimeOnSite),
      bounceRate: Math.round(bounceRate * 10) / 10,
      trafficBySource,
      visitsByRegion,
      devices,
      browsers,
      newVsReturning: [
        {
          type: 'new',
          visits: newUsers,
          percentage: totalVisits > 0 ? (newUsers / totalVisits) * 100 : 0,
        },
        {
          type: 'returning',
          visits: returningUsers,
          percentage: totalVisits > 0 ? (returningUsers / totalVisits) * 100 : 0,
        },
      ],
      dailySessions,
      topPages,
      conversionRate: Math.round(conversionRate * 10) / 10,
      totalPurchases: purchases,
      totalRevenue: revenue,
    };
  }

  // ========== Métodos auxiliares ==========

  private detectTrafficSource(referrer?: string, source?: string): string {
    if (source) return source;

    if (!referrer) return 'direct';

    const url = new URL(referrer);
    const hostname = url.hostname.toLowerCase();

    if (
      hostname.includes('google.com') ||
      hostname.includes('google.')
    ) {
      return 'google';
    } else if (
      hostname.includes('facebook.com') ||
      hostname.includes('instagram.com') ||
      hostname.includes('twitter.com') ||
      hostname.includes('tiktok.com') ||
      hostname.includes('linkedin.com')
    ) {
      return 'social';
    } else if (hostname.includes('reddit.com')) {
      return 'referral';
    }

    return 'other';
  }

  private normalizeDeviceType(type?: string): string {
    if (type === 'mobile') return 'mobile';
    if (type === 'tablet') return 'tablet';
    return 'desktop';
  }

  private detectDeviceType(userAgent?: string): string {
    if (!userAgent) return 'desktop';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android')) return 'mobile';
    if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
    return 'desktop';
  }

  private detectBrowser(userAgent?: string): string {
    if (!userAgent) return 'Unknown';

    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    return 'Other';
  }

  private extractRegionFromCountry(ip?: string): string {
    // En producción, usar MaxMind GeoIP o similar
    // Por ahora, retornar generic
    if (!ip) return 'Unknown';
    if (ip.startsWith('192.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return 'Extranjero'; // Local
    }
    return 'Santiago'; // Default para Chile
  }

  private groupBy(
    items: AnalyticsSession[],
    key: keyof AnalyticsSession,
  ): Record<string, number> {
    return items.reduce(
      (acc, item) => {
        const val = String(item[key] || 'Unknown');
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private calculatePercentages(
    grouped: Record<string, number>,
    total: number,
  ): Array<{ name: string; visits: number; percentage: number }> {
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([name, visits]) => ({
        name,
        visits,
        percentage: total > 0 ? Math.round((visits / total) * 1000) / 10 : 0,
      }));
  }

  private getTopN(
    grouped: Record<string, number>,
    n: number,
  ): Record<string, number> {
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .reduce(
        (acc, [key, val]) => {
          acc[key] = val;
          return acc;
        },
        {} as Record<string, number>,
      );
  }

  private resolveDateRange(days: number, startDate?: string, endDate?: string) {
    if (startDate || endDate) {
      const fromDate = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
      const toDate = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date();
      const diffMs = Math.max(toDate.getTime() - fromDate.getTime(), 0);
      const rangeDays = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1, 1);

      return { fromDate, toDate, rangeDays };
    }

    const normalizedDays = Math.max(Number(days) || 7, 1);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - normalizedDays + 1);
    fromDate.setHours(0, 0, 0, 0);

    return { fromDate, toDate: undefined as Date | undefined, rangeDays: normalizedDays };
  }

  private getDailyBreakdown(
    sessions: AnalyticsSession[],
    fromDate: Date,
    toDate: Date | undefined,
    rangeDays: number,
  ) {
    const daily = {} as Record<string, number>;
    const cursor = new Date(fromDate);
    cursor.setHours(0, 0, 0, 0);
    const end = toDate ? new Date(toDate) : new Date();
    end.setHours(0, 0, 0, 0);

    for (let i = 0; i < rangeDays && cursor <= end; i++) {
      const dateStr = cursor.toISOString().split('T')[0];
      daily[dateStr] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }

    sessions.forEach((session) => {
      const dateStr = session.createdAt.toISOString().split('T')[0];
      if (dateStr in daily) {
        daily[dateStr]++;
      }
    });

    return Object.entries(daily).map(([date, sessions]) => ({
      date,
      sessions,
    }));
  }
}
