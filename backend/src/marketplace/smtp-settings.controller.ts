import { Controller, Get, Patch, Post, Body, UseGuards, Query } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('admin/smtp-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SmtpSettingsController {
  constructor(private readonly smtpSettingsService: SmtpSettingsService) {}

  @Get()
  async getSettings() {
    return await this.smtpSettingsService.getSettings();
  }

  @Patch()
  async updateSettings(@Body() updateDto: UpdateSmtpSettingsDto) {
    console.log('Received SMTP settings update:', updateDto);
    const result = await this.smtpSettingsService.updateSettings(updateDto);
    console.log('Updated SMTP settings:', result);
    return result;
  }

  @Post('test-connection')
  async testConnection() {
    return await this.smtpSettingsService.testConnection();
  }

  @Post('send-test')
  async sendTestEmail(@Body('email') email: string) {
    if (!email) {
      return {
        success: false,
        message: 'Email is required',
      };
    }
    return await this.smtpSettingsService.sendTestEmail(email);
  }
}
