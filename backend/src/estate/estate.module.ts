import { PropertyDictationService } from './property-dictation.service';
import { VideoUploadJobsService } from './video-upload-jobs.service';
import { VideoUploadJobsController } from './video-upload-jobs.controller';
import { ReviewMailService } from './review-mail.service';
import { PropertyVideoPublicationService } from './property-video-publication.service';
import { ReviewMailController } from './review-mail.controller';
import { PropertyDictationController } from './property-dictation.controller';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EstateController } from './estate.controller';
import { EstateService } from './estate.service';
import { EstateGuard, OptionalEstateGuard } from './estate.guard';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
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
    VideoUploadJobsController,
    ReviewMailController,
    PropertyDictationController,
    VisitsController,
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
    VideoUploadJobsService,
    PropertyVideoPublicationService,
    ReviewMailService,
    PropertyDictationService,
    VisitsService,
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
