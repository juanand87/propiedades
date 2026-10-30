import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAbandonedCartReminderTemplate1733146400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO email_templates (
        id,
        name,
        category,
        \`key\`,
        subject,
        body,
        description,
        variables,
        isActive,
        createdAt,
        updatedAt
      )
      SELECT
        UUID(),
        'Recordatorio carrito abandonado',
        'orders_vendor',
        'abandoned_cart_reminder',
        'Aun estas a tiempo de completar tu compra en {{storeName}}',
        '<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 16px; color: #111827;"><h2 style="margin: 0 0 12px;">Tu carrito sigue guardado</h2><p style="margin: 0 0 12px;">Hola {{customerName}}, tu seleccion sigue guardada en {{storeName}}.</p><p style="margin: 0 0 8px;">Tus productos favoritos aun estan en el carrito, listos para que finalices tu compra en pocos pasos.</p><p style="margin: 0 0 8px;"><strong>Pedido:</strong> #{{orderNumber}}</p><p style="margin: 0 0 8px;"><strong>Total estimado:</strong> {{orderTotal}}</p><p style="margin: 0 0 8px;"><strong>Productos:</strong></p><ul style="margin: 0 0 16px 18px; padding: 0;">{{orderItems}}</ul><p style="margin: 0 0 14px;">Date prisa: algunos titulos tienen stock limitado y podrian agotarse.</p><a href="{{resumeUrl}}" style="display: inline-block; background: #111827; color: #ffffff; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: 600;">Finalizar compra</a><p style="margin-top: 16px; color: #6b7280; font-size: 13px;">Si ya completaste el pago, puedes ignorar este mensaje.</p></div>',
        'Recordatorio automatico de carrito abandonado para pedidos pendientes.',
        '["customerName","storeName","marketplaceName","orderNumber","orderTotal","orderItems","resumeUrl"]',
        true,
        NOW(),
        NOW()
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM email_templates WHERE \`key\` = 'abandoned_cart_reminder'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM email_templates
      WHERE \`key\` = 'abandoned_cart_reminder';
    `);
  }
}
