import { canEditReview, isReviewableOrderSource } from './review-rules';

describe('review rules', () => {
  it('only accepts MundoBeat and assisted sales', () => {
    expect(isReviewableOrderSource('marketplace')).toBe(true);
    expect(isReviewableOrderSource('assisted_sale')).toBe(true);
    expect(isReviewableOrderSource('woocommerce')).toBe(false);
    expect(isReviewableOrderSource('mercadolibre')).toBe(false);
    expect(isReviewableOrderSource('pos')).toBe(false);
  });

  it('allows editing through the configured deadline', () => {
    const now = new Date('2026-10-13T12:00:00Z');
    expect(canEditReview('2026-10-13T12:00:00Z', now)).toBe(true);
    expect(canEditReview('2026-10-13T11:59:59Z', now)).toBe(false);
  });
});
