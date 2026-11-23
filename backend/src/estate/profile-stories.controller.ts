import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EstateGuard } from './estate.guard';
import { ProfileStoriesService } from './profile-stories.service';
import type { Actor } from './rules';
@Controller()
@UseGuards(EstateGuard)
export class ProfileStoriesController {
  constructor(private stories: ProfileStoriesService) {}
  @Get('video-profiles/:id/stories') list(
    @Param('id') id: string,
    @Req() r: { user: Actor },
  ) {
    return this.stories.list(id, r.user);
  }
  @Post('me/stories') create(
    @Body() body: { media_id?: unknown; video_id?: unknown },
    @Req() r: { user: Actor },
  ) {
    return this.stories.create(r.user, body);
  }
  @Delete('me/stories/:id') remove(
    @Param('id') id: string,
    @Req() r: { user: Actor },
  ) {
    return this.stories.remove(r.user, id);
  }
}
