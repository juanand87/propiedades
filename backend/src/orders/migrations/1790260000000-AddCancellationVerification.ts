import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancellationVerification1790260000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders ADD COLUMN cancellation_verification_url text NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE orders DROP COLUMN cancellation_verification_url`);
  }
}
