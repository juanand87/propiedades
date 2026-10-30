import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMissingColumnsToOrders1733146100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar trackingNumber si no existe
    const table = await queryRunner.getTable('orders');
    if (table && !table.findColumnByName('trackingNumber')) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'trackingNumber',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }

    // Agregar notes si no existe
    if (table && !table.findColumnByName('notes')) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'notes',
          type: 'text',
          isNullable: true,
        }),
      );
    }

    // Agregar createdAt y updatedAt si no existen
    if (table && !table.findColumnByName('createdAt')) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'createdAt',
          type: 'datetime',
          default: 'CURRENT_TIMESTAMP',
        }),
      );
    }

    if (table && !table.findColumnByName('updatedAt')) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'updatedAt',
          type: 'datetime',
          default: 'CURRENT_TIMESTAMP',
          onUpdate: 'CURRENT_TIMESTAMP',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('orders', 'updatedAt');
    await queryRunner.dropColumn('orders', 'createdAt');
    await queryRunner.dropColumn('orders', 'notes');
    await queryRunner.dropColumn('orders', 'trackingNumber');
  }
}
