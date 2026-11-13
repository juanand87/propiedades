import { Platform } from "react-native";
import type { VideoSource } from "expo-video";
import { mediaUrl } from "./api";
export function preferredVideoUrl(video: {
  url: string;
  hls_url?: string | null;
}) {
  return Platform.OS === "web" ? video.url : video.hls_url || video.url;
}
export function playbackSource(url: string): VideoSource {
  const hls = url.includes("/hls/master.m3u8?");
  return {
    uri: mediaUrl(url),
    contentType: hls ? "hls" : "progressive",
    useCaching: !(Platform.OS === "ios" && hls),
  };
}
