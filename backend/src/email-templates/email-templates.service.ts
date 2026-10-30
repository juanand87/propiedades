import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate, EmailTemplateCategory } from './email-template.entity';
import { EmailService } from '../email/email.service';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { SmtpSettings } from '../marketplace/smtp-settings.entity';

@Injectable()
export class EmailTemplatesService {
  constructor(
    @InjectRepository(EmailTemplate)
    private readonly templateRepository: Repository<EmailTemplate>,
    @InjectRepository(SmtpSettings)
    private readonly smtpSettingsRepository: Repository<SmtpSettings>,
    private readonly emailService: EmailService,
  ) {}

  async findAll(category?: EmailTemplateCategory): Promise<EmailTemplate[]> {
    const query = this.templateRepository.createQueryBuilder('template');
    
    if (category) {
      query.where('template.category = :category', { category });
    }
    
    return query.orderBy('template.category', 'ASC').addOrderBy('template.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<EmailTemplate> {
    const template = await this.templateRepository.findOne({ where: { id } });
    
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }
    
    return template;
  }

  async findByKey(key: string): Promise<EmailTemplate> {
    const template = await this.templateRepository.findOne({ where: { key } });
    
    if (!template) {
      throw new NotFoundException(`Template with key ${key} not found`);
    }
    
    return template;
  }

  async update(id: string, updateDto: UpdateEmailTemplateDto): Promise<EmailTemplate> {
    const template = await this.findOne(id);
    
    console.log('[EmailTemplatesService] Updating template:', id);
    console.log('[EmailTemplatesService] Update data:', JSON.stringify(updateDto, null, 2));
    
    Object.assign(template, updateDto);
    
    const saved = await this.templateRepository.save(template);
    
    console.log('[EmailTemplatesService] Template saved:', saved.id);
    console.log('[EmailTemplatesService] Saved subject:', saved.subject);
    
    return saved;
  }

  async sendPreview(id: string, sampleData: Record<string, any>): Promise<string> {
    const template = await this.findOne(id);
    
    return this.renderTemplate(template.body, sampleData);
  }

