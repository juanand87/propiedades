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
import { Actor } from './rules';
import { VisitsService } from './visits.service';
import type { VisitInput } from './visits.service';
@Controller()
export class VisitsController {
  constructor(private visits: VisitsService) {}
  @Get('visits/capabilities') async capabilities() {
    return { enabled: await this.visits.available() };
  }
  @Get('me/visits') @UseGuards(EstateGuard) list(
    @Req() r: { user: Actor },
    @Query() q: { page?: string; conversation_id?: string },
  ) {
    return this.visits.list(r.user, q);
  }
  @Get('admin/visits') @UseGuards(EstateGuard) all(
    @Req() r: { user: Actor },
    @Query() q: { page?: string; conversation_id?: string },
  ) {
    return this.visits.list(r.user, q, true);
  }
  @Get('me/visits/:id') @UseGuards(EstateGuard) detail(
    @Req() r: { user: Actor },
    @Param('id') id: string,
  ) {
    return this.visits.get(r.user, id);
  }
  @Post('me/visits') @UseGuards(EstateGuard) create(
    @Req() r: { user: Actor },
    @Body() b: VisitInput,
  ) {
    return this.visits.create(r.user, b);
  }
  @Patch('me/visits/:id') @UseGuards(EstateGuard) act(
    @Req() r: { user: Actor },
    @Param('id') id: string,
    @Body()
    b: {
      action?: unknown;
      version?: unknown;
      date?: unknown;
      time?: unknown;
      note?: unknown;
    },
  ) {
    return this.visits.act(r.user, id, b);
  }
}
