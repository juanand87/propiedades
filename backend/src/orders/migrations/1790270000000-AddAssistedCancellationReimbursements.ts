import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssistedCancellationReimbursements1790270000000 implements MigrationInterface {
  name = 'AddAssistedCancellationReimbursements1790270000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders
      ADD COLUMN assisted_reimbursement_status varchar(40) NULL,
      ADD COLUMN assisted_shipping_refund_status varchar(40) NULL,
      ADD COLUMN assisted_commission_refund_amount decimal(10,0) NULL,
      ADD COLUMN assisted_shipping_refund_amount decimal(10,0) NULL,
      ADD COLUMN assisted_reimbursement_amount decimal(10,0) NULL,
      ADD COLUMN assisted_shipping_cancellation_confirmed_at datetime NULL,
      ADD INDEX idx_orders_assisted_reimbursement (assisted_reimbursement_status)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders
      DROP INDEX idx_orders_assisted_reimbursement,
      DROP COLUMN assisted_shipping_cancellation_confirmed_at,
      DROP COLUMN assisted_reimbursement_amount,
      DROP COLUMN assisted_shipping_refund_amount,
      DROP COLUMN assisted_commission_refund_amount,
      DROP COLUMN assisted_shipping_refund_status,
      DROP COLUMN assisted_reimbursement_status`);
  }
}
