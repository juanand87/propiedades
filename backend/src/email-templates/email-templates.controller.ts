import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplate, EmailTemplateCategory } from './email-template.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';

@Controller('email-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class EmailTemplatesController {
  constructor(
    private readonly templatesService: EmailTemplatesService,
    @InjectRepository(EmailTemplate)
    private readonly templateRepository: Repository<EmailTemplate>,
  ) {}

  @Get()
  async findAll(@Query('category') category?: EmailTemplateCategory): Promise<EmailTemplate[]> {
    return this.templatesService.findAll(category);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<EmailTemplate> {
    return this.templatesService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    console.log('[EmailTemplatesController] Received PATCH request for:', id);
    console.log('[EmailTemplatesController] Body type:', typeof updateDto);
    console.log('[EmailTemplatesController] Body value:', JSON.stringify(updateDto, null, 2));
    console.log('[EmailTemplatesController] Body keys:', Object.keys(updateDto || {}));
    return this.templatesService.update(id, updateDto);
  }

  @Post(':id/preview')
  async preview(
    @Param('id') id: string,
    @Body() body: { sampleData: Record<string, any> },
  ): Promise<{ html: string }> {
    const html = await this.templatesService.sendPreview(id, body.sampleData);
    return { html };
  }

  @Post(':id/test')
  async sendTest(
    @Param('id') id: string,
    @Body() body: {
      email: string;
      sampleData: Record<string, any>;
      smtpConfig: any;
    },
  ): Promise<{ success: boolean; message: string; messageId?: string }> {
    return this.templatesService.sendTest(
      id,
      body.email,
      body.sampleData,
      body.smtpConfig,
    );
  }

  @Post(':id/restore')
  async restore(@Param('id') id: string): Promise<EmailTemplate> {
    return this.templatesService.restoreDefault(id);
  }

  @Post('fix-encoding')
  async fixEncoding() {
    const updates = [
      {
        key: 'order_confirmation_vendor',
        name: 'Confirmación de Pedido - Tienda',
        subject: 'Pedido Confirmado - {{orderNumber}}',
        description: 'Confirmación de pedidos de una tienda específica.',
      },
      {
        key: 'order_confirmation_admin',
        name: 'Confirmación de Pedido - Admin',
        subject: 'Nuevo Pedido Recibido - {{orderNumber}}',
        description: 'Notificación al administrador de nuevos pedidos.',
      },
      {
        key: 'order_shipped_customer',
        name: 'Pedido Enviado - Cliente',
        subject: 'Tu pedido ha sido enviado - {{orderNumber}}',
        description: 'Notificación al cliente cuando el pedido es enviado.',
      },
      {
        key: 'order_delivered_customer',
        name: 'Pedido Entregado - Cliente',
        subject: 'Tu pedido ha sido entregado - {{orderNumber}}',
        description: 'Notificación al cliente cuando el pedido es entregado.',
      },
      {
        key: 'new_vendor_registration',
        name: 'Nueva Solicitud de Vendedor',
        subject: 'Nueva solicitud de registro de vendedor',
        description: 'Notificación al admin de nuevas solicitudes de vendedores.',
      },
      {
        key: 'vendor_approval',
        name: 'Aprobación de Vendedor',
        subject: 'Tu solicitud de vendedor ha sido aprobada',
        description: 'Notificación al vendedor cuando su cuenta es aprobada.',
      },
      {
        key: 'vendor_rejection',
        name: 'Rechazo de Vendedor',
        subject: 'Actualización de tu solicitud de vendedor',
        description: 'Notificación al vendedor cuando su cuenta es rechazada.',
      },
      {
        key: 'password_reset',
        name: 'Restablecer Contraseña',
        subject: 'Restablece tu contraseña',
        description: 'Correo para restablecer contraseña.',
      },
      {
        key: 'welcome_email',
        name: 'Bienvenida',
        subject: 'Bienvenido a nuestro marketplace',
        description: 'Correo de bienvenida para nuevos usuarios.',
      },
    ];

    const results: Array<{
      key: string;
      status: string;
      subject?: string;
      error?: string;
    }> = [];

    for (const update of updates) {
      try {
        const template = await this.templateRepository.findOne({
          where: { key: update.key },
        });

        if (template) {
          template.name = update.name;
          template.subject = update.subject;
          template.description = update.description;

          await this.templateRepository.save(template);
          results.push({
            key: update.key,
            status: 'updated',
            subject: template.subject,
          });
        } else {
          results.push({
            key: update.key,
            status: 'not_found',
          });
        }
      } catch (error) {
        results.push({
          key: update.key,
          status: 'error',
          error: error.message,
        });
      }
    }

    return {
      message: 'Encoding fix completed',
      results,
    };
  }
}
