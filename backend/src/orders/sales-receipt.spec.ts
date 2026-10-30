import { OrdersService } from './orders.service';
import { validateSalesReceiptUrl } from './sales-receipt-url';

describe('sales receipt', () => {
  let service: any, order: any;
  beforeEach(() => {
    order = { id: 'order', vendorId: 'vendor', orderNumber: 'ORD-1', customerEmail: 'buyer@example.com', shippingName: '<Buyer>', salesReceiptUrl: null };
    service = Object.create(OrdersService.prototype);
    service.findOneForVendor = jest.fn().mockResolvedValue(order);
    service.ordersRepository = { save: jest.fn(async (value) => value) };
    service.vendorsRepository = { findOne: jest.fn().mockResolvedValue({ storeName: 'CDmania' }) };
    service.recordHistory = jest.fn();
    service.getMarketplaceMailConfig = jest.fn().mockResolvedValue({ config: {} });
    service.emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  });
  it.each(['https://example.com/boleta.pdf', 'http://example.com/receipt?id=1&view=1'])('saves %s and notifies the buyer with a link', async (url) => {
    const saved = await service.updateSalesReceipt('order', 'vendor', url);
    expect(service.findOneForVendor).toHaveBeenCalledWith('order', 'vendor');
    expect(saved.salesReceiptUrl).toBe(url);
    expect(saved.salesReceiptNotification).toBe('sent');
    expect(service.emailService.sendEmail).toHaveBeenCalledWith({ fromName: 'CDmania' }, order.customerEmail,
      'Boleta de tu pedido ORD-1', expect.stringContaining('Ver boleta'), undefined);
    const html = service.emailService.sendEmail.mock.calls[0][3];
    expect(html).toContain('&lt;Buyer&gt;');
    expect(html).toContain(`/b/${saved.salesReceiptToken}`);
    expect(saved.salesReceiptToken).toMatch(/^[a-f0-9]{32}$/);
  });
  it('keeps the receipt saved when email fails', async () => {
    service.emailService.sendEmail.mockRejectedValue(new Error('SMTP offline'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const saved = await service.updateSalesReceipt('order', 'vendor', 'https://example.com/boleta');
      expect(saved.salesReceiptNotification).toBe('failed');
      expect(saved.salesReceiptUrl).toBe('https://example.com/boleta');
    } finally { log.mockRestore(); }
  });
  it('reports unavailable email configuration', async () => {
    service.getMarketplaceMailConfig.mockResolvedValue(null);
    expect((await service.updateSalesReceipt('order', 'vendor', 'https://example.com/boleta')).salesReceiptNotification).toBe('unavailable');
    expect(service.emailService.sendEmail).not.toHaveBeenCalled();
  });
  it('does not resend for an unchanged link', async () => {
    order.salesReceiptUrl = 'https://example.com/boleta';
    expect((await service.updateSalesReceipt('order', 'vendor', order.salesReceiptUrl)).salesReceiptNotification).toBe('unchanged');
    expect(service.ordersRepository.save).not.toHaveBeenCalled();
    expect(service.emailService.sendEmail).not.toHaveBeenCalled();
  });
  it('checks ownership before saving or sending', async () => {
    service.findOneForVendor.mockRejectedValue(new Error('Forbidden'));
    await expect(service.updateSalesReceipt('order', 'other-vendor', 'https://example.com')).rejects.toThrow('Forbidden');
    expect(service.ordersRepository.save).not.toHaveBeenCalled();
    expect(service.emailService.sendEmail).not.toHaveBeenCalled();
  });
  it('includes the saved QR inline and PDF as an email attachment', async () => {
    const attachments = [{ filename: 'boleta.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' }];
    const result = await service.updateSalesReceipt('order', 'vendor', 'https://cdn.example.com/boleta.pdf', { qrImageUrl: 'https://cdn.example.com/qr.png', attachments });
    expect(result.salesReceiptQrImageUrl).toBe('https://cdn.example.com/qr.png');
    expect(service.emailService.sendEmail.mock.calls[0][3]).toContain('cid:boleta-qr');
    expect(service.emailService.sendEmail.mock.calls[0][4]).toBe(attachments);
  });
  it('keeps the short link stable when the document is replaced', async () => {
    order.salesReceiptToken = 'a'.repeat(32);
    const result = await service.updateSalesReceipt('order', 'vendor', 'https://example.com/new.pdf');
    expect(result.salesReceiptToken).toBe('a'.repeat(32));
    expect(result.salesReceiptQrImageUrl).toBeNull();
  });
  it('resolves only a random receipt token and returns no customer details', async () => {
    service.ordersRepository.findOne = jest.fn().mockResolvedValue({ salesReceiptUrl: 'https://cdn.example.com/boleta.pdf' });
    await expect(service.resolveSalesReceipt('order')).rejects.toThrow();
    expect(service.ordersRepository.findOne).not.toHaveBeenCalled();
    await expect(service.resolveSalesReceipt('a'.repeat(32))).resolves.toEqual({ url: 'https://cdn.example.com/boleta.pdf' });
    expect(service.ordersRepository.findOne).toHaveBeenCalledWith({ where: { salesReceiptToken: 'a'.repeat(32) }, select: ['salesReceiptUrl'] });
  });
  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///secret', 'https://user:pass@example.com', '', null, 'no-url'])('rejects unsafe or invalid links %s', (value) => {
    expect(() => validateSalesReceiptUrl(value)).toThrow('enlace web');
  });
});
