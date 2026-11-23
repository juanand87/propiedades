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

export function resumeVideoIndex(
  videos: { id: string }[],
  id: string,
  current: number,
) {
  if (videos[current]?.id === id) return current;
  let result = -1;
  for (let i = 0; i < videos.length; i++)
    if (
      videos[i].id === id &&
      (result < 0 || Math.abs(i - current) < Math.abs(result - current))
    )
      result = i;
  return result;
}

export function enteringVideoIndex(
  offset: number,
  pageHeight: number,
  start: number,
  count: number,
  playing: number,
) {
  if (!(pageHeight > 0) || count < 1) return 0;
  const anchor = Math.max(0, Math.min(count - 1, start));
  const progress = (offset - anchor * pageHeight) / pageHeight;
  if (progress >= 0.2 || (playing === anchor + 1 && progress > 0.08))
    return Math.min(count - 1, anchor + 1);
  if (progress <= -0.2 || (playing === anchor - 1 && progress < -0.08))
    return Math.max(0, anchor - 1);
  return anchor;
}
