import { beginVideoLoad, videoSourceReady } from "./playback-metrics";
import {
  preloadAheadCount,
  hlsUnavailable,
  playbackBuffer,
  PRELOAD_VIDEO_COUNT,
  PRELOAD_CONCURRENT_LOADS,
  preloadBufferReady,
} from "./video-playback-policy";
import { useEffect, useRef, useState } from "react";
import { Image, Platform } from "react-native";
import {
  createVideoPlayer,
  setVideoCacheSizeAsync,
  VideoPlayer,
} from "expo-video";
import { mediaUrl, Video } from "./api";
import { preferredVideoUrl, playbackSource } from "./video-source";

type PreparedVideo = {
  url: string;
  player: VideoPlayer;
  unsubscribe: () => void;
  role: string;
};
function configureBuffer(player: VideoPlayer, active: boolean) {
  player.bufferOptions = playbackBuffer(active);
}
let cacheSetup: Promise<void> | undefined;
export function prepareVideoCache() {
  if (Platform.OS === "web") return Promise.resolve();
  cacheSetup ??= setVideoCacheSizeAsync(512 * 1024 * 1024).catch(() => {});
  return cacheSetup;
}

export function useVideoPreload(
  videos: Video[],
  active: number,
  enabled: boolean,
  suspended = false,
  canPrepare = true,
) {
  const owned = useRef(new Map<string, PreparedVideo>());
  const [prepared, setPrepared] = useState(new Map<string, PreparedVideo>());
  const [generation, setGeneration] = useState(0);
  const prefetchedImages = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled) return;
    const prefetch = (url?: string | null) => {
      if (!url || prefetchedImages.current.has(url)) return;
      const seen = prefetchedImages.current;
      seen.add(url);
      if (seen.size > 128) seen.delete(seen.values().next().value!);
      void Image.prefetch(mediaUrl(url)).catch(() => seen.delete(url));
    };
    // Covers nearby are urgent; distant avatars must not delay the first video.
    const ahead = aheadPermission.current.count >= 3 ? 10 : 2;
    for (const video of videos.slice(Math.max(0, active - 1), active + ahead + 1)) {
      prefetch(video.thumbnail_url);
      prefetch(video.creator?.avatar_thumbnail_url || video.creator?.avatar_url);
    }
  }, [videos, active, enabled, generation]);
  const aheadPermission = useRef({ id: "", count: 0, filled: "" });
  useEffect(() => {
    const inspect = () => {
      const id = videos[active]?.id;
      const player = id ? owned.current.get(id)?.player : undefined;
      const count =
        id && player && enabled && !suspended && canPrepare
          ? preloadAheadCount(
              player.status,
              player.bufferedPosition,
              player.currentTime,
              player.duration,
              aheadPermission.current.id === id
                ? aheadPermission.current.count
                : 0,
            )
          : 0;
      const filled = [...owned.current.entries()]
        .filter(([, entry]) =>
          preloadBufferReady(
            entry.player.status,
            entry.player.bufferedPosition,
            entry.player.currentTime,
            entry.player.duration,
          ),
        )
        .map(([key]) => key)
        .join(":");
      if (
        aheadPermission.current.id !== id ||
        aheadPermission.current.count !== count ||
        aheadPermission.current.filled !== filled
      ) {
        aheadPermission.current = { id: id || "", count, filled };
        setGeneration((value) => value + 1);
      }
    };
    const timer = setInterval(inspect, 100);
    return () => clearInterval(timer);
  }, [videos, active, enabled, suspended, canPrepare]);
  useEffect(() => {
    const entries = owned.current;
    const ahead =
      aheadPermission.current.id === videos[active]?.id && !suspended
        ? aheadPermission.current.count
        : 0;
    const wanted = enabled
      ? videos.slice(Math.max(0, active - 1), active + PRELOAD_VIDEO_COUNT + 1)
      : [];
    let changed = false;
    for (const [id, entry] of entries) {
      if (
        (id !== videos[active]?.id &&
          entry.player.status !== "readyToPlay" &&
          (!ahead ||
            !videos
              .slice(active + 1, active + ahead + 1)
              .some((video) => video.id === id))) ||
        !wanted.some(
          (video) => video.id === id && preferredVideoUrl(video) === entry.url,
        )
      ) {
        entry.unsubscribe();
        entry.player.release();
        entries.delete(id);
        changed = true;
      }
    }
    if (enabled) {
      // Prepare nearest neighbors first; at most two sources start loading at
      // once. Never consume the visible video's bandwidth before it is ready.
      let loadingAhead = [...entries.entries()].filter(
        ([id, entry]) =>
          id !== videos[active]?.id &&
          entry.player.status !== "error" &&
          !preloadBufferReady(
            entry.player.status,
            entry.player.bufferedPosition,
            entry.player.currentTime,
            entry.player.duration,
          ),
      ).length;
      for (
        let index = active;
        canPrepare && index < Math.min(videos.length, active + ahead + 1);
        index++
      ) {
        const video = videos[index];
        if (!entries.has(video.id)) {
          if (index > active && loadingAhead >= PRELOAD_CONCURRENT_LOADS) break;
          if (index > active) loadingAhead++;
          const player = createVideoPlayer(null);
          beginVideoLoad(player);
          let fallback = false;
          const listener = player.addListener("statusChange", (event) => {
            if (
              event.status === "error" &&
              video.hls_url &&
              !fallback &&
              hlsUnavailable(event.error?.message)
            ) {
              fallback = true;
              void player
                .replaceAsync(playbackSource(video.url))
                .catch(() => {});
            }
            if (event.status === "readyToPlay") {
              videoSourceReady(player);
              setGeneration((value) => value + 1);
            }
          });
          const entry = {
            player,
            url: preferredVideoUrl(video),
            unsubscribe: () => listener.remove(),
            role: "",
          };
          entries.set(video.id, entry);
          changed = true;
          player.loop = true;
          player.muted = false;
          player.volume = 1;
          configureBuffer(player, index === active);
          void player
            .replaceAsync(playbackSource(preferredVideoUrl(video)))
            .catch(() => {});
        }
      }
      for (const [id, entry] of entries) {
        const role = id === videos[active]?.id ? "active" : "prepared";
        if (entry.role !== role) {
          configureBuffer(entry.player, role === "active");
          entries.set(id, { ...entry, role });
        }
        if (role !== "active" || suspended) entry.player.pause();
      }
    }
    if (changed) setPrepared(new Map(entries));
  }, [videos, active, enabled, suspended, canPrepare, generation]);
  useEffect(() => {
    const entries = owned.current;
    return () => {
      for (const entry of entries.values()) {
        entry.unsubscribe();
        entry.player.release();
      }
      entries.clear();
    };
  }, []);
  return prepared;
}
