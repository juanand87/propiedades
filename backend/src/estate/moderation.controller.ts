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
import { ModerationService } from './moderation.service';
@Controller()
@UseGuards(EstateGuard)
export class ModerationController {
  constructor(private moderation: ModerationService) {}
  @Get('me/blocks') blocks(@Req() req: { user: Actor }) {
    return this.moderation.blocks(req.user);
  }
  @Post('me/blocks/:id') block(
    @Req() req: { user: Actor },
    @Param('id') id: string,
    @Body() body: { active?: unknown },
  ) {
    return this.moderation.block(req.user, id, body.active);
  }
  @Post('reports') report(
    @Req() req: { user: Actor },
    @Body()
    body: {
      kind?: unknown;
      target_id?: unknown;
      reason?: unknown;
      details?: unknown;
    },
  ) {
    return this.moderation.report(req.user, body);
  }
  @Get('admin/moderation/reports') list(
    @Req() req: { user: Actor },
    @Query() q: { status?: string; page?: string },
  ) {
    return this.moderation.list(req.user, q);
  }
  @Get('admin/moderation/reports/:id') detail(
    @Req() req: { user: Actor },
    @Param('id') id: string,
  ) {
    return this.moderation.detail(req.user, id);
  }
  @Patch('admin/moderation/reports/:id') review(
    @Req() req: { user: Actor },
    @Param('id') id: string,
    @Body() body: { action?: unknown; note?: unknown },
  ) {
    return this.moderation.review(req.user, id, body);
  }
  @Post('admin/moderation/restore/:kind/:id') restore(
    @Req() req: { user: Actor },
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: { note?: unknown },
  ) {
    return this.moderation.restore(req.user, kind, id, body.note);
  }
}
@Controller('moderation')
export class ModerationCapabilitiesController {
  constructor(private moderation: ModerationService) {}
  @Get('capabilities') capabilities() {
    return this.moderation.capabilities();
  }
}
