import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EstateController } from './estate.controller';
import { EstateService } from './estate.service';
import { EstateGuard, OptionalEstateGuard } from './estate.guard';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { PushService } from './push.service';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';
import { SavedSearchService } from './saved-search.service';
import {
  SavedSearchController,
  SavedSearchCapabilitiesController,
} from './saved-search.controller';
import { DemoService } from './demo.service';
import { PropertyVideosService } from './property-videos.service';
import { PropertyVideosController } from './property-videos.controller';
import { ImageStorageService } from './image-storage.service';
import { VideoStorageService } from './video-storage.service';
import { VideoHlsService } from './video-hls.service';
import { VideoHlsController } from './video-hls.controller';
import { ModerationService } from './moderation.service';
import {
  ModerationController,
  ModerationCapabilitiesController,
} from './moderation.controller';
import { VideoSocialService } from './video-social.service';
import { VideoSocialController } from './video-social.controller';
import {
  GoogleAuthController,
  GoogleAuthService,
} from './google-auth.controller';

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
  controllers: [
    ModerationController,
    ModerationCapabilitiesController,
    VideoHlsController,
    SavedSearchController,
    SavedSearchCapabilitiesController,
    ActivityController,
    EstateController,
    PropertyVideosController,
    GoogleAuthController,
    VideoSocialController,
    MessagingController,
  ],
  providers: [
    ModerationService,
    VideoHlsService,
    SavedSearchService,
    ActivityService,
    EstateService,
    GoogleAuthService,
    EstateGuard,
    MessagingService,
    PushService,
    DemoService,
    PropertyVideosService,
    ImageStorageService,
    VideoStorageService,
    VideoSocialService,
    OptionalEstateGuard,
  ],
})
export class EstateModule {}
