import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaFile } from './media-file.entity';
import { MediaFolder } from './media-folder.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MediaFile, MediaFolder])],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
