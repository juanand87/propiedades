import { Body, Controller, Get, Param, Post, Request, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { SubmitVendorReviewDto } from './dto/submit-vendor-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('mine/:id/recovery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  offerRecovery(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.reviewsService.offerRecovery(req.user.userId, id, data);
  }

  @Get('recovery/:token')
  recovery(@Param('token') token: string) { return this.reviewsService.getRecovery(token); }

  @Post('recovery/:token/accept')
  acceptRecovery(@Param('token') token: string, @Body() data: { acceptedTerms: boolean }) {
    return this.reviewsService.acceptRecovery(token, data.acceptedTerms);
  }

  @Get('public/:token')
  getPublic(@Param('token') token: string) {
    return this.reviewsService.getPublicReview(token);
  }

  @Post('public/:token')
  submit(
    @Param('token') token: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) body: SubmitVendorReviewDto,
  ) {
    return this.reviewsService.submit(token, body);
  }

  @Get('vendor/:vendorId/summary')
  getVendorSummary(@Param('vendorId') vendorId: string) {
    return this.reviewsService.getVendorSummary(vendorId);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  getMine(@Request() req: any) {
    return this.reviewsService.getMine(req.user.userId);
  }

  @Get('mine/order/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  getMineOrderReview(@Request() req: any, @Param('orderId') orderId: string) {
    return this.reviewsService.getMineOrderReview(req.user.userId, orderId);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAdminReviews() {
    return this.reviewsService.getAdminReviews();
  }

  @Get('admin/order/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAdminOrderReview(@Param('orderId') orderId: string) {
    return this.reviewsService.getAdminOrderReview(orderId);
  }

  @Post('admin/order/:orderId/send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  resendAdminOrderReview(@Param('orderId') orderId: string) {
    return this.reviewsService.resendAdminOrderReview(orderId);
  }
}
