import type { VideoPlayer } from "expo-video";
export const PRELOAD_VIDEO_COUNT = 5;
export const PRELOAD_CONCURRENT_LOADS = 2;
export const PRELOAD_SECONDS = 8;
export function preloadBufferReady(
  status: string,
  buffered: number,
  current: number,
  duration: number,
) {
  const target =
    duration > 0
      ? Math.min(PRELOAD_SECONDS, Math.max(0, duration - current))
      : PRELOAD_SECONDS;
  return (
    status === "readyToPlay" &&
    buffered >= 0 &&
    buffered - current >= target - 0.25
  );
}
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

export function preloadAheadCount(
  status: string,
  buffered: number,
  current: number,
  duration: number,
  previous: number,
) {
  if (status !== "readyToPlay" || buffered < 0) return 0;
  const ahead = Math.max(0, buffered - current),
    remaining = Math.max(0, duration - current);
  if (duration > 0 && ahead >= remaining - 0.25) return PRELOAD_VIDEO_COUNT;
  if (ahead >= (previous >= 5 ? 5 : 8)) return 5;
  if (ahead >= (previous >= 3 ? 3 : 5)) return 3;
  return ahead >= (previous >= 1 ? 0.75 : 1.25) ? 1 : 0;
}
export function attachPreparedVideo(
  videos: { id: string }[],
  index: number,
  active: number,
) {
  if (Math.abs(index - active) > 1 || !videos[index]) return false;
  return (
    [active, active + 1, active - 1].find(
      (i) => videos[i]?.id === videos[index].id,
    ) === index
  );
}

// Keep start/resume below a frame transition; preload only behind a healthy active buffer.
export function playbackBuffer(active: boolean) {
  return {
    minBufferForPlayback: 0.15,
    preferredForwardBufferDuration: active ? 20 : PRELOAD_SECONDS,
    maxBufferBytes: (active ? 12 : 4) * 1024 * 1024,
    prioritizeTimeOverSizeThreshold: false,
  };
}

export function configureVideoBuffer(
  player: Pick<VideoPlayer, "bufferOptions">,
  active: boolean,
) {
  player.bufferOptions = playbackBuffer(active);
}
