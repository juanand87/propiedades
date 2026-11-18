import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { VideoPlayer, VideoView } from "expo-video";
import { playbackSource } from "./video-source";
import {
  beginVideoDisplay,
  beginVideoLoad,
  videoFrameVisible,
} from "./playback-metrics";
export function DelayedVideoSpinner({ waiting }: { waiting: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(waiting), waiting ? 700 : 0);
    return () => clearTimeout(timer);
  }, [waiting]);
  return show && waiting ? (
    <ActivityIndicator
      pointerEvents="none"
      style={s.center}
      color="#fff"
      size="small"
    />
  ) : null;
}
export function VideoSurface({
  player,
  url,
  active,
  paused,
  onPause,
}: {
  player: VideoPlayer;
  url: string;
  active: boolean;
  paused: boolean;
  onPause: () => void;
}) {
  const [framePlayer, setFramePlayer] = useState<VideoPlayer | null>(null),
    [status, setStatus] = useState(player.status),
    [error, setError] = useState(() =>
      player.status === "error" ? "No se pudo reproducir este video." : "",
    );
  const firstFrame = framePlayer === player;
  const frame = useRef<VideoPlayer | null>(null),
    allowed = useRef(false),
    display = useRef<ReturnType<typeof beginVideoDisplay> | null>(null);
  useEffect(() => {
    if (active) {
      display.current = beginVideoDisplay(
        player,
        player.status === "readyToPlay",
      );
      if (frame.current === player) videoFrameVisible(display.current, true);
    } else display.current = null;
  }, [player, active]);
  useEffect(() => {
    allowed.current = active && !paused;
    if (allowed.current) player.play();
    else player.pause();
    return () => {
      allowed.current = false;
    };
  }, [player, active, paused]);
  useEffect(() => {
    const listener = player.addListener("statusChange", (event) => {
      setStatus(event.status);
      if (event.status === "readyToPlay") {
        if (allowed.current) player.play();
        else player.pause();
      }
      setError(
        event.status === "error" ? "No se pudo reproducir este video." : "",
      );
    });
    return () => listener.remove();
  }, [player]);
  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={onPause}
      accessibilityLabel={paused ? "Reproducir video" : "Pausar video"}
    >
      <VideoView
        style={[StyleSheet.absoluteFill, { opacity: firstFrame ? 1 : 0 }]}
        player={player}
        nativeControls={false}
        contentFit="cover"
        surfaceType="textureView"
        onFirstFrameRender={() => {
          frame.current = player;
          setFramePlayer(player);
          if (active && display.current) videoFrameVisible(display.current);
        }}
      />
      <DelayedVideoSpinner
        waiting={
          active && !paused && !error && (status === "loading" || !firstFrame)
        }
      />
      {paused && active && !error && <Text style={s.play}>▶</Text>}
      {!!error && active && (
        <View style={s.error}>
          <Text style={s.white}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              frame.current = null;
              setFramePlayer(null);
              setError("");
              beginVideoLoad(player);
              display.current = beginVideoDisplay(player);
              void player
                .replaceAsync(playbackSource(url))
                .catch(() =>
                  setError("Video no disponible. Desliza para continuar."),
                );
            }}
          >
            <Text style={s.retry}>Reintentar</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}
const s = StyleSheet.create({
  center: { position: "absolute", top: "45%", alignSelf: "center" },
  play: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    fontSize: 58,
    color: "#fff",
  },
  error: {
    position: "absolute",
    top: "38%",
    alignSelf: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#0c315eee",
  },
  white: { color: "#fff" },
  retry: { color: "#8be3ff", padding: 12, textAlign: "center" },
});
