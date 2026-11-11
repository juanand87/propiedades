import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EstateGuard } from './estate.guard';
import { VideoSocialService } from './video-social.service';

@Injectable()
export class OptionalEstateGuard implements CanActivate {
  constructor(private guard: EstateGuard) {}
  canActivate(context: ExecutionContext) {
    return context.switchToHttp().getRequest().headers.authorization
      ? this.guard.canActivate(context)
      : true;
  }
}
@Controller()
export class VideoSocialController {
  constructor(private social: VideoSocialService) {}
  @Get('video-profiles/:id')
  @UseGuards(OptionalEstateGuard)
  profile(@Param('id') id: string, @Req() req: any) {
    return this.social.profile(id, req.user);
  }
  @Get('video-profiles/:id/videos')
  @UseGuards(OptionalEstateGuard)
  gallery(@Param('id') id: string, @Query() q: any, @Req() req: any) {
    return this.social.gallery(id, q, req.user);
  }
  @Post('me/video-profile')
  @UseGuards(EstateGuard)
  saveProfile(@Body() body: any, @Req() req: any) {
    return this.social.saveProfile(req.user, body);
  }
  @Get('video-profiles/:id/followers')
  followers(
    @Param('id') id: string,
    @Query('page') page: string,
    @Query('q') q: string,
  ) {
    return this.social.followers(id, page, 'followers', q);
  }
  @Get('video-profiles/:id/following')
  following(
    @Param('id') id: string,
    @Query('page') page: string,
    @Query('q') q: string,
  ) {
    return this.social.followers(id, page, 'following', q);
  }
  @Post('video-profiles/:id/follow')
  @UseGuards(EstateGuard)
  follow(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.social.follow(req.user, id, body.active);
  }
  @Get('videos/:id/social')
  @UseGuards(OptionalEstateGuard)
  details(@Param('id') id: string, @Req() req: any) {
    return this.social.details(id, req.user);
  }
  @Post('videos/:id/like')
  @UseGuards(EstateGuard)
  like(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.social.reaction(req.user, id, 'like', body.active);
  }
  @Post('videos/:id/save')
  @UseGuards(EstateGuard)
  save(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.social.reaction(req.user, id, 'save', body.active);
  }
  @Get('videos/:id/comments')
  @UseGuards(OptionalEstateGuard)
  comments(@Param('id') id: string, @Req() req: any) {
    return this.social.comments(id, req.user);
  }
  @Post('videos/:id/comments')
  @UseGuards(EstateGuard)
  comment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.social.comment(req.user, id, body, req.ip);
  }
  @Post('manage/videos/:id/property')
  @UseGuards(EstateGuard)
  link(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.social.link(req.user, id, body.property_id);
  }
  @Get('videos/:id/download')
  @UseGuards(EstateGuard)
  download(@Param('id') id: string, @Req() req: any) {
    return this.social.download(req.user, id);
  }
}
