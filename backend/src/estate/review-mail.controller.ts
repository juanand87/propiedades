import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EstateGuard } from './estate.guard';
import { ReviewMailService } from './review-mail.service';
import { Actor } from './rules';

@Controller('admin/mail')
@UseGuards(EstateGuard)
export class ReviewMailController {
  constructor(private readonly mail: ReviewMailService) {}
  @Get() settings(@Req() req: { user: Actor }) {
    return this.mail.settings(req.user);
  }
  @Patch() save(@Req() req: { user: Actor }, @Body() body: unknown) {
    return this.mail.save(req.user, body);
  }
  @Post('test') test(@Req() req: { user: Actor }) {
    return this.mail.test(req.user);
  }
}
