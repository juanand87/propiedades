import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { EstateGuard } from './estate.guard';
import type { Actor } from './rules';
import { CommercialSummaryService } from './commercial-summary.service';
@Controller()
export class CommercialSummaryController {
  constructor(private summary: CommercialSummaryService) {}
  @Get('commercial-summary/capabilities') async capabilities() {
    return { enabled: await this.summary.available(), version: 1 };
  }
  @Get('me/commercial-summary') @UseGuards(EstateGuard) overview(
    @Req() r: { user: Actor },
  ) {
    return this.summary.summary(r.user);
  }
  @Get('me/commercial-summary/cases') @UseGuards(EstateGuard) cases(
    @Req() r: { user: Actor },
    @Query() q: { kind?: unknown; agentId?: unknown; page?: unknown },
  ) {
    return this.summary.cases(r.user, q);
  }
}
