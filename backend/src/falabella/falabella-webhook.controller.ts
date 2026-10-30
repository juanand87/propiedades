import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { FalabellaService } from './falabella.service';

@Controller('falabella')
export class FalabellaWebhookController {
  constructor(private readonly falabellaService: FalabellaService) {}

  @Post('webhook/:vendorId/:secret')
  @HttpCode(200)
  receive(@Param('vendorId') vendorId: string, @Param('secret') secret: string, @Body() payload: unknown) {
    return this.falabellaService.processWebhook(vendorId, secret, payload);
  }
}
