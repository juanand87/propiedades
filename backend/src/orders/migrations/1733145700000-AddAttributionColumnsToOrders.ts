import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAttributionColumnsToOrders1733145700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'source',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'deviceType',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'userAgent',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('orders', 'userAgent');
    await queryRunner.dropColumn('orders', 'deviceType');
    await queryRunner.dropColumn('orders', 'source');
  }
}
