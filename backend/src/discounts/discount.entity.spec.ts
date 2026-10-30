import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DiscountCode, DiscountUse } from './discount.entity';

describe('discount MySQL metadata', () => {
  it('validates both entities without opening a database connection', async () => {
    const dataSource = new DataSource({
      type: 'mysql',
      database: 'metadata_test',
      entities: [DiscountCode, DiscountUse],
      synchronize: false,
    });

    // Run the same metadata validation used by initialize, without connecting.
    await expect((dataSource as any).buildMetadatas()).resolves.toBeUndefined();
    const metadata = dataSource.getMetadata(DiscountCode);
    for (const property of ['vendorId', 'customerEmail', 'reviewId']) {
      expect(metadata.findColumnWithPropertyName(property)).toMatchObject({
        type: 'varchar',
        isNullable: true,
      });
    }
  });
});
