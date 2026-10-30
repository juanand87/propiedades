import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMercadoLibreOrderFields1790200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders
      ADD COLUMN external_order_id varchar(100) NULL,
      ADD COLUMN external_shipping_id varchar(100) NULL,
      ADD COLUMN external_shipping_status varchar(80) NULL,
      ADD COLUMN external_order_data json NULL,
      ADD INDEX idx_orders_external_order (external_order_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders
      DROP INDEX idx_orders_external_order,
      DROP COLUMN external_order_data,
      DROP COLUMN external_shipping_status,
      DROP COLUMN external_shipping_id,
      DROP COLUMN external_order_id`);
  }
}
