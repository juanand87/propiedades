import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EstateGuard } from './estate.guard';
import { PropertyVideosService } from './property-videos.service';
@Controller()
export class PropertyVideosController {
  constructor(private videos: PropertyVideosService) {}
  @Get('mobile/environment') environment() {
    return this.videos.environment();
  }
  @Get('videos') feed(@Query() q: any) {
    return this.videos.feed(q);
  }
  @Get('videos/capabilities') capabilities() {
    return this.videos.capabilities();
  }
  @Get('videos/:id/content') content(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    return this.videos.content(id, req.headers.range, res);
  }
  @Get('manage/properties/:id/videos')
  @UseGuards(EstateGuard)
  list(@Req() req: any, @Param('id') id: string) {
    return this.videos.list(req.user, id);
  }
  @Post('manage/properties/:id/videos')
  @UseGuards(EstateGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 50 * 1024 * 1024 },
    }),
  )
  upload(
    @Req() req: any,
    @Param('id') id: string,
    @Body() b: any,
    @UploadedFile() f: any,
  ) {
    return this.videos.upload(req.user, id, b, f);
  }
  @Patch('manage/videos/:id')
  @UseGuards(EstateGuard)
  update(@Req() req: any, @Param('id') id: string, @Body() b: any) {
    return this.videos.update(req.user, id, b);
  }
}
