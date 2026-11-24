import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EstateGuard } from './estate.guard';
import { InquiryWorkflowService } from './inquiry-workflow.service';
import type { Actor } from './rules';
@Controller()
export class InquiryWorkflowController {
  constructor(private leads: InquiryWorkflowService) {}
  @Get('inquiry-workflow/capabilities') async capabilities() {
    return { enabled: await this.leads.available(), version: 1 };
  }
  @Get('me/leads') @UseGuards(EstateGuard) list(@Req() r: { user: Actor }) {
    return this.leads.list(r.user);
  }
  @Patch('me/leads/:id') @UseGuards(EstateGuard) update(
    @Req() r: { user: Actor },
    @Param('id') id: string,
    @Body() body: { stage?: unknown; revision?: unknown },
  ) {
    return this.leads.update(r.user, id, body);
  }
  @Post('me/leads/:id/assignment') @UseGuards(EstateGuard) assign(
    @Req() r: { user: Actor },
    @Param('id') id: string,
    @Body() body: { user_id?: unknown },
  ) {
    return this.leads.assign(r.user, id, body.user_id);
  }
  @Get('me/leads/:id/history') @UseGuards(EstateGuard) history(
    @Req() r: { user: Actor },
    @Param('id') id: string,
  ) {
    return this.leads.history(r.user, id);
  }
  @Post('me/leads/:id/notes') @UseGuards(EstateGuard) note(
    @Req() r: { user: Actor },
    @Param('id') id: string,
    @Body() body: { message?: unknown },
  ) {
    return this.leads.note(r.user, id, body.message);
  }
}
