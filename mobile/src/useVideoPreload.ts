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
  useEffect(() => {
    const entries = owned.current;
    const wanted = enabled
      ? videos.slice(Math.max(0, active - 1), active + 3)
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
        canPrepare && index < Math.min(videos.length, active + 3);
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
            if (event.status === "error" && video.hls_url && !fallback) {
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
          player.bufferOptions = {
            minBufferForPlayback: 0.75,
            preferredForwardBufferDuration: index === active ? 12 : 4,
            maxBufferBytes: (index === active ? 8 : 2) * 1024 * 1024,
            prioritizeTimeOverSizeThreshold: false,
          };
          void player
            .replaceAsync(playbackSource(preferredVideoUrl(video)))
            .catch(() => {});
        }
      }
      for (const [id, entry] of entries) {
        const role = id === videos[active]?.id ? "active" : "prepared";
        if (entry.role !== role) {
          entry.player.bufferOptions = {
            minBufferForPlayback: 0.75,
            preferredForwardBufferDuration: role === "active" ? 12 : 4,
            maxBufferBytes: (role === "active" ? 8 : 2) * 1024 * 1024,
            prioritizeTimeOverSizeThreshold: false,
          };
          entry.role = role;
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
