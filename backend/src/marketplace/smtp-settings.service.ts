import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmtpSettings } from './smtp-settings.entity';
import { EmailService, SmtpConfig } from '../email/email.service';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';

@Injectable()
export class SmtpSettingsService {
  constructor(
    @InjectRepository(SmtpSettings)
    private readonly smtpSettingsRepository: Repository<SmtpSettings>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Get marketplace SMTP settings (there should only be one record)
   */
  async getSettings(): Promise<SmtpSettings> {
    const settings = await this.smtpSettingsRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });

    if (!settings) {
      // Create default settings if none exist
      const newSettings = this.smtpSettingsRepository.create({});
      return await this.smtpSettingsRepository.save(newSettings);
    }

    return settings;
  }

  /**
   * Update marketplace SMTP settings
   */
  async updateSettings(updateDto: UpdateSmtpSettingsDto): Promise<SmtpSettings> {
    console.log('Service: Updating settings with DTO:', updateDto);
    const settings = await this.getSettings();
    console.log('Service: Current settings before update:', settings);

    Object.assign(settings, updateDto);
    console.log('Service: Settings after assign:', settings);

    const saved = await this.smtpSettingsRepository.save(settings);
    console.log('Service: Saved settings:', saved);
    
    return saved;
  }

  /**
   * Test SMTP connection with current settings
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const settings = await this.getSettings();

    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      return {
        success: false,
        message: 'La configuración SMTP está incompleta. Por favor, completa todos los campos requeridos.',
      };
    }

    const config: SmtpConfig = {
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure || false,
      user: settings.smtpUser,
      password: settings.smtpPassword,
      fromEmail: settings.smtpFromEmail || settings.smtpUser,
      fromName: settings.smtpFromName || 'MundoBeat Marketplace',
    };

    return await this.emailService.testSmtpConnection(config);
  }

  /**
   * Send test email using marketplace SMTP
   */
  async sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string }> {
    const settings = await this.getSettings();

    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      return {
        success: false,
        message: 'La configuración SMTP está incompleta.',
      };
    }

    const config: SmtpConfig = {
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure || false,
      user: settings.smtpUser,
      password: settings.smtpPassword,
      fromEmail: settings.smtpFromEmail || settings.smtpUser,
      fromName: settings.smtpFromName || 'MundoBeat Marketplace',
    };

    return await this.emailService.sendTestEmail(config, toEmail);
  }

  /**
   * Get SMTP config for sending emails
   */
  async getSmtpConfig(): Promise<SmtpConfig | null> {
    const settings = await this.getSettings();

    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      return null;
    }

    return {
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure || false,
      user: settings.smtpUser,
      password: settings.smtpPassword,
      fromEmail: settings.smtpFromEmail || settings.smtpUser,
      fromName: settings.smtpFromName || 'MundoBeat Marketplace',
    };
  }
}
