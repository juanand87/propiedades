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
import { mediaUrl, price, Video } from "./api";

function Player({
  url,
  active,
  muted,
}: {
  url: string;
  active: boolean;
  muted: boolean;
}) {
  const player = useVideoPlayer(mediaUrl(url), (p) => {
    p.loop = true;
    p.muted = muted;
  });
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
    const sub = player.addListener("statusChange", (e) => {
      setLoading(e.status === "loading");
      if (e.status === "error") setError("No se pudo reproducir este video.");
      else setError("");
    });
    return () => sub.remove();
  }, [player]);
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
        contentFit="cover"
        surfaceType="textureView"
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
                .replaceAsync(mediaUrl(url))
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
  muted,
  favorite,
  onMute,
  onFavorite,
  onDetails,
  onShare,
}: {
  item: Video;
  height: number;
  active: boolean;
  nearby: boolean;
  muted: boolean;
  favorite: boolean;
  onMute: () => void;
  onFavorite: () => void;
  onDetails: () => void;
  onShare: () => void;
}) {
  const p = item.property;
  return (
    <View style={[styles.card, { height }]}>
      {!!p.media[0] && (
        <Image
          source={{ uri: mediaUrl(p.media[0].url) }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      {nearby && <Player url={item.url} active={active} muted={muted} />}
      <View pointerEvents="none" style={styles.shade} />
      <View pointerEvents="none" style={styles.top}>
        <Text style={styles.badge}>
          {p.is_demo ? "EJEMPLO · DATOS FICTICIOS" : "RECORRIDO DE PROPIEDAD"}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            favorite ? "Quitar de favoritos" : "Guardar en favoritos"
          }
          onPress={onFavorite}
          style={styles.circle}
        >
          <Text style={styles.action}>{favorite ? "♥" : "♡"}</Text>
          <Text style={styles.small}>Guardar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compartir propiedad"
          onPress={onShare}
          style={styles.circle}
        >
          <Text style={styles.action}>↗</Text>
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
      <View style={styles.copy}>
        <Text style={styles.location}>
          {p.commune_name} · {p.region_name}
        </Text>
        <Text style={styles.price}>{price(p)}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {p.title}
        </Text>
        <Text style={styles.metrics}>
          {[
            p.bedrooms != null ? `${p.bedrooms} dorm.` : "",
            p.bathrooms != null ? `${p.bathrooms} baños` : "",
            p.built_area ? `${Number(p.built_area)} m²` : "",
          ]
            .filter(Boolean)
            .join("   ·   ")}
        </Text>
        <Text style={styles.caption} numberOfLines={2}>
          {item.title}
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
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: "#192d2d", overflow: "hidden" },
  shade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "48%",
    backgroundColor: "rgba(4,20,24,.65)",
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
    backgroundColor: "#172c32",
    borderRadius: 16,
  },
  white: { color: "white" },
  retry: { color: "#a9ead0", padding: 12, textAlign: "center" },
  top: { position: "absolute", top: 20, left: 20 },
  badge: {
    color: "#fff",
    fontSize: 10,
    letterSpacing: 1,
    backgroundColor: "#203e39dd",
    padding: 10,
    borderRadius: 20,
  },
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
  location: { fontSize: 12, color: "#d4ece5" },
  price: { fontSize: 28, fontWeight: "800", color: "#fff" },
  title: { fontSize: 23, fontWeight: "700", color: "#fff" },
  metrics: { fontSize: 12, color: "#edf4f0" },
  caption: { fontSize: 13, color: "#e3ece7", marginTop: 4 },
  button: {
    backgroundColor: "#d0f5a8",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  buttonText: { color: "#173427", fontWeight: "800" },
  hint: { fontSize: 10, color: "#c3d7ce" },
});
