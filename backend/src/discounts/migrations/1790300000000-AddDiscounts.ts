import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiscounts1790300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS discount_codes (
      id varchar(36) NOT NULL PRIMARY KEY, code varchar(60) NOT NULL UNIQUE,
      name varchar(150) NOT NULL, vendorId varchar(36) NULL, percentage int NOT NULL,
      categoryIds text NOT NULL, genreIds text NOT NULL, productIds text NOT NULL,
      minPurchase int NOT NULL DEFAULT 0, maxDiscount int NULL, maxUses int NOT NULL DEFAULT 100,
      startsAt datetime NOT NULL, expiresAt datetime NOT NULL, status varchar(20) NOT NULL DEFAULT 'active',
      customerEmail varchar(255) NULL, reviewId varchar(36) NULL UNIQUE, resolution text NULL,
      originalRating int NULL, originalComment text NULL, acceptedAt datetime NULL,
      emailSentAt datetime NULL, reviewUpdatedAt datetime NULL,
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS discount_uses (
      id varchar(36) NOT NULL PRIMARY KEY, discountId varchar(36) NOT NULL,
      orderId varchar(36) NOT NULL UNIQUE, customerEmail varchar(255) NOT NULL, amount int NOT NULL,
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      UNIQUE KEY discount_customer (discountId, customerEmail),
      CONSTRAINT discount_uses_code FOREIGN KEY (discountId) REFERENCES discount_codes(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE discount_uses');
    await queryRunner.query('DROP TABLE discount_codes');
  }
}
