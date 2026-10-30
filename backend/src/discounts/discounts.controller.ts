import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { DiscountsService } from './discounts.service';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly service: DiscountsService) {}
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  list() {
    return this.service.list();
  }
  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() data: any) {
    return this.service.create(data);
  }
  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  status(@Param('id') id: string, @Body() data: { status: string }) {
    return this.service.setStatus(id, data.status);
  }
  @Post('validate')
  validate(@Body() data: any) {
    return this.service.quote(data);
  }
}
