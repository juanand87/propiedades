import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export type EmailAttachment = { filename: string; content: Buffer; contentType: string; cid?: string };

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

@Injectable()
export class EmailService {
  /**
   * Test SMTP connection with provided configuration
   */
  async testSmtpConnection(config: SmtpConfig): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[EmailService] Testing SMTP connection...', {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
      });

      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure, // true for 465, false for other ports
        auth: {
          user: config.user,
          pass: config.password,
        },
      });

      // Verify connection configuration
      await transporter.verify();

      console.log('[EmailService] ✅ SMTP connection successful');
      return {
        success: true,
        message: 'Conexión SMTP exitosa. El servidor está listo para enviar correos.',
      };
    } catch (error) {
      console.error('[EmailService] ❌ SMTP connection failed:', error.message);
      return {
        success: false,
        message: `Error de conexión SMTP: ${error.message}`,
      };
    }
  }

  /**
   * Create a transporter with vendor's SMTP configuration
   */
  createTransporter(config: SmtpConfig): Transporter {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  /**
   * Send a test email
   */
  async sendTestEmail(config: SmtpConfig, toEmail: string): Promise<{ success: boolean; message: string }> {
    try {
      const transporter = this.createTransporter(config);

      const info = await transporter.sendMail({
        from: { name: config.fromName, address: config.fromEmail },
        to: toEmail,
        subject: 'Test de Conexión SMTP - MundoBeat',
        text: 'Este es un correo de prueba para verificar la configuración SMTP.',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">✅ Conexión SMTP Exitosa</h2>
            <p>Este es un correo de prueba para verificar que tu configuración SMTP está funcionando correctamente.</p>
            <p>Si recibes este mensaje, significa que tu tienda puede enviar correos electrónicos sin problemas.</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 12px;">
              Este mensaje fue enviado desde tu panel de administración de MundoBeat.
            </p>
          </div>
        `,
      });

      console.log('[EmailService] ✅ Test email sent:', info.messageId);
      return {
        success: true,
        message: `Correo de prueba enviado exitosamente a ${toEmail}`,
      };
    } catch (error) {
      console.error('[EmailService] ❌ Failed to send test email:', error.message);
      return {
        success: false,
        message: `Error al enviar correo: ${error.message}`,
      };
    }
  }

  /**
   * Send a generic email with subject and body
   */
  async sendEmail(
    config: SmtpConfig,
    to: string,
    subject: string,
    htmlBody: string,
    attachments?: EmailAttachment[],
  ): Promise<{ success: boolean; message: string; messageId?: string }> {
    try {
      const transporter = this.createTransporter(config);

      const info = await transporter.sendMail({
        from: { name: config.fromName, address: config.fromEmail },
        to: to,
        subject: subject,
        html: htmlBody,
        attachments,
      });

      console.log('[EmailService] ✅ Email sent:', info.messageId);
      return {
        success: true,
        message: 'Email sent successfully',
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('[EmailService] ❌ Failed to send email:', error.message);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}
