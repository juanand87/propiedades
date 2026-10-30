import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.customersService.getProfile(req.user.sub);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() updateData) {
    return this.customersService.updateProfile(req.user.sub, updateData);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async getOrders(@Request() req) {
    return this.customersService.getCustomerOrders(req.user.sub);
  }

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  async getOrderDetail(@Request() req, @Param('orderId') orderId: string) {
    return this.customersService.getOrderDetail(req.user.sub, orderId);
  }

  /**
   * Convierte un guest en cliente registrado después de una compra
   * POST /api/customers/convert-guest
   * Body: { orderNumber, email, password }
   */
  @Post('convert-guest')
  async convertGuestToCustomer(
    @Body() convertData: {
      orderNumber: string;
      email: string;
      password: string;
    },
  ) {
    const result = await this.customersService.convertGuestToCustomer(
      convertData.orderNumber,
      convertData.email,
      convertData.password,
    );

    return {
      success: true,
      message: `Cuenta creada exitosamente. ${result.ordersLinked} ${
        result.ordersLinked === 1 ? 'orden asociada' : 'órdenes asociadas'
      }.`,
      customerId: result.customer.id,
      email: result.customer.email,
      ordersLinked: result.ordersLinked,
    };
  }
}
