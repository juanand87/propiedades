// Keep background downloads behind the visible video, with hysteresis to avoid churn.
export function canPreloadAhead(
  status: string,
  bufferedPosition: number,
  currentTime: number,
  duration: number,
  alreadyAllowed: boolean,
) {
  if (status !== "readyToPlay" || bufferedPosition < 0) return false;
  const remaining = Math.max(0, duration - currentTime);
  const ahead = Math.max(0, bufferedPosition - currentTime);
  if (duration > 0 && ahead >= remaining - 0.25) return true;
  return ahead >= (alreadyAllowed ? 2 : 6);
}

// A slow/offline connection must not switch from adaptive HLS to the larger MP4.
export function hlsUnavailable(message?: string) {
  return (
    !!message &&
    /(?:\b404\b|\b410\b|unsupported (?:format|type)|unrecognizedinputformat|malformed (?:manifest|playlist))/i.test(
      message,
    )
  );
}

export function captureCatalogSwipe(dx: number, dy: number, touches = 1) {
  return touches === 1 && dx < -20 && -dx > Math.abs(dy) * 1.6;
}
export function finishCatalogSwipe(dx: number, dy: number) {
  return dx <= -65 && -dx > Math.abs(dy) * 1.6;
}
