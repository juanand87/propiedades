import { Controller, Post, Get, Body, UseGuards, Request, ValidationPipe } from '@nestjs/common';
import { CustomerAccessService } from './customer-access.service';
import { RequestAccessDto, VerifyAccessDto } from './dto/customer-access.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('customers')
export class CustomerAccessController {
  constructor(private readonly customerAccessService: CustomerAccessService) {}

  @Post('request-access')
  async requestAccess(@Body(ValidationPipe) dto: RequestAccessDto) {
    return this.customerAccessService.requestAccess(dto.email);
  }

  @Post('verify-access')
  async verifyAccess(@Body(ValidationPipe) dto: VerifyAccessDto) {
    return this.customerAccessService.verifyAccess(dto.email, dto.token);
  }

  @Get('orders')
  @UseGuards(AuthGuard('jwt'))
  async getOrders(@Request() req) {
    const email = req.user.email;
    if (!email || req.user.type !== 'customer') {
      throw new Error('Invalid customer token');
    }
    return this.customerAccessService.getCustomerOrders(email);
  }
}
