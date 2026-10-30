import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/user.entity';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('admin/preview')
  @Roles(UserRole.ADMIN)
  preview(@Query('period') period?: string) {
    return this.billingService.getAdminPreview(period);
  }

  @Post('admin/drafts')
  @Roles(UserRole.ADMIN)
  createDraft(
    @Body() body: { vendorId: string; period: string },
    @Request() req: any,
  ) {
    return this.billingService.createDraft(body.vendorId, body.period, req.user?.userId || req.user?.sub);
  }

  @Post('admin/invoices/:id/issue')
  @Roles(UserRole.ADMIN)
  issue(@Param('id') id: string) {
    return this.billingService.issue(id);
  }

  @Post('admin/invoices/:id/void')
  @Roles(UserRole.ADMIN)
  void(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.billingService.void(id, body.reason);
  }

  @Get('vendor/invoices')
  @Roles(UserRole.VENDOR)
  vendorInvoices(@Request() req: any) {
    return this.billingService.getVendorInvoices(req.user?.vendorId);
  }
}
