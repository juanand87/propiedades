import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ReceiptQrAndShortLink1792700000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    for (const column of [
      new TableColumn({ name: 'sales_receipt_qr_image_url', type: 'text', isNullable: true }),
      new TableColumn({ name: 'sales_receipt_token', type: 'varchar', length: '32', isNullable: true, isUnique: true }),
    ]) if (!(await runner.hasColumn('orders', column.name))) await runner.addColumn('orders', column);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.dropColumn('orders', 'sales_receipt_token');
    await runner.dropColumn('orders', 'sales_receipt_qr_image_url');
  }
}
