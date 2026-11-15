import { canPreloadAhead, hlsUnavailable } from "./video-playback-policy";
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
  player.bufferOptions = {
    minBufferForPlayback: 1.5,
    preferredForwardBufferDuration: active ? 20 : 2,
    maxBufferBytes: (active ? 8 : 1) * 1024 * 1024,
    prioritizeTimeOverSizeThreshold: false,
  };
}
let cacheSetup: Promise<void> | undefined;
export function prepareVideoCache() {
  if (Platform.OS === "web") return Promise.resolve();
  cacheSetup ??= setVideoCacheSizeAsync(256 * 1024 * 1024).catch(() => {});
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
  const aheadPermission = useRef("");
  useEffect(() => {
    const inspect = () => {
      const id = videos[active]?.id;
      const player = id ? owned.current.get(id)?.player : undefined;
      const allowed =
        !!id &&
        !!player &&
        enabled &&
        !suspended &&
        canPrepare &&
        canPreloadAhead(
          player.status,
          player.bufferedPosition,
          player.currentTime,
          player.duration,
          aheadPermission.current === id,
        );
      const next = allowed ? id! : "";
      if (next !== aheadPermission.current) {
        aheadPermission.current = next;
        setGeneration((value) => value + 1);
      }
    };
    const timer = setInterval(inspect, 1000);
    return () => clearInterval(timer);
  }, [videos, active, enabled, suspended, canPrepare]);
  useEffect(() => {
    const entries = owned.current;
    const allowAhead =
      aheadPermission.current === videos[active]?.id && !suspended;
    const wanted = enabled
      ? videos.slice(
          allowAhead ? Math.max(0, active - 1) : active,
          active + (allowAhead ? 3 : 1),
        )
      : [];
    let changed = false;
    for (const [id, entry] of entries) {
      if (
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
      // Only prepare the next source after the visible source is ready.
      for (
        let index = active;
        canPrepare &&
        index < Math.min(videos.length, active + (allowAhead ? 3 : 1));
        index++
      ) {
        const video = videos[index];
        if (
          index > active &&
          entries.get(videos[index - 1].id)?.player.status !== "readyToPlay"
        )
          break;
        if (!entries.has(video.id)) {
          if (video.thumbnail_url)
            void Image.prefetch(mediaUrl(video.thumbnail_url)).catch(() => {});
          const player = createVideoPlayer(null);
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
            if (event.status === "readyToPlay")
              setGeneration((value) => value + 1);
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
