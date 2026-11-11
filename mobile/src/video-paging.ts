export function clampVideoOffset(
  offset: number,
  pageHeight: number,
  startIndex: number,
  count: number,
) {
  const current = Math.max(0, Math.min(count - 1, startIndex));
  const first = Math.max(0, current - 1);
  const last = Math.max(0, Math.min(count - 1, current + 1));
  return Math.max(first * pageHeight, Math.min(last * pageHeight, offset));
}
