import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { VideoPlayer, VideoView } from "expo-video";
import { mediaUrl, Video, Session } from "./api";
import { videoColors } from "./video-colors";
import { videoIcons } from "./video-icons";
import { SocialVideoActions } from "./SocialVideoActions";

function Player({
  url,
  player,
  paused,
  onPause,
}: {
  url: string;
  player: VideoPlayer;
  paused: boolean;
  onPause: () => void;
}) {
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(() => player.status === "loading");
  const playingAllowed = useRef(!paused);
  useEffect(() => {
    playingAllowed.current = !paused;
    if (!paused) player.play();
    else player.pause();
    return () => {
      playingAllowed.current = false;
    };
  }, [paused, player]);
  useEffect(() => {
    const sub = player.addListener("statusChange", (event) => {
      setLoading(event.status === "loading");
      setError(
        event.status === "error" ? "No se pudo reproducir este video." : "",
      );
    });
    return () => sub.remove();
  }, [player]);
  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      accessibilityLabel={paused ? "Reproducir video" : "Pausar video"}
      onPress={onPause}
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
              setLoading(true);
              void player
                .replaceAsync({
                  uri: mediaUrl(url),
                  contentType: "progressive",
                  useCaching: true,
                })
                .then(() => {
                  if (playingAllowed.current) player.play();
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
  player,
  favorite,
  onFavorite,
  onDetails,
  onContact,
  onShare,
  social = false,
  session = null,
}: {
  item: Video;
  height: number;
  active: boolean;
  player?: VideoPlayer;
  favorite: boolean;
  onFavorite: () => void;
  onDetails: () => void;
  onContact?: () => void;
  onShare: () => void;
  social?: boolean;
  session?: Session | null;
}) {
  const p = item.property;
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!active) {
      const timer = setTimeout(() => setPaused(false), 0);
      return () => clearTimeout(timer);
    }
  }, [active]);
  return (
    <View style={[styles.card, { height }]}>
      {(!active || !player) && !!p?.media[0] && (
        <Image
          source={{ uri: mediaUrl(p.media[0].url) }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      {active && player && (
        <Player
          url={item.url}
          player={player}
          paused={paused}
          onPause={() => setPaused((value) => !value)}
        />
      )}
      {active && !player && (
        <ActivityIndicator style={styles.center} color="#fff" />
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
        </View>
      )}
      {social && active && (
        <SocialVideoActions
          videoId={item.id}
          session={session}
          paused={paused}
          onResume={() => setPaused(false)}
          propertyActions={
            p
              ? { favorite, onFavorite, onDetails, onContact, onShare }
              : undefined
          }
        />
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
          {onContact && (
            <Pressable
              accessibilityRole="button"
              onPress={onContact}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Consultar al vendedor</Text>
            </Pressable>
          )}
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
