import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AssistedFixedCommission1792500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      new TableColumn({ name: 'assisted_commission_type', type: 'varchar', length: '16', default: "'percentage'" }),
      new TableColumn({ name: 'assisted_commission_fixed_amount', type: 'decimal', precision: 10, scale: 0, default: '0' }),
    ]) {
      if (!(await queryRunner.hasColumn('vendor_settings', column.name))) await queryRunner.addColumn('vendor_settings', column);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('vendor_settings', 'assisted_commission_fixed_amount');
    await queryRunner.dropColumn('vendor_settings', 'assisted_commission_type');
  }
}