  async sendTest(
    id: string,
    email: string,
    sampleData: Record<string, any>,
    smtpConfig: any,
  ): Promise<{ success: boolean; message: string; messageId?: string }> {
    const template = await this.findOne(id);
    
    const renderedBody = this.renderTemplate(template.body, sampleData);
    const renderedSubject = this.renderTemplate(template.subject, sampleData);
    
    try {
      const result = await this.emailService.sendEmail(
        smtpConfig,
        email,
        renderedSubject,
        renderedBody,
      );
      
      return {
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test email: ${error.message}`,
      };
    }
  }

  async restoreDefault(id: string): Promise<EmailTemplate> {
    // In a real implementation, you'd have a backup table or JSON with default templates
    // For now, we'll just throw an error since we don't have the original templates stored
    throw new Error('Restore default not implemented yet. This would restore the original template from a backup.');
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;
    
    // Debug: Log variables being replaced
    console.log('[EmailTemplatesService] Rendering template with data keys:', Object.keys(data));
    console.log('[EmailTemplatesService] Has orderItems:', !!data.orderItems);
    console.log('[EmailTemplatesService] Has shippingAddress:', !!data.shippingAddress);
    console.log('[EmailTemplatesService] Has storeName:', !!data.storeName);
    console.log('[EmailTemplatesService] Has year:', !!data.year);
    
    // Replace all {{variable}} placeholders with actual values
    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      const replacements = (rendered.match(regex) || []).length;
      if (replacements > 0) {
        console.log(`[EmailTemplatesService] Replacing {{${key}}} (${replacements} occurrences)`);
      }
      rendered = rendered.replace(regex, data[key] || '');
    });
    
    return rendered;
  }

  private repairVendorOrderEncoding(content: string): string {
    const replacements: Array<[RegExp, string]> = [
      [/\?{4}\s*(?=Nueva Orden)/gi, ''],
      [/N\?{2}mero/gi, 'Número'],
      [/Direcci\?{2}n/gi, 'Dirección'],
      [/Env\?{2}o/gi, 'Envío'],
      [/Tel\?{2}fono/gi, 'Teléfono'],
      [/Confirmaci\?{2}n/gi, 'Confirmación'],
      [/Informaci\?{2}n/gi, 'Información'],
      [/MÃºsica/g, 'Música'],
      [/NÃºmero/g, 'Número'],
      [/DirecciÃ³n/g, 'Dirección'],
      [/EnvÃ­o/g, 'Envío'],
      [/TelÃ©fono/g, 'Teléfono'],
      [/ConfirmaciÃ³n/g, 'Confirmación'],
      [/InformaciÃ³n/g, 'Información'],
    ];

    return replacements.reduce(
      (result, [pattern, replacement]) => result.replace(pattern, replacement),
      content,
    );
  }

  private normalizeThemeColor(value: unknown, fallback: string): string {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
      ? value
      : fallback;
  }

  private applyVendorOrderTheme(content: string, data: Record<string, any>): string {
    const primary = this.normalizeThemeColor(data.emailPrimaryColor, '#9333ea');
    const secondary = this.normalizeThemeColor(data.emailSecondaryColor, primary);
    const legacyRed = '#(?:dc2626|ef4444|e53935|d32f2f|e03131|f44336)';

    return content
      .replace(
        new RegExp(`linear-gradient\\([^)]*${legacyRed}[^)]*\\)`, 'gi'),
        `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
      )
      .replace(new RegExp(legacyRed, 'gi'), primary);
  }

  async sendEmail(
    templateKey: string,
    data: Record<string, any>,
    to: string,
    smtpConfig: any,
  ): Promise<{ success: boolean; message: string; messageId?: string }> {
    const template = await this.findByKey(templateKey);
    
    if (!template.isActive) {
      throw new Error(`Template ${templateKey} is not active`);
    }
    
    let renderedBody = this.renderTemplate(template.body, data);
    let renderedSubject = this.renderTemplate(template.subject, data);

    if (templateKey === 'vendor_new_order') {
      renderedBody = this.applyVendorOrderTheme(
        this.repairVendorOrderEncoding(renderedBody),
        data,
      );
      renderedSubject = this.repairVendorOrderEncoding(renderedSubject);
    }
    
    try {
      const result = await this.emailService.sendEmail(
        smtpConfig,
        to,
        renderedSubject,
        renderedBody,
      );
      
      return {
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send email: ${error.message}`,
      };
    }
  }

  async sendCustomerAccessCode(email: string, code: string): Promise<void> {
    const subject = 'Código para ver tus pedidos - Mundobeat';
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7c3aed;">Código de Acceso a tus Pedidos</h2>
        <p>Hola,</p>
        <p>Tu código de acceso para ver tus pedidos es:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px;">
          ${code}
        </div>
        <p style="color: #ef4444;"><strong>⏱️ Este código expira en 15 minutos</strong></p>
        <p>Ingresa este código en <a href="http://localhost:3000/mis-pedidos" style="color: #7c3aed;">http://localhost:3000/mis-pedidos</a></p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Si no solicitaste este código, puedes ignorar este mensaje.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} Mundobeat - Tu marketplace de música</p>
      </div>
    `;

    try {
      // Obtener configuración SMTP del marketplace (buscar el que tenga datos completos)
      const smtpSettingsList = await this.smtpSettingsRepository.find({
        order: { updatedAt: 'DESC' },
      });

      // Buscar el primer registro que tenga configuración completa
      const smtpSettings = smtpSettingsList.find(
        s => s.smtpHost && s.smtpUser && s.smtpPassword
      );

      if (!smtpSettings) {
        throw new Error('No SMTP configuration found in smtp_settings table. Please configure SMTP in marketplace settings.');
      }

      console.log('📧 Using marketplace SMTP config from smtp_settings table');
      const smtpConfig = {
        host: smtpSettings.smtpHost,
        port: smtpSettings.smtpPort || 587,
        secure: smtpSettings.smtpSecure || false,
        user: smtpSettings.smtpUser,
        password: smtpSettings.smtpPassword,
        fromEmail: smtpSettings.smtpFromEmail || smtpSettings.smtpUser,
        fromName: smtpSettings.smtpFromName || 'Mundobeat',
      };

      await this.emailService.sendEmail(smtpConfig, email, subject, body);
      console.log('✅ Customer access code email sent to:', email);
    } catch (error) {
      console.error('❌ Error sending customer access code email:', error);
      throw error;
    }
  }
}
