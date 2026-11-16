export function pageProgress(
  start: number,
  translationX: number,
  width: number,
) {
  "worklet";
  return Math.max(0, Math.min(1, start - translationX / Math.max(1, width)));
}

export function completeCatalogSwipe(
  progress: number,
  translationX: number,
  translationY: number,
  velocityX: number,
  canceled: boolean,
) {
  "worklet";
  if (
    canceled ||
    translationX >= 0 ||
    -translationX <= Math.abs(translationY) * 1.6
  )
    return false;
  return progress >= 0.25 || (translationX <= -30 && velocityX <= -650);
}
