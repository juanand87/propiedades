import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EstateController } from './estate.controller';
import { EstateService } from './estate.service';
import { EstateGuard } from './estate.guard';
import { DemoService } from './demo.service';
import { PropertyVideosService } from './property-videos.service';
import { PropertyVideosController } from './property-videos.controller';
import { ImageStorageService } from './image-storage.service';
import { VideoStorageService } from './video-storage.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [EstateController, PropertyVideosController],
  providers: [
    EstateService,
    EstateGuard,
    DemoService,
    PropertyVideosService,
    ImageStorageService,
    VideoStorageService,
  ],
})
export class EstateModule {}
