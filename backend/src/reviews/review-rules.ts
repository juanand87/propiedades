export const REVIEWABLE_ORDER_SOURCES = ['marketplace', 'assisted_sale'] as const;
export const REVIEW_EDIT_DAYS = 7;
export const REVIEW_REMINDER_DAYS = 2;
export const REVIEW_MAX_EMAILS = 2;

export function canEditReview(editableUntil: Date | string | null, now = new Date()): boolean {
  return Boolean(editableUntil && new Date(editableUntil).getTime() >= now.getTime());
}

export function isReviewableOrderSource(source: string | null | undefined): boolean {
  return REVIEWABLE_ORDER_SOURCES.includes(source as (typeof REVIEWABLE_ORDER_SOURCES)[number]);
}
