import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EstateGuard } from './estate.guard';
import type { Actor } from './rules';
import { InquiryTasksService } from './inquiry-tasks.service';
@Controller()
export class InquiryTasksController {
  constructor(private tasks: InquiryTasksService) {}
  @Get('inquiry-tasks/capabilities') async capabilities() {
    return { enabled: await this.tasks.available(), version: 1 };
  }
  @Get('me/lead-tasks') @UseGuards(EstateGuard) list(
    @Req() r: { user: Actor },
    @Query() q: { inquiryId?: unknown; status?: unknown; due?: unknown },
  ) {
    return this.tasks.list(r.user, q);
  }
  @Post('me/leads/:id/tasks') @UseGuards(EstateGuard) create(
    @Req() r: { user: Actor },
    @Param('id') id: string,
    @Body()
    b: {
      id?: unknown;
      kind?: unknown;
      note?: unknown;
      date?: unknown;
      time?: unknown;
    },
  ) {
    return this.tasks.create(r.user, id, b);
  }
  @Patch('me/lead-tasks/:id') @UseGuards(EstateGuard) update(
    @Req() r: { user: Actor },
    @Param('id') id: string,
    @Body()
    b: {
      revision?: unknown;
      action?: unknown;
      kind?: unknown;
      note?: unknown;
      date?: unknown;
      time?: unknown;
    },
  ) {
    return this.tasks.update(r.user, id, b);
  }
  @Get('me/lead-tasks/:id/history') @UseGuards(EstateGuard) history(
    @Req() r: { user: Actor },
    @Param('id') id: string,
  ) {
    return this.tasks.history(r.user, id);
  }
}
