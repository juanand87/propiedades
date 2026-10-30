import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { QuestionsService } from './questions.service';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get('product/:productId')
  getProductQuestions(@Param('productId') productId: string) {
    return this.questionsService.getProductQuestions(productId);
  }

  @Post('product/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  createQuestion(@Request() req, @Param('productId') productId: string, @Body('message') message: string) {
    return this.questionsService.createQuestion(req.user, productId, message);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  getMine(@Request() req) {
    return this.questionsService.getCustomerQuestions(req.user.userId);
  }

  @Get('vendor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  getVendorQuestions(@Request() req, @Query('status') status?: string) {
    return this.questionsService.getVendorQuestions(req.user.vendorId, status);
  }

  @Post(':questionId/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR)
  reply(@Request() req, @Param('questionId') questionId: string, @Body('message') message: string) {
    return this.questionsService.reply(req.user, questionId, message);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAll(@Query('search') search?: string, @Query('status') status?: string) {
    return this.questionsService.getAllQuestions(search, status);
  }

  @Patch('admin/messages/:messageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  moderate(
    @Request() req,
    @Param('messageId') messageId: string,
    @Body() body: { action: 'review' | 'penalize' | 'annul'; reason?: string; annulQuestion?: boolean },
  ) {
    return this.questionsService.moderateMessage(req.user.userId, messageId, body.action, body.reason, body.annulQuestion);
  }
}
