import { Controller, Post, Param, Body, Headers, Req, HttpCode } from '@nestjs/common';
import { WoocommerceService } from './woocommerce.service';

@Controller('woocommerce')
export class WoocommerceWebhookController {
  constructor(private readonly woocommerceService: WoocommerceService) {}

  @Post('webhook/:vendorId')
  @HttpCode(200)
  async handleWebhook(
    @Param('vendorId') vendorId: string,
    @Headers('x-wc-webhook-signature') signature: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Body() payload: any,
    @Req() req: any,
  ) {
    console.log(`📦 [WC Webhook] Received topic="${topic}" for vendor=${vendorId}`);

    await this.woocommerceService.handleWebhook(vendorId, payload, {
      signature,
      topic,
      rawBody: req.rawBody,
    });

    return { success: true };
  }
}
