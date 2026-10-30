import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddHomePageConfigToVendor1700000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'vendors',
      new TableColumn({
        name: 'homePageConfig',
        type: 'json',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('vendors', 'homePageConfig');
  }
}
