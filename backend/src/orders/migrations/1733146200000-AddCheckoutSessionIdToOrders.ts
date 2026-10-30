import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddCheckoutSessionIdToOrders1733146200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('orders');

    if (table && !table.findColumnByName('checkout_session_id')) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'checkout_session_id',
          type: 'varchar',
          length: '100',
          isNullable: true,
        }),
      );
    }

    const checkoutIndexName = 'IDX_orders_vendor_orderSource_checkoutSession';
    const hasCheckoutIndex = table?.indices?.some((index) => index.name === checkoutIndexName);

    if (!hasCheckoutIndex) {
      await queryRunner.createIndex(
        'orders',
        new TableIndex({
          name: checkoutIndexName,
          columnNames: ['vendorId', 'orderSource', 'checkout_session_id'],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const checkoutIndexName = 'IDX_orders_vendor_orderSource_checkoutSession';
    const table = await queryRunner.getTable('orders');

    if (table?.indices?.some((index) => index.name === checkoutIndexName)) {
      await queryRunner.dropIndex('orders', checkoutIndexName);
    }

    if (table && table.findColumnByName('checkout_session_id')) {
      await queryRunner.dropColumn('orders', 'checkout_session_id');
    }
  }
}