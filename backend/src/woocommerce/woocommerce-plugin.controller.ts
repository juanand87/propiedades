import { Body, Controller, Headers, Post } from '@nestjs/common';
import { WoocommerceService } from './woocommerce.service';
import { WooCommercePluginConnectDto } from './dto/plugin-connect.dto';

@Controller('woocommerce/plugin')
export class WoocommercePluginController {
  constructor(private readonly woocommerceService: WoocommerceService) {}

  @Post('connect')
  async connect(@Body() dto: WooCommercePluginConnectDto) {
    return this.woocommerceService.connectPlugin(dto);
  }

  @Post('shipping-rates')
  async shippingRates(
    @Headers('x-mundobeat-secret') secret: string,
    @Body() body: { vendorId: string; city: string; postcode?: string; items: Array<{ productId?: string; wooProductId?: string; quantity: number }>; declaredValue: number },
  ) {
    return this.woocommerceService.getPluginShippingRates(secret, body);
  }

  @Post('locations')
  async locations(
    @Headers('x-mundobeat-secret') secret: string,
    @Body() body: { vendorId: string },
  ) {
    return this.woocommerceService.getPluginLocations(secret, body.vendorId);
  }

  @Post('order-sync')
  async orderSync(
    @Headers('x-mundobeat-secret') secret: string,
    @Body() body: { vendorId: string; order: any },
  ) {
    return this.woocommerceService.syncPluginOrder(secret, body.vendorId, body.order);
  }
}
