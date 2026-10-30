import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateOrderHistoryTable1733145600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'order_history',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            default: "UUID()",
          },
          {
            name: 'orderId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'action',
            type: 'enum',
            enum: ['created', 'item_added', 'item_removed', 'item_updated', 'status_changed', 'note_added'],
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'previousValues',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'newValues',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'itemId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'changedBy',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'sessionMetadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'timestamp',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          {
            columnNames: ['orderId'],
          },
          {
            columnNames: ['timestamp'],
          },
          {
            columnNames: ['action'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'order_history',
      new TableForeignKey({
        columnNames: ['orderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('order_history');
  }
}
