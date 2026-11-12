import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { api, mediaUrl, Page, Session } from "./api";
import { ProfileVideo, VideoProfileData } from "./social-types";
import { SocialVideoActions } from "./SocialVideoActions";
import { SellerPanel } from "./SellerPanel";

function VideoThumbnail({ video }: { video: ProfileVideo }) {
  const [attempt, setAttempt] = useState(0);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (retry.current) clearTimeout(retry.current);
    },
    [],
  );
  const url = video.thumbnail_url;
  if (!url) return <View style={StyleSheet.absoluteFill} />;
  return (
    <Image
      key={attempt}
      source={{ uri: mediaUrl(url) }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      onError={() => {
        if (attempt < 8)
          retry.current = setTimeout(
            () => setAttempt((value) => value + 1),
            1500 + attempt * 700,
          );
      }}
    />
  );
}

type PropertyFavorite = { ids: string[]; toggle: (id: string) => void };

function FullVideoPlayer({
  video,
  active,
  session,
  onChanged,
  propertyFavorite,
}: {
  video: ProfileVideo;
  active: boolean;
  session: Session | null;
  onChanged: () => void;
  propertyFavorite?: PropertyFavorite;
}) {
  const [paused, setPaused] = useState(false),
    [foreground, setForeground] = useState(AppState.currentState === "active"),
    [error, setError] = useState("");
  const player = useVideoPlayer(
    { uri: mediaUrl(video.url), useCaching: true, contentType: "progressive" },
    (p) => {
      p.loop = true;
      p.muted = false;
      p.volume = 1;
      p.bufferOptions = {
        minBufferForPlayback: 0.75,
        preferredForwardBufferDuration: 8,
        maxBufferBytes: 8 * 1024 * 1024,
      };
    },
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) =>
      setForeground(s === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (active && foreground && !paused) player.play();
    else player.pause();
  }, [active, foreground, paused, player]);
  useEffect(() => {
    const sub = player.addListener("statusChange", (e) => {
      if (e.status === "error")
        setError(
          "No se pudo reproducir. Cierra y vuelve a abrir el video para renovar el acceso.",
        );
      else setError("");
    });
    return () => sub.remove();
  }, [player]);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityLabel={paused ? "Reproducir video" : "Pausar video"}
        style={StyleSheet.absoluteFill}
        onPress={() => setPaused((v) => !v)}
      >
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls={false}
          contentFit="contain"
          surfaceType="surfaceView"
        />
        {paused && <Text style={s.play}>▶</Text>}
      </Pressable>
      {!!error && <Text style={s.playerError}>{error}</Text>}
      <SocialVideoActions
        videoId={video.id}
        session={session}
        onChanged={onChanged}
        propertyFavorite={propertyFavorite}
        paused={paused}
        onResume={() => setPaused(false)}
      />
    </View>
  );
}
function FullVideo(props: {
  video: ProfileVideo;
  active: boolean;
  session: Session | null;
  onChanged: () => void;
  propertyFavorite?: PropertyFavorite;
}) {
  const own = props.video.created_by === props.session?.user.id;
  const [url, setUrl] = useState<string | null>(own ? null : props.video.url);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!own) return;
    let live = true;
    void api<{ url: string }>(`/manage/videos/${props.video.id}/preview`, {
      token: props.session?.access_token,
    })
      .then((r) => {
        if (live) setUrl(r.url);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [own, props.video.id, props.session?.access_token]);
  return url ? (
    <FullVideoPlayer {...props} video={{ ...props.video, url }} />
  ) : error ? (
    <Text style={s.playerError}>{error}</Text>
  ) : (
    <ActivityIndicator color="#0866f5" />
  );
}
export function VideoProfile({
  session,
  userId,
  onPropertiesChanged,
  pendingVideoId,
  propertyMode,
  initialSection,
  propertyFavorite,
}: {
  session: Session | null;
  userId?: string;
  onPropertiesChanged?: () => void;
  pendingVideoId?: string;
  propertyMode?: "new" | "link";
  initialSection?: "properties";
  propertyFavorite?: PropertyFavorite;
}) {
  const router = useRouter();
  const target = userId || session?.user.id;
  const own = target === session?.user.id;
  const token = session?.access_token;
  const [videosRefresh, refreshQuota] = useState(0);
  const [quota, setQuota] = useState<{
    plan: "free" | "basic" | "pro";
    video_limit: number | null;
    video_used: number;
  } | null>(null);
  useEffect(() => {
    if (!own || !token) return;
    const controller = new AbortController();
    void api<typeof quota>("/me/publication-allowance", {
      token,
      signal: controller.signal,
    })
      .then(setQuota)
      .catch(() => {});
    return () => controller.abort();
  }, [own, token, videosRefresh]);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followers, setFollowers] = useState<
    { id: string; display_name: string; avatar_url?: string | null }[]
  >([]);
  const [followersPage, setFollowersPage] = useState(1);
  const [followersMore, setFollowersMore] = useState(false);
  const [relation, setRelation] = useState<"followers" | "following">(
    "followers",
  );
  const [relationSearch, setRelationSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  async function showFollowers(
    next = 1,
    direction = relation,
    query = relationSearch,
  ) {
    if (!target || busy) return;
    setRelation(direction);
    if (next === 1) {
      setAppliedSearch(query);
      setFollowers([]);
      setFollowersMore(false);
      setFollowersOpen(true);
    }
    await run(async () => {
      const result = await api<{ items: typeof followers; has_more: boolean }>(
        `/video-profiles/${target}/${direction}?page=${next}&q=${encodeURIComponent(query)}`,
      );
      setFollowers((previous) =>
        next === 1 ? result.items : [...previous, ...result.items],
      );
      setFollowersPage(next);
      setFollowersMore(result.has_more);
    });
  }
  const [profile, setProfile] = useState<VideoProfileData | null>(null),
    [videos, setVideos] = useState<ProfileVideo[]>([]),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [section, setSection] = useState<"videos" | "saved" | "properties">(
    pendingVideoId || initialSection === "properties" ? "properties" : "videos",
  );
  const [viewer, setViewer] = useState<number | null>(null),
    [active, setActive] = useState(0),
    [height, setHeight] = useState(1);
  const [editProfile, setEditProfile] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null),
    [title, setTitle] = useState(""),
    [uploadId, setUploadId] = useState("");
  const [changed, setChanged] = useState(false);
  const load = useCallback(
    async (next = 1, signal?: AbortSignal) => {
      if (!target) return;
      setLoading(true);
      setError("");
      try {
        const [p, r] = await Promise.all([
          api<VideoProfileData>(`/video-profiles/${target}`, { token, signal }),
          api<Page<ProfileVideo>>(
            `/video-profiles/${target}/videos?page=${next}${section === "saved" ? "&saved=true" : ""}`,
            { token, signal },
          ),
        ]);
        if (signal?.aborted) return;
        setProfile(p);
        setVideos((old) =>
          next === 1
            ? r.items
            : [
                ...old,
                ...r.items.filter((v) => !old.some((x) => x.id === v.id)),
              ],
        );
        setPage(r.page);
        setPages(r.pages);
      } catch (e) {
        if (!signal?.aborted) setError((e as Error).message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [target, token, section],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(1, controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const button = (label: string, fn: () => void, secondary = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={fn}
      style={[s.button, secondary && s.secondary]}
    >
      <Text style={[s.buttonText, secondary && s.light]}>{label}</Text>
    </Pressable>
  );
  async function choosePhoto() {
    await run(async () => {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (r.canceled) return;
      const fd = new FormData();
      fd.append("file", new File(r.assets[0].uri));
      const media = await api<{ id: string }>("/manage/media", {
        method: "POST",
        token,
        body: fd,
      });
      setProfile(
        await api("/me/video-profile", {
          method: "POST",
          token,
          body: {
            display_name: profile?.display_name,
            avatar_media_id: media.id,
          },
        }),
      );
    });
  }
  async function pickVideo() {
    await run(async () => {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });
      if (r.canceled) return;
      const file = r.assets[0];
      if ((file.fileSize || 0) > 50 * 1024 * 1024)
        throw Error("Selecciona un MP4 de hasta 50 MB.");
      setAsset(file);
      setTitle("Mi nuevo video");
      setUploadId(randomUUID());
    });
  }
  async function upload() {
    if (!asset || !title.trim()) return;
    await run(async () => {
      const fd = new FormData();
      fd.append("file", new File(asset.uri));
      fd.append("title", title);
      fd.append("request_id", uploadId);
      const result = await api<{ id: string }>("/manage/videos", {
        method: "POST",
        token,
        body: fd,
      });
      if (!result.id)
        throw Error("No se confirmó el guardado. Puedes reintentar.");
      setAsset(null);
      refreshQuota((n) => n + 1);
      await load();
      Alert.alert(
        "Video guardado",
        "Está en tu galería como borrador. Puedes publicarlo o vincularlo después a una propiedad.",
      );
    });
  }
  function closeViewer() {
    setViewer(null);
    if (changed) {
      setChanged(false);
      void load();
      onPropertiesChanged?.();
    }
  }
  if (!target)
    return (
      <View style={[s.root, s.center]}>
        <Text style={s.title}>Tu perfil de videos</Text>
        <Text style={s.muted}>
          Crea tu cuenta para grabar, guardar y compartir tus historias.
        </Text>
        {button("Ingresar a mi cuenta", () => router.push("/cuenta"))}
      </View>
    );
  const header = (
    <View style={s.header}>
      {userId && button("← Volver", () => router.back(), true)}
      <View style={s.topline}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={own ? "Cambiar foto de perfil" : "Foto de perfil"}
          disabled={!own || busy}
          onPress={() => void choosePhoto()}
          style={s.avatarWrap}
        >
          {profile?.avatar_url ? (
            <Image
              fadeDuration={0}
              source={{ uri: mediaUrl(profile.avatar_url) }}
              style={s.avatar}
            />
          ) : (
            <View style={s.avatar}>
              <Text style={s.initial}>
                {profile?.display_name.slice(0, 1) || "P"}
              </Text>
            </View>
          )}
          {own && (
            <View style={s.camera}>
              <Text>✎</Text>
            </View>
          )}
        </Pressable>
        <Text numberOfLines={1} style={[s.title, { flex: 1 }]}>
          {profile?.display_name || "Tu perfil"}
        </Text>
        {own && (
          <Pressable
            accessibilityLabel="Editar nombre de perfil"
            onPress={() => {
              setName(profile?.display_name || "");
              setEditProfile(true);
            }}
          >
            <Text style={s.gear}>✎</Text>
          </Pressable>
        )}
      </View>
      <View style={s.counters}>
        {(
          [
            [profile?.following || 0, "Siguiendo"],
            [profile?.followers || 0, "Seguidores"],
            [profile?.likes || 0, "Me gusta"],
          ] as const
        ).map(([n, label]) => (
          <Pressable
            key={label}
            style={s.counter}
            disabled={label === "Me gusta" || busy}
            accessibilityRole={label !== "Me gusta" ? "button" : undefined}
            onPress={() => {
              setRelationSearch("");
              void showFollowers(
                1,
                label === "Siguiendo" ? "following" : "followers",
                "",
              );
            }}
          >
            <Text style={s.counterNumber}>{n}</Text>
            <Text style={s.muted}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {own ? (
        <View style={s.row}>
          {button("＋ Grabar", () => router.push("/grabar"))}
          {button("Subir video", () => void pickVideo(), true)}
        </View>
      ) : (
        session &&
        button(
          profile?.followed ? "Siguiendo" : "Seguir",
          () =>
            void run(async () => {
              setProfile(
                await api(`/video-profiles/${target}/follow`, {
                  method: "POST",
                  token,
                  body: { active: !profile?.followed },
                }),
              );
            }),
        )
      )}
      {own && (
        <Text style={s.explainer}>
          Tus videos primero. Vincular una propiedad es opcional.
        </Text>
      )}
      {!own &&
        profile &&
        button(
          "Enviar mensaje",
          () =>
            router.push({
              pathname: "/mensajes",
              params: { recipientId: profile.id },
            }),
          true,
        )}
      {error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {busy && <ActivityIndicator color="#0866f5" />}
      <View style={s.tabs}>
        {(
          ["videos", ...(own ? ["saved", "properties"] : [])] as (
            | "videos"
            | "saved"
            | "properties"
          )[]
        ).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === k }}
            onPress={() => setSection(k)}
            style={[s.tab, section === k && s.selectedTab]}
          >
            <Text style={s.light}>
              {k === "videos"
                ? "▦ Videos"
                : k === "saved"
                  ? "▢ Guardados"
                  : "⌂ Propiedades"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
  return (
    <View style={s.root}>
      <Modal
        visible={followersOpen}
        animationType="slide"
        onRequestClose={() => setFollowersOpen(false)}
      >
        <View style={[s.root, { paddingTop: 36, paddingHorizontal: 16 }]}>
          <View style={[s.row, { alignItems: "center" }]}>
            {button("← Volver", () => setFollowersOpen(false), true)}
            <Text style={s.title} numberOfLines={1}>
              {profile?.display_name}
            </Text>
          </View>
          <View style={s.tabs}>
            {(["followers", "following"] as const).map((kind) => (
              <Pressable
                key={kind}
                disabled={busy}
                accessibilityRole="tab"
                accessibilityState={{ selected: relation === kind }}
                style={[s.tab, relation === kind && s.selectedTab]}
                onPress={() => {
                  setRelationSearch("");
                  void showFollowers(1, kind, "");
                }}
              >
                <Text style={s.light}>
                  {kind === "followers"
                    ? `${profile?.followers ?? 0} seguidores`
                    : `${profile?.following ?? 0} siguiendo`}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[s.row, { alignItems: "center", marginVertical: 10 }]}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              accessibilityLabel="Buscar usuario"
              placeholder="Buscar usuario"
              placeholderTextColor="#49658b"
              value={relationSearch}
              onChangeText={setRelationSearch}
              onSubmitEditing={() => void showFollowers()}
              returnKeyType="search"
            />
            {button("Buscar", () => void showFollowers(), true)}
          </View>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <FlatList
            keyboardDismissMode="none"
            data={followers}
            keyExtractor={(person) => person.id}
            keyboardShouldPersistTaps="always"
            renderItem={({ item: person }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver perfil de ${person.display_name}`}
                style={[s.row, { alignItems: "center", paddingVertical: 10 }]}
                onPress={() => {
                  setFollowersOpen(false);
                  router.push({
                    pathname: "/perfil/[userId]",
                    params: { userId: person.id },
                  });
                }}
              >
                {person.avatar_url ? (
                  <Image
                    fadeDuration={0}
                    source={{ uri: mediaUrl(person.avatar_url) }}
                    style={s.avatar}
                  />
                ) : (
                  <View style={s.avatar}>
                    <Text style={s.initial}>
                      {person.display_name.slice(0, 1)}
                    </Text>
                  </View>
                )}
                <Text style={[s.light, { flex: 1 }]}>
                  {person.display_name}
                </Text>
                <Text style={s.muted}>Ver perfil ›</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              !busy && !error ? (
                <Text style={s.muted}>No se encontraron usuarios.</Text>
              ) : undefined
            }
            ListFooterComponent={
              busy ? (
                <ActivityIndicator />
              ) : followersMore ? (
                button(
                  "Cargar más",
                  () =>
                    void showFollowers(
                      followersPage + 1,
                      relation,
                      appliedSearch,
                    ),
                  true,
                )
              ) : undefined
            }
          />
        </View>
      </Modal>
      {own && quota && (
        <Text style={[s.muted, { paddingHorizontal: 16, paddingVertical: 8 }]}>
          {quota.plan === "free"
            ? "Gratis"
            : quota.plan === "basic"
              ? "Básico"
              : "Pro"}{" "}
          ·{" "}
          {quota.video_limit === null
            ? "Videos ilimitados"
            : `${quota.video_used}/${quota.video_limit} videos`}
        </Text>
      )}
      {section === "properties" && session ? (
        <ScrollView>
          {header}
          <SellerPanel
            session={session}
            pendingVideoId={pendingVideoId}
            propertyMode={propertyMode}
            onRecordFirst={() => router.push("/grabar")}
            onChanged={() => onPropertiesChanged?.()}
          />
        </ScrollView>
      ) : (
        <FlatList
          key={section}
          keyboardShouldPersistTaps="always"
          data={videos}
          numColumns={3}
          keyExtractor={(v) => v.id}
          ListHeaderComponent={header}
          initialNumToRender={9}
          maxToRenderPerBatch={6}
          windowSize={3}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={loading && page > 0}
              onRefresh={() => void load()}
              tintColor="#0866f5"
            />
          }
          onEndReached={() => {
            if (!loading && page < pages) void load(page + 1);
          }}
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reproducir ${item.title}`}
              onPress={() => {
                setActive(index);
                setViewer(index);
              }}
              style={s.tile}
            >
              {viewer === null && <VideoThumbnail video={item} />}
              <View style={s.tileShade} />
              <Text style={s.tileTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={s.tileMeta}>
                ♥ {item.likes} {item.status === "draft" ? " · Borrador" : ""}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={s.center}>
                <Text style={s.muted}>
                  {section === "saved"
                    ? "Todavía no guardaste videos."
                    : "Tu galería está lista para tu primer video."}
                </Text>
              </View>
            ) : (
              <ActivityIndicator color="#0866f5" />
            )
          }
          ListFooterComponent={
            loading && page > 0 ? (
              <ActivityIndicator color="#0866f5" />
            ) : (
              <View style={{ height: 24 }} />
            )
          }
        />
      )}
      <Modal
        visible={viewer !== null}
        animationType="slide"
        onRequestClose={closeViewer}
      >
        <View
          style={s.viewer}
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        >
          <StatusBar style="light" />
          {viewer !== null && height > 1 && (
            <FlatList
              data={videos}
              keyExtractor={(v) => v.id}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              initialScrollIndex={viewer}
              pagingEnabled
              snapToInterval={height}
              decelerationRate="fast"
              getItemLayout={(_, i) => ({
                index: i,
                length: height,
                offset: i * height,
              })}
              onMomentumScrollEnd={(e) =>
                setActive(Math.round(e.nativeEvent.contentOffset.y / height))
              }
              initialNumToRender={1}
              windowSize={3}
              renderItem={({ item, index }) => (
                <View style={{ height, backgroundColor: "#000" }}>
                  {index === active && (
                    <FullVideo
                      key={item.id}
                      video={item}
                      active
                      session={session}
                      onChanged={() => {
                        setChanged(true);
                        refreshQuota((n) => n + 1);
                      }}
                      propertyFavorite={propertyFavorite}
                    />
                  )}
                </View>
              )}
            />
          )}
          <Pressable
            style={s.close}
            accessibilityLabel="Cerrar video"
            onPress={closeViewer}
          >
            <Text style={[s.light, { color: "#fff" }]}>← Perfil</Text>
          </Pressable>
        </View>
      </Modal>
      <Modal
        visible={editProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setEditProfile(false)}
      >
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.title}>Editar perfil</Text>
            <TextInput
              accessibilityLabel="Nombre del perfil"
              value={name}
              onChangeText={setName}
              maxLength={100}
              style={s.input}
            />
            {button(
              "Guardar",
              () =>
                void run(async () => {
                  setProfile(
                    await api("/me/video-profile", {
                      method: "POST",
                      token,
                      body: { display_name: name },
                    }),
                  );
                  setEditProfile(false);
                }),
            )}
            {button("Cancelar", () => setEditProfile(false), true)}
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!asset}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setAsset(null);
        }}
      >
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.title}>Nuevo video</Text>
            <Text style={s.muted}>No necesitas elegir una propiedad.</Text>
            <TextInput
              accessibilityLabel="Título del video"
              value={title}
              onChangeText={setTitle}
              style={s.input}
              maxLength={160}
            />
            {button(
              busy ? "Subiendo…" : "Guardar video en mi galería",
              () => void upload(),
            )}
            {error && <Text style={s.error}>{error}</Text>}
            {button("Cancelar", () => setAsset(null), true)}
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: "center",
    gap: 8,
  },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
  },
  title: { color: "#10376b", fontSize: 24, fontWeight: "800" },
  gear: { color: "#0866f5", fontSize: 25, padding: 8 },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#edf4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: "#0866f5", fontSize: 20, fontWeight: "800" },
  camera: {
    position: "absolute",
    bottom: 0,
    right: -2,
    backgroundColor: "#0866f5",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: { color: "#10376b", fontWeight: "600" },
  counters: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingVertical: 4,
  },
  counter: { alignItems: "center", gap: 4 },
  counterNumber: { color: "#10376b", fontSize: 22, fontWeight: "800" },
  muted: { color: "#49658b", fontSize: 13 },
  explainer: { color: "#49658b", fontSize: 12, textAlign: "center" },
  row: { flexDirection: "row", gap: 10 },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#0866f5",
    marginVertical: 3,
    minHeight: 46,
  },
  secondary: {
    backgroundColor: "#edf4ff",
    borderWidth: 1,
    borderColor: "#d3e0f2",
  },
  buttonText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  light: { color: "#10376b", fontWeight: "600" },
  tabs: {
    flexDirection: "row",
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#d3e0f2",
  },
  tab: { flex: 1, paddingVertical: 16, alignItems: "center" },
  selectedTab: { borderBottomColor: "#0866f5", borderBottomWidth: 3 },
  tile: {
    flex: 1 / 3,
    aspectRatio: 0.7,
    backgroundColor: "#edf4ff",
    margin: 1,
    overflow: "hidden",
  },
  tileShade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0003",
  },
  tileTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 25,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  tileMeta: {
    position: "absolute",
    left: 8,
    bottom: 7,
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  center: { padding: 28, gap: 20, alignItems: "center" },
  viewer: { flex: 1, backgroundColor: "#000" },
  close: {
    position: "absolute",
    top: 42,
    left: 16,
    padding: 12,
    backgroundColor: "#0008",
    borderRadius: 20,
  },
  play: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    color: "#fff",
    fontSize: 60,
  },
  playerError: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    color: "#ffb8ab",
    backgroundColor: "#401b21",
    padding: 16,
  },
  error: { color: "#a12b36", padding: 12 },
  overlay: {
    flex: 1,
    backgroundColor: "#0009",
    justifyContent: "center",
    padding: 25,
  },
  dialog: {
    backgroundColor: "#edf4ff",
    borderRadius: 22,
    padding: 22,
    gap: 14,
  },
  input: {
    backgroundColor: "#edf4ff",
    color: "#10376b",
    padding: 14,
    borderRadius: 10,
  },
});
