import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsSession } from './analytics-session.entity';
import { AnalyticsDailySummary } from './analytics-daily-summary.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Product } from '../products/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsSession, AnalyticsDailySummary, Product])],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
