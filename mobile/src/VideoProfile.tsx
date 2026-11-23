import { brandColors } from "./brand-colors";
import { ProfileStories } from "./ProfileStories";
import { useNightStyles } from "./appearance";
import { ProppixIcon } from "./ProppixIcon";
import { clampVideoOffset, enteringVideoIndex } from "./video-paging";
import { rememberFollowState } from "./follow-state";
import { beginVideoLoad, videoSourceReady } from "./playback-metrics";
import { VideoCover } from "./VideoCover";
import { VideoSurface, DelayedVideoSpinner } from "./VideoSurface";
import {
  ProfileIdentityFields,
  ProfileIdentityDraft,
  emptyProfileIdentity,
  identityComplete,
} from "./ProfileIdentityFields";
import { KeyboardSafeView } from "./KeyboardSafeView";
import {
  hlsUnavailable,
  playbackBuffer,
  configureVideoBuffer,
} from "./video-playback-policy";
import { ModerationActions } from "./ModerationActions";
import { playbackSource, preferredVideoUrl } from "./video-source";
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
import { useRouter, usePreventRemove } from "expo-router";
import {
  uploadVideo,
  type VideoUploadProgress as UploadProgress,
} from "./video-upload";
import { VideoUploadProgress } from "./VideoUploadProgress";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { api, ApiError, mediaUrl, Page, Session } from "./api";
import { ProfileVideo, VideoProfileData } from "./social-types";
import { SocialVideoActions } from "./SocialVideoActions";
import { SellerPanel } from "./SellerPanel";

