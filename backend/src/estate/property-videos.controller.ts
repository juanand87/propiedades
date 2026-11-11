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
  @Post('manage/videos')
  @UseGuards(EstateGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadStandalone(
    @Req() req: any,
    @Body() body: any,
    @UploadedFile() file: any,
  ) {
    return this.videos.upload(req.user, null, body, file);
  }
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
  @Get('videos/:id/thumbnail') thumbnail(
    @Param('id') id: string,
    @Query('signature') signature: string,
    @Res() res: any,
  ) {
    return this.videos.thumbnail(id, signature, res);
  }
  @Get('manage/properties/:id/videos')
  @UseGuards(EstateGuard)
  list(@Req() req: any, @Param('id') id: string) {
    return this.videos.list(req.user, id);
  }
  @Get('manage/videos/:id/preview')
  @UseGuards(EstateGuard)
  preview(@Req() req: any, @Param('id') id: string, @Res() res: any) {
    res.set({
      'Cache-Control': 'private,no-store',
      'Referrer-Policy': 'no-referrer',
    });
    return this.videos
      .preview(req.user, id)
      .then((preview) => res.json(preview));
  }
  @Get('videos/:id/preview')
  previewContent(
    @Param('id') id: string,
    @Query('signature') signature: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    res.set({
      'Cache-Control': 'private,no-store',
      'Referrer-Policy': 'no-referrer',
    });
    return this.videos.previewContent(id, signature, req.headers.range, res);
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
