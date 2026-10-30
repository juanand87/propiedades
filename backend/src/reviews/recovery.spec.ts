import { ReviewsService } from './reviews.service';

describe('review recovery acceptance', () => {
  it('requires consent and activates the benefit without changing stars or comment', async () => {
    const reviews = { update: jest.fn(), save: jest.fn() };
    const discounts = {
      recoveryByToken: jest
        .fn()
        .mockResolvedValue({
          id: 'code',
          reviewId: 'review',
          vendorId: 'store',
          status: 'active',
          expiresAt: new Date(Date.now() + 86400000),
        }),
      acceptRecoveryCode: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ReviewsService(
      reviews as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      discounts as any,
    );
    jest
      .spyOn(service, 'getRecovery')
      .mockResolvedValue({ code: 'TEST10' } as any);
    await expect(service.acceptRecovery('token', false)).rejects.toThrow(
      'aceptar',
    );
    expect(discounts.acceptRecoveryCode).not.toHaveBeenCalled();
    await service.acceptRecovery('token', true);
    expect(discounts.acceptRecoveryCode).toHaveBeenCalledWith('code');
    expect(reviews.update).not.toHaveBeenCalled();
    expect(reviews.save).not.toHaveBeenCalled();
  });
});
