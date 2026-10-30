import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplate } from './email-template.entity';
import { EmailModule } from '../email/email.module';
import { SmtpSettings } from '../marketplace/smtp-settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailTemplate, SmtpSettings]),
    EmailModule,
  ],
  controllers: [EmailTemplatesController],
  providers: [EmailTemplatesService],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
