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
