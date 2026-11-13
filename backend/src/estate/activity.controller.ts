import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EstateGuard } from './estate.guard';
import { Actor } from './rules';
import { ActivityService } from './activity.service';

@Controller('me/activity')
@UseGuards(EstateGuard)
export class ActivityController {
  constructor(private activity: ActivityService) {}
  @Get()
  list(
    @Req() req: { user: Actor },
    @Query() query: { before?: string; unread?: string; limit?: string },
  ) {
    return this.activity.list(req.user, query);
  }
  @Post('read-all')
  all(@Req() req: { user: Actor }, @Body() body: { through_id?: string }) {
    return this.activity.markAllRead(req.user, body.through_id);
  }
  @Post(':id/read')
  read(@Req() req: { user: Actor }, @Param('id') id: string) {
    return this.activity.markRead(req.user, id);
  }
  @Post('comments/:id/read')
  comment(@Req() req: { user: Actor }, @Param('id') id: string) {
    return this.activity.markCommentRead(req.user, id);
  }
}
