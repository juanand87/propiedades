import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { mediaUrl, Video, Session } from "./api";
import { videoColors } from "./video-colors";
import { videoIcons } from "./video-icons";
import { SocialVideoActions } from "./SocialVideoActions";

function Player({
  url,
  active,
  muted,
  onReady,
}: {
  url: string;
  active: boolean;
  muted: boolean;
  onReady: () => void;
}) {
  const player = useVideoPlayer(
    { uri: mediaUrl(url), contentType: "progressive" },
    (p) => {
      p.bufferOptions = {
        minBufferForPlayback: 1.25,
        preferredForwardBufferDuration: 8,
      };
      p.loop = true;
      p.muted = muted;
    },
  );
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(() => player.status === "loading"),
    [paused, setPaused] = useState(false);
  useEffect(() => {
    // expo-video exposes a native mutable setter, not a React state object.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    if (active && !paused) player.play();
    else player.pause();
  }, [active, paused, player]);
  useEffect(() => {
    if (active && player.status === "readyToPlay") onReady();
    const sub = player.addListener("statusChange", (e) => {
      if (active && e.status === "readyToPlay") onReady();
      setLoading(e.status === "loading");
      if (e.status === "error") setError("No se pudo reproducir este video.");
      else setError("");
    });
    return () => sub.remove();
  }, [active, onReady, player]);
  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      accessibilityLabel={paused ? "Reproducir video" : "Pausar video"}
      onPress={() => setPaused((v) => !v)}
    >
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls={false}
        contentFit="contain"
        surfaceType="surfaceView"
      />
      {loading && (
        <ActivityIndicator style={styles.center} color="#fff" size="large" />
      )}
      {paused && !error && <Text style={styles.play}>▶</Text>}
      {!!error && (
        <View style={styles.error}>
          <Text style={styles.white}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setError("");
              setPaused(false);
              setLoading(true);
              void player
                .replaceAsync({
                  uri: mediaUrl(url),
                  contentType: "progressive",
                })
                .then(() => {
                  if (active) player.play();
                })
                .catch(() =>
                  setError("Video no disponible. Desliza para continuar."),
                );
            }}
          >
            <Text style={styles.retry}>Reintentar</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}
export function VideoCard({
  item,
  height,
  active,
  nearby,
  onReady,
  muted,
  favorite,
  onMute,
  onFavorite,
  onDetails,
  onShare,
  social = false,
  session = null,
}: {
  item: Video;
  height: number;
  active: boolean;
  nearby: boolean;
  onReady: (id: string) => void;
  muted: boolean;
  favorite: boolean;
  onMute: () => void;
  onFavorite: () => void;
  onDetails: () => void;
  onShare: () => void;
  social?: boolean;
  session?: Session | null;
}) {
  const p = item.property;
  return (
    <View style={[styles.card, { height }]}>
      {!nearby && !!p?.media[0] && (
        <Image
          source={{ uri: mediaUrl(p.media[0].url) }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      {nearby && (
        <Player
          url={item.url}
          active={active}
          muted={muted}
          onReady={() => onReady(item.id)}
        />
      )}
      <View pointerEvents="none" style={styles.shade} />
      {!social && (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              favorite ? "Quitar de favoritos" : "Guardar en favoritos"
            }
            onPress={onFavorite}
            style={styles.circle}
          >
            <Image
              source={videoIcons.heart}
              style={{ width: 34, height: 34 }}
            />
            <Text style={styles.small}>
              {favorite ? "Guardado" : "Guardar"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compartir propiedad"
            onPress={onShare}
            style={styles.circle}
          >
            <Image
              source={videoIcons.share}
              style={{ width: 34, height: 34 }}
            />
            <Text style={styles.small}>Compartir</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={muted ? "Activar sonido" : "Silenciar video"}
            onPress={onMute}
            style={styles.circle}
          >
            <Text style={styles.action}>{muted ? "♪̸" : "♪"}</Text>
            <Text style={styles.small}>
              {muted ? "Sin sonido" : "Con sonido"}
            </Text>
          </Pressable>
        </View>
      )}
      {social && active && (
        <SocialVideoActions
          videoId={item.id}
          session={session}
          propertyActions={
            p ? { favorite, onFavorite, onDetails, onShare } : undefined
          }
        />
      )}
      {social && (
        <Pressable
          accessibilityLabel={muted ? "Activar sonido" : "Silenciar video"}
          onPress={onMute}
          style={{ position: "absolute", top: 20, right: 15, padding: 12 }}
        >
          <Text style={styles.white}>{muted ? "♪̸" : "♪"}</Text>
        </Pressable>
      )}
      {!social && p && (
        <View style={styles.copy}>
          <Text style={styles.location}>
            {p.commune_name} · {p.region_name}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {p.title}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onDetails}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Ver propiedad ↗</Text>
          </Pressable>
          <Text style={styles.hint}>
            {p.is_demo
              ? "Video ilustrativo. No corresponde a una oferta real."
              : p.advertiser.name}
          </Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: "#000", overflow: "hidden" },
  shade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "48%",
    backgroundColor: "rgba(0,0,0,.42)",
  },
  center: { position: "absolute", top: "42%", left: "47%" },
  play: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    fontSize: 58,
    color: "white",
  },
  error: {
    position: "absolute",
    top: "35%",
    alignSelf: "center",
    padding: 20,
    backgroundColor: videoColors.surface,
    borderRadius: 16,
  },
  white: { color: "white" },
  retry: { color: videoColors.cyan, padding: 12, textAlign: "center" },
  actions: { position: "absolute", right: 12, bottom: 110, gap: 16 },
  circle: { alignItems: "center", minWidth: 58, minHeight: 52 },
  action: {
    fontSize: 30,
    color: "white",
    textShadowColor: "#000",
    textShadowRadius: 5,
  },
  small: { fontSize: 10, color: "#fff" },
  copy: { position: "absolute", bottom: 24, left: 22, right: 84, gap: 8 },
  location: { fontSize: 12, color: videoColors.muted },
  title: { fontSize: 23, fontWeight: "700", color: "#fff" },
  button: {
    backgroundColor: videoColors.pink,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  buttonText: { color: videoColors.text, fontWeight: "800" },
  hint: { fontSize: 10, color: videoColors.muted },
});
