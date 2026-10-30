import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAbandonedReminderSentAtToOrders1733146300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('orders');
    if (!table) {
      return;
    }

    const hasColumn = table.columns.some((column) => column.name === 'abandoned_reminder_sent_at');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'abandoned_reminder_sent_at',
          type: 'datetime',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('orders');
    if (!table) {
      return;
    }

    const hasColumn = table.columns.some((column) => column.name === 'abandoned_reminder_sent_at');
    if (hasColumn) {
      await queryRunner.dropColumn('orders', 'abandoned_reminder_sent_at');
    }
  }
}
