import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVendorCustomerRefundFields1790250000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders
      ADD COLUMN vendor_customer_refund_status varchar(30) NULL,
      ADD COLUMN vendor_customer_refund_amount decimal(10,2) NULL,
      ADD COLUMN vendor_customer_refund_reference varchar(255) NULL,
      ADD COLUMN vendor_customer_refund_proof text NULL,
      ADD COLUMN vendor_customer_refund_note text NULL,
      ADD COLUMN vendor_customer_refunded_at datetime NULL,
      ADD INDEX idx_orders_vendor_customer_refund (vendor_customer_refund_status)`);
    await queryRunner.query(`ALTER TABLE order_refunds COMMENT = 'Historial del flujo antiguo de reembolsos automáticos mediante Payku; conservar para auditoría y posible reactivación futura'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders
      DROP INDEX idx_orders_vendor_customer_refund,
      DROP COLUMN vendor_customer_refunded_at,
      DROP COLUMN vendor_customer_refund_note,
      DROP COLUMN vendor_customer_refund_proof,
      DROP COLUMN vendor_customer_refund_reference,
      DROP COLUMN vendor_customer_refund_amount,
      DROP COLUMN vendor_customer_refund_status`);
    await queryRunner.query(`ALTER TABLE order_refunds COMMENT = ''`);
  }
}
