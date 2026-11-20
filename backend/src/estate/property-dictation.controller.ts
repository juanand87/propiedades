import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EstateGuard } from './estate.guard';
import { PropertyDictationService } from './property-dictation.service';
@Controller('manage/property-dictation')
@UseGuards(EstateGuard)
export class PropertyDictationController {
  constructor(private dictation: PropertyDictationService) {}
  @Get('capabilities') capabilities() {
    return this.dictation.capabilities();
  }
  @Get('videos') videos(@Req() req: any, @Query('page') page: string) {
    return this.dictation.videoChoices(req.user, Number(page));
  }
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 12 * 1024 * 1024,
        fields: 2,
        fieldSize: 15000,
      },
    }),
  )
  propose(@Req() req: any, @Body() body: any, @UploadedFile() file: any) {
    return this.dictation.propose(req.user, body, file);
  }
}
