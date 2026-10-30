import { withStoreSender } from './store-sender';
import { EmailService, SmtpConfig } from './email.service';

describe('store notification sender', () => {
  const smtp: SmtpConfig = { host: 'smtp.example.com', port: 587, secure: false, user: 'user', password: 'password', fromEmail: 'notifications@example.com', fromName: 'MundoBeat Marketplace' };

  it('changes only the display name and does not mutate shared SMTP settings', () => {
    const cdmania = withStoreSender(smtp, 'CDmania');
    const other = withStoreSender(smtp, 'Otra tienda');
    expect(cdmania).toEqual({ ...smtp, fromName: 'CDmania' });
    expect(other.fromName).toBe('Otra tienda');
    expect(smtp.fromName).toBe('MundoBeat Marketplace');
    expect(withStoreSender(smtp).fromName).toBe('MundoBeat Marketplace');
  });
  it.each([undefined, null, '', '   '])('preserves the marketplace sender without a store name: %s', name => {
    expect(withStoreSender(smtp, name)).toEqual(smtp);
  });
  it('cleans line breaks from store names', () => {
    expect(withStoreSender(smtp, ' CDmania\r\nSucursal ').fromName).toBe('CDmania Sucursal');
  });
  it('uses a structured sender so quotes and punctuation remain part of the display name', async () => {
    const service = new EmailService();
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'test' });
    jest.spyOn(service, 'createTransporter').mockReturnValue({ sendMail } as any);
    const attachments = [{ filename: 'boleta.pdf', content: Buffer.from('%PDF-'), contentType: 'application/pdf' }];
    await service.sendEmail(withStoreSender(smtp, 'Discos "Juan", CDmania'), 'buyer@example.com', 'Boleta', '<p>Boleta</p>', attachments);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: { name: 'Discos "Juan", CDmania', address: smtp.fromEmail }, attachments }));
    await service.sendEmail(smtp, 'admin@example.com', 'Notificación general', '<p>Marketplace</p>');
    expect(sendMail.mock.calls[1][0].from).toEqual({ name: 'MundoBeat Marketplace', address: smtp.fromEmail });
  });
});
