import { VideoCover } from "./VideoCover";
import { VideoSurface, DelayedVideoSpinner } from "./VideoSurface";
import { preferredVideoUrl } from "./video-source";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { VideoPlayer } from "expo-video";
import { Video, Session } from "./api";
import { videoColors } from "./video-colors";
import { videoIcons } from "./video-icons";
import { SocialVideoActions } from "./SocialVideoActions";

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
      <VideoCover
        url={item.thumbnail_url || p?.media[0]?.url}
        preview={item.thumbnail_preview}
        fit="cover"
      />
      {player && (
        <VideoSurface
          key={item.id}
          url={preferredVideoUrl(item)}
          player={player}
          active={active}
          paused={paused}
          onPause={() => setPaused((value) => !value)}
        />
      )}
      {!player && <DelayedVideoSpinner waiting={active} />}
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
          initialCreator={item.creator}
          initialTitle={item.title}
          initiallyPublished
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
