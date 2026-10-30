import { ReviewsService } from './reviews.service';

describe('review email store sender', () => {
  it('uses the reviewed store name without changing the marketplace SMTP address', async () => {
    const service: any = Object.create(ReviewsService.prototype);
    const smtp = { fromEmail: 'notifications@example.com', fromName: 'MundoBeat Marketplace' };
    service.vendorsRepository = { findOne: async () => ({ storeName: 'CDmania' }) };
    service.getMarketplaceSmtp = async () => smtp;
    service.emailService = { sendEmail: jest.fn() };
    await service.sendReviewEmail({ vendorId: 'vendor', customerEmail: 'buyer@example.com', orderNumber: 'ORD-1', emailCount: 0 }, 'token');
    expect(service.emailService.sendEmail.mock.calls[0][0]).toEqual({ fromEmail: smtp.fromEmail, fromName: 'CDmania' });
    expect(smtp.fromName).toBe('MundoBeat Marketplace');
  });
});
