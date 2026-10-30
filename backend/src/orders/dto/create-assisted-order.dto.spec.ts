import { ValidationPipe } from '@nestjs/common';
import { ConfirmAssistedTransferDto } from './create-assisted-order.dto';

describe('assisted transfer HTTP validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });

  it.each([{}, { transferReference: '' }, { transferReference: ' ' }, { transferReference: null }, { transferReference: '123' }])('accepts an optional operation number: %j', async body => {
    await expect(pipe.transform(body, { type: 'body', metatype: ConfirmAssistedTransferDto })).resolves.toBeInstanceOf(ConfirmAssistedTransferDto);
  });

  it('still rejects a non-string operation number', async () => {
    await expect(pipe.transform({ transferReference: 123 }, { type: 'body', metatype: ConfirmAssistedTransferDto })).rejects.toThrow();
  });
});
