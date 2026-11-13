import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { VideoHlsService } from './video-hls.service';
@Controller('videos/:id/hls')
export class VideoHlsController {
  constructor(private hls: VideoHlsService) {}
  @Get('master.m3u8') master(
    @Param('id') id: string,
    @Query('v') version: string | undefined,
    @Query('signature') signature: string | undefined,
    @Res() res: Response,
  ) {
    return this.hls.serve(
      id,
      undefined,
      'master.m3u8',
      version,
      signature,
      res,
    );
  }
  @Get(':quality/:file') asset(
    @Param('id') id: string,
    @Param('quality') quality: string,
    @Param('file') file: string,
    @Query('v') version: string | undefined,
    @Query('signature') signature: string | undefined,
    @Res() res: Response,
  ) {
    return this.hls.serve(id, quality, file, version, signature, res);
  }
}
