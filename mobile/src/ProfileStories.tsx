import { ReactNode, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  Text,
  View,
  ActivityIndicator,
  AppState,
  ScrollView,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { api, mediaUrl, Session } from "./api";
import { playbackSource } from "./video-source";
type Story = {
  id: string;
  kind: "image" | "video";
  url?: string;
  video?: { url: string; hls_url?: string };
};
function StoryVideo({ story, next }: { story: Story; next: () => void }) {
  const player = useVideoPlayer(
    playbackSource(story.video!.hls_url || story.video!.url),
    (p) => {
      p.loop = false;
      p.play();
    },
  );
  useEffect(() => {
    const done = player.addListener("playToEnd", next);
    return () => done.remove();
  }, [player, next]);
  return (
    <VideoView
      player={player}
      style={{ flex: 1 }}
      contentFit="contain"
      nativeControls={false}
    />
  );
}
export function ProfileStories({
  userId,
  session,
  own,
  children,
  videos,
}: {
  userId: string;
  session: Session | null;
  own: boolean;
  children: ReactNode;
  videos: { id: string; title: string; status: string }[];
}) {
  const [items, setItems] = useState<Story[]>([]),
    [open, setOpen] = useState(false),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false),
    [pick, setPick] = useState(false),
    [error, setError] = useState("");
  const token = session?.access_token;
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") setOpen(false);
    });
    return () => listener.remove();
  }, []);
  const load = async () => {
    if (!token) return [];
    const data = await api<{ items: Story[] }>(
      `/video-profiles/${userId}/stories`,
      { token },
    );
    setItems(data.items);
    return data.items;
  };
  useEffect(() => {
    let live = true;
    if (token)
      void api<{ items: Story[] }>(`/video-profiles/${userId}/stories`, {
        token,
      })
        .then((d) => {
          if (live) setItems(d.items);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId, token]);
  const next = () => {
    if (index + 1 < items.length) setIndex(index + 1);
    else setOpen(false);
  };
  useEffect(() => {
    if (!open || !items[index]) return;
    const timer = setTimeout(
      () => {
        if (index + 1 < items.length) setIndex(index + 1);
        else setOpen(false);
      },
      items[index].kind === "video" ? 15000 : 5000,
    );
    return () => clearTimeout(timer);
  }, [open, index, items]);
  const create = async (body: { media_id?: string; video_id?: string }) => {
    await api("/me/stories", { method: "POST", token, body });
    await load();
    setIndex(0);
    setOpen(true);
  };
  const photo = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const chosen = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (chosen.canceled) return;
      const form = new FormData();
      form.append("file", new File(chosen.assets[0].uri));
      const media = await api<{ id: string }>("/manage/media", {
        method: "POST",
        token,
        body: form,
      });
      await create({ media_id: media.id });
    } catch (e) {
      Alert.alert("No se pudo agregar la historia", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const add = () =>
    Alert.alert("Agregar historia", "Visible durante 24 horas.", [
      { text: "Foto", onPress: () => void photo() },
      { text: "Video publicado", onPress: () => setPick(true) },
      { text: "Cancelar", style: "cancel" },
    ]);
  return (
    <View style={{ position: "relative" }}>
      <Pressable
        accessibilityLabel="Ver historias del perfil"
        accessibilityRole="button"
        onPress={() => {
          if (busy) return;
          if (!token) {
            Alert.alert("Historias", "Inicia sesión para ver historias.");
            return;
          }
          setBusy(true);
          setError("");
          void load()
            .then((list) => {
              if (list.length) {
                setIndex(0);
                setOpen(true);
              } else if (own) add();
              else
                Alert.alert(
                  "Historias",
                  "Este perfil no tiene historias activas.",
                );
            })
            .catch((e) => Alert.alert("Historias", e.message))
            .finally(() => setBusy(false));
        }}
        style={{
          borderWidth: items.length ? 3 : 1,
          borderColor: items.length ? "#05b9e7" : "#d8e5f5",
          borderRadius: 60,
          padding: 3,
        }}
      >
        {children}
      </Pressable>
      {own && (
        <Pressable
          accessibilityLabel="Agregar historia"
          onPress={add}
          style={{
            position: "absolute",
            bottom: 0,
            right: -2,
            width: 27,
            height: 27,
            borderRadius: 14,
            backgroundColor: "#0866f5",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 23 }}>+</Text>
        </Pressable>
      )}
      {busy && (
        <ActivityIndicator
          style={{ position: "absolute", top: 25, left: 25 }}
          color="#05b9e7"
        />
      )}
      <Modal
        visible={pick}
        animationType="slide"
        onRequestClose={() => setPick(false)}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            backgroundColor: "#fff",
            padding: 24,
            paddingTop: 50,
            gap: 12,
          }}
        >
          <Pressable onPress={() => setPick(false)}>
            <Text style={{ color: "#0866f5", padding: 12 }}>Cerrar ×</Text>
          </Pressable>
          <Text style={{ fontSize: 22, color: "#071c55", fontWeight: "700" }}>
            Compartir video como historia
          </Text>
          {videos
            .filter((v) => v.status === "published")
            .map((v) => (
              <Pressable
                key={v.id}
                disabled={busy}
                onPress={() => {
                  setBusy(true);
                  void create({ video_id: v.id })
                    .then(() => setPick(false))
                    .catch((e) => setError(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                <Text style={{ color: "#071c55", padding: 14 }}>{v.title}</Text>
              </Pressable>
            ))}
          {!videos.some((v) => v.status === "published") && (
            <Text>Primero publica un video en tu perfil.</Text>
          )}
          <Text style={{ color: "#a22" }}>{error}</Text>
        </ScrollView>
      </Modal>
      <Modal
        visible={open}
        onRequestClose={() => setOpen(false)}
        animationType="fade"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000",
            paddingTop: 45,
            paddingBottom: 25,
          }}
        >
          <View style={{ flexDirection: "row", gap: 4, padding: 12 }}>
            {items.map((item, i) => (
              <View
                key={item.id}
                style={{
                  flex: 1,
                  height: 3,
                  backgroundColor: i <= index ? "#fff" : "#555",
                }}
              />
            ))}
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingBottom: 10,
            }}
          >
            <Text style={{ color: "#fff" }}>
              Historia · {index + 1}/{items.length}
            </Text>
            <Pressable
              accessibilityLabel="Cerrar historias"
              onPress={() => setOpen(false)}
            >
              <Text style={{ color: "#fff", fontSize: 26 }}>×</Text>
            </Pressable>
          </View>
          {open &&
            items[index] &&
            (items[index].kind === "video" ? (
              <StoryVideo
                key={items[index].id}
                story={items[index]}
                next={next}
              />
            ) : (
              <Image
                source={{ uri: mediaUrl(items[index].url!) }}
                style={{ flex: 1 }}
                resizeMode="contain"
              />
            ))}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              padding: 18,
            }}
          >
            <Pressable onPress={() => setIndex(Math.max(0, index - 1))}>
              <Text style={{ color: "#fff", padding: 10 }}>Anterior</Text>
            </Pressable>
            {own && (
              <Pressable
                onPress={() => {
                  const id = items[index]?.id;
                  if (!id) return;
                  void api(`/me/stories/${id}`, { method: "DELETE", token })
                    .then(() => {
                      setOpen(false);
                      return load();
                    })
                    .catch((e) => Alert.alert("Historias", e.message));
                }}
              >
                <Text style={{ color: "#fff", padding: 10 }}>Eliminar</Text>
              </Pressable>
            )}
            <Pressable onPress={next}>
              <Text style={{ color: "#fff", padding: 10 }}>Siguiente</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