function VideoThumbnail({ video }: { video: ProfileVideo }) {
  return (
    <VideoCover
      url={video.thumbnail_url}
      preview={video.thumbnail_preview}
      fit="cover"
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
  initialCommentId,
}: {
  video: ProfileVideo;
  active: boolean;
  session: Session | null;
  onChanged: () => void;
  propertyFavorite?: PropertyFavorite;
  initialCommentId?: string;
}) {
  const [paused, setPaused] = useState(false),
    [foreground, setForeground] = useState(AppState.currentState === "active");
  const fallbackUsed = useRef(false);
  const player = useVideoPlayer(
    playbackSource(preferredVideoUrl(video)),
    (p) => {
      beginVideoLoad(p);
      p.loop = true;
      p.muted = false;
      p.volume = 1;
      p.bufferOptions = playbackBuffer(active);
    },
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) =>
      setForeground(s === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    configureVideoBuffer(player, active);
  }, [active, player]);
  useEffect(() => {
    const sub = player.addListener("statusChange", (e) => {
      if (
        e.status === "error" &&
        video.hls_url &&
        !fallbackUsed.current &&
        hlsUnavailable(e.error?.message)
      ) {
        fallbackUsed.current = true;
        void player.replaceAsync(playbackSource(video.url)).catch(() => {});
        return;
      }
      if (e.status === "readyToPlay") {
        videoSourceReady(player);
      }
    });
    return () => sub.remove();
  }, [player, video.hls_url, video.url]);
  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoSurface
        player={player}
        url={preferredVideoUrl(video)}
        active={active && foreground}
        paused={paused}
        onPause={() => setPaused((value) => !value)}
      />
      <SocialVideoActions
        videoId={video.id}
        initialCreator={video.creator}
        initiallyPublished={video.status === "published"}
        initialTitle={video.title}
        session={session}
        onChanged={onChanged}
        propertyFavorite={propertyFavorite}
        paused={paused}
        onResume={() => setPaused(false)}
        initialCommentId={initialCommentId}
      />
    </View>
  );
}
export function FullVideo(props: {
  video: ProfileVideo;
  active: boolean;
  session: Session | null;
  onChanged: () => void;
  propertyFavorite?: PropertyFavorite;
  initialCommentId?: string;
}) {
  const own = props.video.created_by === props.session?.user.id;
  const [url, setUrl] = useState<string | null>(own ? null : props.video.url);
  const [hlsUrl, setHlsUrl] = useState(props.video.hls_url);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!own) return;
    let live = true;
    void api<{ url: string; hls_url?: string | null }>(
      `/manage/videos/${props.video.id}/preview`,
      {
        token: props.session?.access_token,
      },
    )
      .then((r) => {
        if (live) {
          setUrl(r.url);
          setHlsUrl(r.hls_url);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [own, props.video.id, props.session?.access_token]);
  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoCover
        url={props.video.thumbnail_url}
        preview={props.video.thumbnail_preview}
      />
      {url ? (
        <FullVideoPlayer
          {...props}
          video={{ ...props.video, url, hls_url: hlsUrl }}
        />
      ) : error ? (
        <Text style={baseStyles.playerError}>{error}</Text>
      ) : (
        <DelayedVideoSpinner waiting={props.active} />
      )}
    </View>
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
  const s = useNightStyles(baseStyles);
  const router = useRouter();
  const target = userId || session?.user.id;
  const own = target === session?.user.id;
  const token = session?.access_token;
  const [videosRefresh, refreshQuota] = useState(0);
  const [, setQuota] = useState<{
    plan: "free" | "basic" | "pro";
    video_limit: number | null;
    video_used: number;
  } | null>(null);
  useEffect(() => {
    if (!own || !token) return;
    const controller = new AbortController();
    void api<{
      plan: "free" | "basic" | "pro";
      video_limit: number | null;
      video_used: number;
    } | null>("/me/publication-allowance", {
      token,
      signal: controller.signal,
    })
      .then(setQuota)
      .catch(() => {});
    return () => controller.abort();
  }, [own, token, videosRefresh]);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followers, setFollowers] = useState<
    {
      id: string;
      display_name: string;
      avatar_url?: string | null;
      avatar_thumbnail_url?: string | null;
    }[]
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
        { token },
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
    [videoCount, setVideoCount] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [section, setSection] = useState<"videos" | "saved" | "properties">(
    pendingVideoId || initialSection === "properties" ? "properties" : "videos",
  );
  const [viewer, setViewer] = useState<number | null>(null),
    [active, setActive] = useState(0),
    [height, setHeight] = useState(1);
  const viewerList = useRef<FlatList<ProfileVideo>>(null),
    viewerDragIndex = useRef(0),
    viewerDragging = useRef(false);
  const [editProfile, setEditProfile] = useState(false),
    [identity, setIdentity] =
      useState<ProfileIdentityDraft>(emptyProfileIdentity),
    [busy, setBusy] = useState(false);
  const identityPrompted = useRef<string | null>(null);
  useEffect(() => {
    if (
      !own ||
      !profile ||
      profile.id !== target ||
      profile.identity_configured !== false ||
      identityPrompted.current === target
    )
      return;
    const timer = setTimeout(() => {
      identityPrompted.current = target;
      setIdentity({
        profile_kind: profile.profile_kind || null,
        username: profile.username || "",
        display_name: profile.display_name,
      });
      setEditProfile(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [own, profile, target]);
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null),
    [title, setTitle] = useState(""),
    [uploadId, setUploadId] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );
  const [uploadAttempt, setUploadAttempt] = useState(false);
  const uploadLock = useRef(false);
  const releaseUploadGuard = usePreventRemove(uploadProgress !== null);
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
        rememberFollowState(session?.user.id, p.id, p.followed);
        setProfile(p);
        setVideos((old) =>
          next === 1
            ? r.items
            : [
                ...old,
                ...r.items.filter((v) => !old.some((x) => x.id === v.id)),
              ],
        );
        if (section === "videos") setVideoCount(r.total);
        setPage(r.page);
        setPages(r.pages);
      } catch (e) {
        if (!signal?.aborted) setError((e as Error).message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [target, token, section, session, setProfile],
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
      fd.append("purpose", "avatar");
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
      setUploadAttempt(false);
    });
  }
  async function upload() {
    if (!asset || !title.trim() || busy || uploadLock.current) return;
    uploadLock.current = true;
    try {
      await run(async () => {
        setUploadAttempt(true);
        setUploadProgress({ phase: "connecting", sent: 0, total: 0 });
        const result = await uploadVideo<{ upload_id: string }>({
          path: "/manage/video-uploads",
          uri: asset.uri,
          token: token!,
          parameters: { title, request_id: uploadId },
          onProgress: setUploadProgress,
        }).catch((error: unknown) => {
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![408, 409, 429].includes(error.status)
          )
            setUploadAttempt(false);
          throw error;
        });
        if (!result.upload_id)
          throw Error("No se confirmó la carga. Puedes reintentar.");
        setUploadProgress(null);
        releaseUploadGuard();
        setAsset(null);
        setUploadAttempt(false);
        router.push({
          pathname: "/carga-video/[uploadId]",
          params: { uploadId: result.upload_id },
        });
      });
    } finally {
      uploadLock.current = false;
      setUploadProgress(null);
    }
  }
  function closeUpload() {
    if (busy || uploadLock.current) return;
    const close = () => {
      setAsset(null);
      setUploadAttempt(false);
    };
    if (uploadAttempt)
      Alert.alert(
        "¿Cerrar la carga?",
        "La última carga no se confirmó. Revisa Mis videos antes de volver a subirlo.",
        [
          { text: "Seguir aquí", style: "cancel" },
          { text: "Cerrar", onPress: close },
        ],
      );
    else close();
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
  const sectionTabs = (
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
          <ProppixIcon
            name={
              k === "videos" ? "video" : k === "saved" ? "bookmark" : "house"
            }
            size={20}
            color={section === k ? s.kindBadge.color : s.light.color}
          />
          <Text
            style={[s.light, section === k && { color: s.kindBadge.color }]}
          >
            {k === "videos"
              ? `Videos (${videoCount})`
              : k === "saved"
                ? "Guardados"
                : "Propiedades"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  const header =
    section === "properties" ? (
      <View style={{ paddingHorizontal: 16 }}>{sectionTabs}</View>
    ) : (
      <View style={s.header}>
        <View
          style={{
            flexDirection: "row",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            accessibilityLabel="Volver"
            onPress={() => router.back()}
            style={{ padding: 8 }}
          >
            <Text style={[s.light, { fontSize: 20 }]}>
              ‹{" "}
              <Text style={{ fontSize: 16 }}>
                @{profile?.username || "perfil"}
              </Text>
            </Text>
          </Pressable>
          {own && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir agenda de visitas"
                onPress={() => router.push("/visitas")}
                style={s.editButton}
              >
                <ProppixIcon name="calendar" color={s.light.color} size={22} />
              </Pressable>
              <Pressable
                accessibilityLabel="Editar perfil"
                onPress={() => {
                  setIdentity({
                    profile_kind: profile?.profile_kind || null,
                    username: profile?.username || "",
                    display_name: profile?.display_name || "",
                  });
                  setEditProfile(true);
                }}
                style={s.editButton}
              >
                <Text style={s.light}>Editar perfil</Text>
              </Pressable>
            </View>
          )}
        </View>
        <View style={s.topline}>
          {target && (
            <ProfileStories
              key={`${target}:${session?.user.id || "guest"}`}
              userId={target}
              session={session}
              own={own}
              videos={videos}
            >
              {profile?.avatar_thumbnail_url || profile?.avatar_url ? (
                <Image
                  fadeDuration={0}
                  source={{
                    uri: mediaUrl(
                      profile!.avatar_thumbnail_url || profile!.avatar_url!,
                    ),
                  }}
                  style={s.avatar}
                />
              ) : (
                <View style={s.avatar}>
                  <Text style={s.initial}>
                    {profile?.display_name.slice(0, 1) || "P"}
                  </Text>
                </View>
              )}
            </ProfileStories>
          )}

          <View style={{ flex: 1, gap: 7 }}>
            <Text numberOfLines={1} style={s.title}>
              {profile?.display_name || "Tu perfil"}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 7,
                alignItems: "center",
              }}
            >
              {profile?.username && (
                <Text style={s.handle}>@{profile.username}</Text>
              )}
              {profile?.profile_kind && (
                <Text style={s.kindBadge}>
                  {profile.profile_kind === "company" ? "Empresa" : "Persona"}
                </Text>
              )}
            </View>
          </View>
        </View>
        <View style={s.counters}>
          {(
            [
              [videoCount, "Publicaciones"],
              [profile?.followers || 0, "Seguidores"],
              [profile?.following || 0, "Siguiendo"],
            ] as const
          ).map(([n, label]) => (
            <Pressable
              key={label}
              style={s.counter}
              disabled={label === "Publicaciones" || busy}
              accessibilityRole={
                label !== "Publicaciones" ? "button" : undefined
              }
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
            <Pressable
              style={[s.recordButton, { flex: 1 }]}
              onPress={() => router.push("/grabar")}
            >
              <ProppixIcon name="video" />
              <Text style={s.buttonText}>Grabar video</Text>
            </Pressable>
            <Pressable
              style={[s.uploadButton, { flex: 1 }]}
              onPress={() => void pickVideo()}
            >
              <ProppixIcon name="upload" color={s.light.color} />
              <Text style={s.light}>Subir video</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", width: "100%", gap: 8 }}>
            <View style={{ flex: 1 }}>
              {session &&
                profile &&
                button(
                  profile?.followed ? "Siguiendo" : "Seguir",
                  () =>
                    void run(async () => {
                      const updated = await api<VideoProfileData>(
                        `/video-profiles/${target}/follow`,
                        {
                          method: "POST",
                          token,
                          body: { active: !profile?.followed },
                        },
                      );
                      rememberFollowState(
                        session?.user.id,
                        updated.id,
                        updated.followed,
                      );
                      setProfile(updated);
                    }),
                )}
            </View>
            <View style={{ flex: 1 }}>
              {button(
                "Mensaje",
                () =>
                  router.push({
                    pathname: "/mensajes",
                    params: { recipientId: target },
                  }),
                true,
              )}
            </View>
          </View>
        )}

        {!own && target && (
          <ModerationActions
            kind="user"
            targetId={target}
            authorId={target}
            session={session}
            label="Reportar o bloquear usuario"
          />
        )}
        {error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        {busy && <ActivityIndicator color={brandColors.secondary} />}
        {sectionTabs}
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
              placeholderTextColor={brandColors.secondary}
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
                {person.avatar_thumbnail_url || person.avatar_url ? (
                  <Image
                    fadeDuration={0}
                    source={{
                      uri: mediaUrl(
                        person.avatar_thumbnail_url || person.avatar_url!,
                      ),
                    }}
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
      {section === "properties" && session ? (
        <ScrollView>
          {header}
          <SellerPanel
            session={session}
            owner={profile || undefined}
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
              tintColor={brandColors.secondary}
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
              <View style={s.tileTitle}>
                <ProppixIcon name="play" size={14} filled />
                <Text style={s.tileTitleText} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
              <View style={s.tileMeta}>
                <ProppixIcon name="heart" size={16} filled />
                <Text style={s.tileTitleText}>{item.likes}</Text>
                {item.status === "draft" && (
                  <Text style={s.tileTitleText}> · Borrador</Text>
                )}
              </View>
              {own && (
                <Pressable
                  accessibilityLabel={"Opciones de " + item.title}
                  style={s.tileMore}
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation();
                    Alert.alert(item.title, undefined, [
                      {
                        text: "Ver video",
                        onPress: () => {
                          setActive(index);
                          setViewer(index);
                        },
                      },
                      {
                        text: "Agregar datos de esta propiedad",
                        onPress: () =>
                          router.push({
                            pathname: "/mis-videos",
                            params: {
                              videoId: item.id,
                              propertyMode: "new",
                              sourceTitle: item.property_title || item.title,
                            },
                          }),
                      },
                      { text: "Cancelar", style: "cancel" },
                    ]);
                  }}
                >
                  <ProppixIcon name="more" size={22} />
                </Pressable>
              )}
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
              <ActivityIndicator color={brandColors.secondary} />
            )
          }
          ListFooterComponent={
            loading && page > 0 ? (
              <ActivityIndicator color={brandColors.secondary} />
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
              ref={viewerList}
              data={videos}
              keyExtractor={(v) => v.id}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              initialScrollIndex={viewer}
              pagingEnabled
              snapToInterval={height}
              snapToAlignment="start"
              disableIntervalMomentum
              bounces={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              decelerationRate="fast"
              getItemLayout={(_, i) => ({
                index: i,
                length: height,
                offset: i * height,
              })}
              onScrollBeginDrag={(e) => {
                viewerDragging.current = true;
                viewerDragIndex.current = Math.max(
                  0,
                  Math.min(
                    videos.length - 1,
                    Math.round(e.nativeEvent.contentOffset.y / height),
                  ),
                );
              }}
              onScroll={(e) => {
                if (!viewerDragging.current) return;
                const offset = e.nativeEvent.contentOffset.y;
                const bounded = clampVideoOffset(
                  offset,
                  height,
                  viewerDragIndex.current,
                  videos.length,
                );
                if (Math.abs(offset - bounded) > 1)
                  viewerList.current?.scrollToOffset({
                    offset: bounded,
                    animated: false,
                  });
                setActive(
                  enteringVideoIndex(
                    bounded,
                    height,
                    viewerDragIndex.current,
                    videos.length,
                    active,
                  ),
                );
              }}
              onMomentumScrollEnd={(e) => {
                if (!viewerDragging.current) return;
                viewerDragging.current = false;
                const offset = e.nativeEvent.contentOffset.y;
                const bounded = clampVideoOffset(
                  offset,
                  height,
                  viewerDragIndex.current,
                  videos.length,
                );
                const next = Math.round(bounded / height);
                setActive(next);
                if (Math.abs(offset - next * height) > 1)
                  viewerList.current?.scrollToOffset({
                    offset: next * height,
                    animated: false,
                  });
              }}
              scrollEventThrottle={16}
              initialNumToRender={1}
              windowSize={3}
              removeClippedSubviews={false}
              renderItem={({ item, index }) => (
                <View style={{ height, backgroundColor: "#000" }}>
                  {Math.abs(index - active) <= 1 && (
                    <FullVideo
                      key={item.id}
                      video={item}
                      active={index === active}
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
        onRequestClose={() => {
          if (!busy) setEditProfile(false);
        }}
      >
        <KeyboardSafeView style={s.overlay}>
          <View style={[s.dialog, { maxHeight: "95%" }]}>
            <ScrollView
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
            >
              <Text style={s.title}>
                {profile?.identity_configured
                  ? "Editar perfil"
                  : "Completa tu perfil"}
              </Text>
              <Pressable
                onPress={() => void choosePhoto()}
                style={s.editButton}
              >
                <Text style={s.light}>Cambiar foto de perfil</Text>
              </Pressable>
              <ProfileIdentityFields
                value={identity}
                onChange={setIdentity}
                disabled={busy}
              />
              {!!error && (
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={busy || !identityComplete(identity)}
                style={[
                  s.button,
                  (busy || !identityComplete(identity)) && { opacity: 0.45 },
                ]}
                onPress={() =>
                  void run(async () => {
                    const result = await api<VideoProfileData>(
                      "/me/video-profile",
                      { method: "POST", token, body: identity },
                    );
                    setProfile(result);
                    setEditProfile(false);
                  })
                }
              >
                <Text style={s.buttonText}>
                  {busy ? "Guardando…" : "Guardar perfil"}
                </Text>
              </Pressable>
              {button("Cerrar", () => setEditProfile(false), true)}
            </ScrollView>
          </View>
        </KeyboardSafeView>
      </Modal>
      <Modal
        visible={!!asset}
        transparent
        animationType="slide"
        onRequestClose={closeUpload}
      >
        {uploadProgress ? (
          <VideoUploadProgress progress={uploadProgress} embedded />
        ) : (
          <View style={s.overlay}>
            <View style={s.dialog}>
              <Text style={s.title}>Nuevo video</Text>
              <Text style={s.muted}>No necesitas elegir una propiedad.</Text>
              <TextInput
                accessibilityLabel="Título del video"
                value={title}
                editable={!busy && !uploadAttempt}
                onChangeText={setTitle}
                style={s.input}
                maxLength={160}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void upload()}
                style={s.button}
              >
                <Text style={s.buttonText}>
                  {busy
                    ? "Subiendo…"
                    : uploadAttempt
                      ? "Reintentar carga"
                      : "Guardar video en mi galería"}
                </Text>
              </Pressable>
              {error && <Text style={s.error}>{error}</Text>}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={closeUpload}
                style={[s.button, s.secondary]}
              >
                <Text style={[s.buttonText, s.light]}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}
const baseStyles = StyleSheet.create({
  editButton: {
    flexDirection: "row",
    gap: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: brandColors.secondaryBorder,
    borderRadius: 13,
    alignItems: "center",
  },
  kindBadge: {
    color: brandColors.secondary,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: brandColors.secondarySurface,
  },
  recordButton: {
    flexDirection: "row",
    gap: 8,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.secondary,
    borderRadius: 16,
  },
  uploadButton: {
    flexDirection: "row",
    gap: 8,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: brandColors.secondaryBorder,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  tileTitleText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
    flexShrink: 1,
  },
  tileMore: { position: "absolute", bottom: 6, right: 3, padding: 3 },
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
  title: { color: brandColors.secondary, fontSize: 24, fontWeight: "800" },
  gear: { color: brandColors.secondary, fontSize: 25, padding: 8 },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: brandColors.secondarySurface,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: brandColors.secondary, fontSize: 20, fontWeight: "800" },
  camera: {
    position: "absolute",
    bottom: 0,
    right: -2,
    backgroundColor: brandColors.secondary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: { color: brandColors.secondary, fontWeight: "600" },
  counters: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingVertical: 4,
  },
  counter: {
    flex: 1,
    alignItems: "center",
    gap: 7,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderColor: brandColors.secondaryBorder,
  },
  counterNumber: {
    color: brandColors.secondary,
    fontSize: 23,
    fontWeight: "800",
  },
  muted: { color: brandColors.secondary, fontSize: 13 },
  explainer: {
    color: brandColors.secondary,
    fontSize: 13,
    lineHeight: 21,
    padding: 14,
    borderRadius: 16,
    backgroundColor: brandColors.secondarySurface,
  },
  row: { flexDirection: "row", gap: 10 },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: brandColors.secondary,
    marginVertical: 3,
    minHeight: 46,
  },
  secondary: {
    backgroundColor: brandColors.secondarySurface,
    borderWidth: 1,
    borderColor: brandColors.secondaryBorder,
  },
  buttonText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  light: { color: brandColors.secondary, fontWeight: "600" },
  tabs: {
    flexDirection: "row",
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: brandColors.secondaryBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  selectedTab: {
    borderBottomColor: brandColors.secondary,
    borderBottomWidth: 3,
  },
  tile: {
    flex: 1 / 3,
    aspectRatio: 0.7,
    backgroundColor: brandColors.secondarySurface,
    margin: 4,
    borderRadius: 14,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 25,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  tileMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
    backgroundColor: brandColors.secondarySurface,
    borderRadius: 22,
    padding: 22,
    gap: 14,
  },
  input: {
    backgroundColor: brandColors.secondarySurface,
    color: brandColors.secondary,
    padding: 14,
    borderRadius: 10,
  },
});
