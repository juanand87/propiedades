import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EstateGuard } from './estate.guard';
import { VideoUploadJobsService } from './video-upload-jobs.service';

@Controller('manage/video-uploads')
@UseGuards(EstateGuard)
export class VideoUploadJobsController {
  constructor(private jobs: VideoUploadJobsService) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 50 * 1024 * 1024 },
    }),
  )
  receive(@Req() req: any, @Body() body: any, @UploadedFile() file: any) {
    return this.jobs.receive(req.user, body, file);
  }
  @Get(':id') status(@Req() req: any, @Param('id') id: string) {
    return this.jobs.status(req.user, id);
  }
  @Post(':id/notify') notify(@Req() req: any, @Param('id') id: string) {
    return this.jobs.notify(req.user, id);
  }
  @Post(':id/retry') retry(@Req() req: any, @Param('id') id: string) {
    return this.jobs.retry(req.user, id);
  }
}
