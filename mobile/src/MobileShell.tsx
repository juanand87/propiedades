import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import {
  Slot,
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import {
  api,
  API_URL,
  IS_PRODUCTION,
  checkEnvironment,
  ManagedVideo,
  Page,
  price,
  Property,
  Session,
  Video,
} from "./api";
import { ScreenContext } from "./screen-context";
import { lightColors as videoColors } from "./video-colors";
import { VideoCard } from "./VideoCard";
import { VideoRecorder } from "./VideoRecorder";
import { SellerPanel } from "./SellerPanel";
import { ContactProperty } from "./ContactProperty";
import { VideoProfile } from "./VideoProfile";
import { PropertyCatalog } from "./PropertyCatalog";
import { ProppixBrand } from "./ProppixBrand";
import { ProppixIcon, ProppixIconName } from "./ProppixIcon";
import { clampVideoOffset } from "./video-paging";
import { prepareVideoCache, useVideoPreload } from "./useVideoPreload";
import { randomUUID } from "expo-crypto";
import { PropertySlideshow } from "./PropertySlideshow";
import { MessagesScreen } from "./MessagesScreen";
import { useMessageNotifications } from "./useMessageNotifications";
import { NotificationVideoScreen } from "./NotificationVideoScreen";
import { ActivityScreen } from "./ActivityScreen";
import { ActivityBell } from "./ActivityBell";
import { SavedSearchesScreen } from "./SavedSearchesScreen";

type Tab = "feed" | "catalog" | "manage" | "messages" | "account";
const sessionKey = IS_PRODUCTION
  ? "propiedades-production-session"
  : "propiedades-local-session";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la operación.";
function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.buttonLabel, secondary && { color: videoColors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function AppContent() {
  const pathname = usePathname(),
    router = useRouter();
  const routes: Record<
    Tab,
    "/" | "/propiedades" | "/mis-videos" | "/mensajes" | "/cuenta"
  > = {
    feed: "/",
    catalog: "/propiedades",
    manage: "/mis-videos",
    account: "/cuenta",
    messages: "/mensajes",
  };
  const propertyRoute = pathname.startsWith("/property/");
  const recordingRoute = pathname === "/grabar";
  const profileRoute = pathname.startsWith("/perfil/");
  const notificationVideoRoute = pathname.startsWith("/video/");
  const activityRoute = pathname === "/actividad";
  const savedSearchRoute = pathname === "/busquedas";
  const {
    propertyId,
    from,
    userId,
    videoId,
    propertyMode,
    profileSection,
    contact,
    conversationId,
    recipientId,
    resumeVideoId,
    commentId,
    savedSearchId,
  } = useGlobalSearchParams<{
    propertyId?: string;
    from?: Tab;
    userId?: string;
    videoId?: string;
    propertyMode?: "new" | "link";
    profileSection?: "properties";
    contact?: "1";
    conversationId?: string;
    recipientId?: string;
    resumeVideoId?: string;
    commentId?: string;
    savedSearchId?: string;
  }>();
  const tab: Tab = propertyRoute
    ? from && from in routes
      ? from
      : "feed"
    : recordingRoute || profileRoute
      ? "manage"
      : pathname === "/propiedades"
        ? "catalog"
        : pathname === "/mis-videos"
          ? "manage"
          : pathname === "/mensajes"
            ? "messages"
            : pathname === "/cuenta"
              ? "account"
              : "feed";
  const [accountMenu, setAccountMenu] = useState(false);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [booting, setBooting] = useState(false);
  const [socialEnabled, setSocialEnabled] = useState(false);
  useEffect(() => {
    if (ready)
      void api<{ social?: boolean }>("/videos/capabilities")
        .then((c) => setSocialEnabled(c.social === true))
        .catch(() => setSocialEnabled(false));
  }, [ready]);
  const [session, setSession] = useState<Session | null>(null),
    [favorites, setFavorites] = useState<string[]>([]),
    [detail, setDetail] = useState<Property | null>(null),
    [detailBusy, setDetailBusy] = useState(false);
  const notifications = useMessageNotifications(session, ready);
  const [activityCount, setActivityCount] = useState({ userId: "", count: 0 });
  const activityUnread =
    activityCount.userId === session?.user.id ? activityCount.count : 0;
  const [activityRevision, setActivityRevision] = useState(0);
  useEffect(() => {
    if (!session || !ready) {
      return;
    }
    const controller = new AbortController();
    const refresh = () => {
      if (AppState.currentState !== "active") return;
      void api<{ unread_count: number }>("/me/activity?limit=1", {
        token: session.access_token,
        signal: controller.signal,
      })
        .then((page) => {
          if (!controller.signal.aborted)
            setActivityCount({
              userId: session.user.id,
              count: page.unread_count,
            });
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 45000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      controller.abort();
      clearInterval(timer);
      listener.remove();
    };
  }, [session, ready, pathname, activityRevision]);
  const setTab = (value: Tab) => {
    setDetail(null);
    if (value === "feed" && !videos.length) void loadFeed(true);
    if (value === "feed" && videos.length) {
      const preparedNext = videos
        .map((video, index) => ({ video, index }))
        .filter(
          ({ video, index }) =>
            index > active &&
            preparedVideos.get(video.id)?.player.status === "readyToPlay",
        );
      const preparedIndex = preparedNext.length
        ? preparedNext[0].index
        : videos.findIndex(
            (video) =>
              preparedVideos.get(video.id)?.player.status === "readyToPlay",
          );
      if (preparedIndex >= 0) {
        setActive(preparedIndex);
        requestAnimationFrame(() =>
          feedRef.current?.scrollToOffset({
            offset: preparedIndex * height,
            animated: false,
          }),
        );
      }
    }
    router.replace(routes[value]);
  };
  const closeDetail = useCallback(() => {
    setDetail(null);
    if (resumeVideoId)
      router.replace({ pathname: "/", params: { resumeVideoId } });
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router, resumeVideoId]);
  const [videos, setVideos] = useState<Video[]>([]),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(1),
    [loading, setLoading] = useState(false),
    [feedError, setFeedError] = useState(""),
    [active, setActive] = useState(0),
    [height, setHeight] = useState(1),
    [foreground, setForeground] = useState(AppState.currentState === "active");
  const feedVisible =
    ready &&
    foreground &&
    tab === "feed" &&
    !propertyRoute &&
    !detail &&
    !notificationVideoRoute &&
    !activityRoute &&
    !savedSearchRoute;
  const preparedVideos = useVideoPreload(videos, active, ready, !feedVisible);
  const feedRef = useRef<FlatList<Video>>(null),
    feedDragIndex = useRef(0),
    feedDragging = useRef(false),
    feedSeed = useRef(randomUUID()),
    busy = useRef(false),
    pendingFeedReset = useRef(false),
    feedGeneration = useRef(0),
    mounted = useRef(true),
    favoriteBusy = useRef(false);
  const [email, setEmail] = useState(
      IS_PRODUCTION ? "" : "mobile-admin@qa.invalid",
    ),
    [password, setPassword] = useState(""),
    [authBusy, setAuthBusy] = useState(false);
  const [registering, setRegistering] = useState(false),
    [firstName, setFirstName] = useState(""),
    [lastName, setLastName] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [googleEnabled, setGoogleEnabled] = useState(false);
  const authRun = useRef(0);
  useEffect(() => {
    let live = true;
    api<{ google: boolean }>("/auth/options")
      .then((r) => {
        if (live) setGoogleEnabled(r.google);
      })
      .catch(() => {});
    return () => {
      live = false;
      // This counter cancels polling, rather than referring to a rendered node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      authRun.current++;
    };
  }, []);
  const [mine, setMine] = useState<Property[]>([]),
    [minePage, setMinePage] = useState(0),
    [minePages, setMinePages] = useState(1),
    [selected, setSelected] = useState<Property | null>(null),
    [managed, setManaged] = useState<ManagedVideo[]>([]),
    [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null),
    [title, setTitle] = useState(""),
    [manageBusy, setManageBusy] = useState(false),
    [manageError, setManageError] = useState("");
  async function boot() {
    setBooting(true);
    setError("");
    try {
      await prepareVideoCache();
      await checkEnvironment();
      setReady(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBooting(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => void boot(), 0);
    void SecureStore.getItemAsync(sessionKey).then(async (saved) => {
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as Session;
        const user = await api<Session["user"]>("/auth/profile", {
          token: parsed.access_token,
        });
        setSession({ ...parsed, user });
      } catch {
        await SecureStore.deleteItemAsync(sessionKey);
      }
    });
    const sub = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  async function loadFeed(reset = false) {
    if (busy.current) {
      if (reset) {
        pendingFeedReset.current = true;
        feedGeneration.current++;
      }
      return;
    }
    busy.current = true;
    setLoading(true);
    setFeedError("");
    const generation = reset
        ? ++feedGeneration.current
        : feedGeneration.current,
      next = reset || page >= pages ? 1 : page + 1;
    if (next === 1) feedSeed.current = randomUUID();
    try {
      const data = await api<Page<Video>>(
        `/videos?limit=12&page=${next}&seed=${feedSeed.current}`,
      );
      if (generation !== feedGeneration.current || !mounted.current) return;
      setVideos((previous) => {
        const incoming = [...data.items];
        const preceding = reset ? previous[active]?.id : previous.at(-1)?.id;
        if (next === 1 && incoming.length > 1 && incoming[0]?.id === preceding)
          incoming.push(incoming.shift()!);
        return reset ? incoming : [...previous, ...incoming];
      });
      setPage(data.page);
      setPages(data.pages);
      if (reset) {
        feedDragIndex.current = 0;
        setActive(0);
        feedRef.current?.scrollToOffset({ offset: 0, animated: false });
      }
    } catch (e) {
      if (generation === feedGeneration.current) setFeedError(message(e));
    } finally {
      busy.current = false;
      setLoading(false);
      if (pendingFeedReset.current && mounted.current) {
        pendingFeedReset.current = false;
        setTimeout(() => void loadFeed(true), 0);
      }
    }
  }
  const topUpFeed = useEffectEvent(() => {
    void loadFeed();
  });
  useEffect(() => {
    if (!ready || propertyRoute || tab !== "feed" || !resumeVideoId) return;
    const controller = new AbortController();
    void api<Page<Video>>(
      `/videos?video_id=${encodeURIComponent(resumeVideoId)}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        const video = result.items[0];
        if (!video) throw new Error("Este video ya no está publicado.");
        feedGeneration.current++;
        setVideos((previous) => [
          video,
          ...previous.filter((item) => item.id !== video.id),
        ]);
        setActive(0);
        feedDragIndex.current = 0;
        feedRef.current?.scrollToOffset({ offset: 0, animated: false });
        router.replace("/");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          Alert.alert("Recorrido no disponible", message(error));
          router.replace("/");
        }
      });
    return () => controller.abort();
  }, [ready, propertyRoute, tab, resumeVideoId, router]);
  useEffect(() => {
    if (
      !feedVisible ||
      loading ||
      feedError ||
      (page >= pages && videos.length === 0) ||
      videos.length - active > 10
    )
      return;
    const timer = setTimeout(() => topUpFeed(), 200);
    return () => clearTimeout(timer);
  }, [feedVisible, loading, feedError, page, pages, videos.length, active]);
  const onReady = useEffectEvent(() => {
    void loadFeed(true);
  });
  useEffect(() => {
    if (ready) {
      const timer = setTimeout(() => onReady(), 0);
      return () => clearTimeout(timer);
    }
  }, [ready]);
  useEffect(() => {
    if (!session) {
      return;
    }
    let current = true;
    void api<Property[]>("/me/favorites", { token: session.access_token })
      .then((rows) => {
        if (current) setFavorites(rows.map((p) => p.id));
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [session]);
  async function favorite(id: string) {
    if (!session) {
      setTab("account");
      Alert.alert(
        "Guarda tus favoritos",
        IS_PRODUCTION
          ? "Inicia sesión con tu cuenta de Proppix."
          : "Inicia sesión con una cuenta local de pruebas.",
      );
      return;
    }
    if (favoriteBusy.current) return;
    favoriteBusy.current = true;
    try {
      const exists = favorites.includes(id);
      await api(`/me/favorites/${id}`, {
        method: exists ? "DELETE" : "POST",
        token: session.access_token,
      });
      setFavorites((v) => (exists ? v.filter((x) => x !== id) : [...v, id]));
    } catch (e) {
      Alert.alert("Favoritos", message(e));
    } finally {
      favoriteBusy.current = false;
    }
  }
  function openDetail(p: Property, contactSeller = false) {
    setDetail(p);
    router.push({
      pathname: "/property/[propertyId]",
      params: {
        propertyId: p.id,
        from: tab,
        ...(contactSeller && { contact: "1" }),
      },
    });
  }
  useEffect(() => {
    if (!ready || !propertyRoute || !propertyId) return;
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setDetailBusy(true);
      void api<Property>(`/properties/${encodeURIComponent(propertyId)}`, {
        signal: controller.signal,
      })
        .then((p) => {
          if (current) setDetail(p);
        })
        .catch((e) => {
          if (current) {
            setDetail(null);
            Alert.alert("Propiedad no disponible", message(e));
            closeDetail();
          }
        })
        .finally(() => {
          if (current) setDetailBusy(false);
        });
    }, 0);
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [ready, propertyRoute, propertyId, closeDetail]);
  async function share(p: Property) {
    await Share.share({
      message: IS_PRODUCTION
        ? `${p.title}\n${price(p)}\nhttps://propiedades-eta.vercel.app/propiedades/${p.slug}`
        : `${p.title}\n${price(p)}\n${p.commune_name}\nDemostración local de Propiedades. Código ${p.id}`,
    }).catch(() => {});
  }
  async function login() {
    setAuthBusy(true);
    try {
      if (registering && password !== confirmPassword)
        throw Error("Las contraseñas no coinciden.");
      const value = await api<Session>(
        registering ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: { email: email.trim(), password, firstName, lastName },
        },
      );
      await SecureStore.setItemAsync(sessionKey, JSON.stringify(value));
      setSession(value);
      setPassword("");
      setConfirmPassword("");
      if (value.user.account_type === "buyer") setTab("feed");
      else if (
        value.user.account_type === "seller" ||
        value.user.role === "admin"
      )
        setTab("manage");
    } catch (e) {
      Alert.alert("No se pudo iniciar sesión", message(e));
    } finally {
      setAuthBusy(false);
    }
  }
  async function chooseAccount(account_type: "buyer" | "seller") {
    if (!session) return;
    setAuthBusy(true);
    try {
      const user = await api<Session["user"]>("/me/account-type", {
        method: "POST",
        token: session.access_token,
        body: { account_type },
      });
      const value = { ...session, user };
      await SecureStore.setItemAsync(sessionKey, JSON.stringify(value));
      setSession(value);
      setTab(account_type === "buyer" ? "feed" : "manage");
    } catch (e) {
      Alert.alert("No se pudo guardar", message(e));
    } finally {
      setAuthBusy(false);
    }
  }
  async function googleLogin() {
    setAuthBusy(true);
    const run = ++authRun.current;
    try {
      const start = await api<{ id: string; poll: string; url: string }>(
        "/auth/google/start",
        { method: "POST", body: {} },
      );
      await Linking.openURL(start.url);
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        if (run !== authRun.current) return;
        const result = await api<Session & { pending?: boolean }>(
          "/auth/google/result",
          { method: "POST", body: { id: start.id, poll: start.poll } },
        );
        if (!result.pending) {
          await SecureStore.setItemAsync(sessionKey, JSON.stringify(result));
          setSession(result);
          setTab(
            result.user.account_type === "buyer"
              ? "feed"
              : result.user.account_type === "seller"
                ? "manage"
                : "account",
          );
          return;
        }
      }
      throw Error("El acceso expiró. Inténtalo nuevamente.");
    } catch (e) {
      Alert.alert("Google", message(e));
    } finally {
      if (run === authRun.current) setAuthBusy(false);
    }
  }
  async function logout() {
    try {
      await notifications.unregister();
    } catch {
      Alert.alert(
        "No se pudo cerrar sesión",
        "Conéctate a internet para desactivar los avisos de este dispositivo y reintenta.",
      );
      return;
    }
    authRun.current++;
    await SecureStore.deleteItemAsync(sessionKey);
    setSession(null);
    setFavorites([]);
    setMine([]);
    setSelected(null);
    setManaged([]);
    setAsset(null);
    setTitle("");
  }
  async function loadMine(reset = true) {
    if (!session || manageBusy) return;
    setManageBusy(true);
    setManageError("");
    try {
      const data = await api<Page<Property>>(
        `/manage/properties?limit=24&page=${reset ? 1 : minePage + 1}`,
        { token: session.access_token },
      );
      setMine((v) =>
        reset
          ? data.items
          : [...v, ...data.items.filter((x) => !v.some((p) => p.id === x.id))],
      );
      setMinePage(data.page);
      setMinePages(data.pages);
    } catch (e) {
      setManageError(message(e));
    } finally {
      setManageBusy(false);
    }
  }
  const onManageEnter = useEffectEvent(() => void loadMine());
  useEffect(() => {
    if (ready && tab === "manage" && session) {
      const timer = setTimeout(() => onManageEnter(), 0);
      return () => clearTimeout(timer);
    }
  }, [tab, ready, session]);
  async function selectProperty(p: Property) {
    if (!session) return;
    setSelected(p);
    setAsset(null);
    setTitle("");
    setManageError("");
    try {
      setManaged(
        await api<ManagedVideo[]>(`/manage/properties/${p.id}/videos`, {
          token: session.access_token,
        }),
      );
    } catch (e) {
      setManaged([]);
      setManageError(message(e));
    }
  }
  async function pick() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if ((file.fileSize || 0) > 50 * 1024 * 1024) {
        Alert.alert(
          "Video demasiado grande",
          "Selecciona un MP4 de hasta 50 MB.",
        );
        return;
      }
      if (file.mimeType && file.mimeType !== "video/mp4") {
        Alert.alert(
          "Formato no compatible",
          "Utiliza un archivo MP4 con video H.264.",
        );
        return;
      }
      setAsset(file);
    } catch (e) {
      Alert.alert("Seleccionar video", message(e));
    }
  }
  async function upload() {
    if (!session || !selected || !asset || !title.trim()) return;
    setManageBusy(true);
    setManageError("");
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("file", new File(asset.uri));
      await api(`/manage/properties/${selected.id}/videos`, {
        method: "POST",
        token: session.access_token,
        body: form,
      });
      setAsset(null);
      setTitle("");
      setManaged(
        await api<ManagedVideo[]>(`/manage/properties/${selected.id}/videos`, {
          token: session.access_token,
        }),
      );
      Alert.alert(
        "Video vinculado",
        "Se guardó como borrador. Pulsa Publicar para mostrarlo en Descubrir si la propiedad está publicada.",
      );
    } catch (e) {
      setManageError(message(e));
    } finally {
      setManageBusy(false);
    }
  }
  async function videoStatus(v: ManagedVideo, status: string) {
    if (!session || !selected) return;
    setManageBusy(true);
    setManageError("");
    try {
      await api(`/manage/videos/${v.id}`, {
        method: "PATCH",
        token: session.access_token,
        body: { status },
      });
      setManaged(
        await api<ManagedVideo[]>(`/manage/properties/${selected.id}/videos`, {
          token: session.access_token,
        }),
      );
      await loadFeed(true);
    } catch (e) {
      setManageError(message(e));
    } finally {
      setManageBusy(false);
    }
  }
  const tabs: {
    key: Tab | "publish";
    label: string;
    icon?: ProppixIconName;
  }[] = [
    { key: "feed", label: "Inicio", icon: "home" },
    { key: "catalog", label: "Propiedades" },
    { key: "publish", label: "Publicar", icon: "plus" },
    { key: "messages", label: "Mensajes", icon: "messages" },
    { key: "manage", label: "Perfil", icon: "profile" },
  ];
  if (!ready)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.welcome}>
          <Text style={s.eyebrow}>PROPIEDADES · LAB</Text>
          <Text style={s.hero}>Tu próximo lugar,{`\n`}en movimiento.</Text>
          <Text style={s.muted}>
            {IS_PRODUCTION
              ? "Conectando con Proppix…"
              : "Conectando con el backend NestJS local. Sin conexión a producción."}
          </Text>
          <Text style={s.code}>{API_URL}</Text>
          {booting ? (
            <ActivityIndicator color={videoColors.cyan} />
          ) : (
            <>
              <Text style={s.error}>{error}</Text>
              <Button label="Reintentar conexión" onPress={() => void boot()} />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  const feedScreen = (
    <View
      style={s.feed}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {height > 1 && (
        <FlatList
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          ref={feedRef}
          data={videos}
          keyExtractor={(v, index) => `${v.id}:${index}`}
          initialScrollIndex={Math.min(active, Math.max(0, videos.length - 1))}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          disableIntervalMomentum
          bounces={false}
          overScrollMode="never"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({
            length: height,
            offset: height * i,
            index: i,
          })}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          extraData={[active, preparedVideos, foreground, detail, favorites]}
          onScrollBeginDrag={() => {
            feedDragging.current = true;
            feedDragIndex.current = active;
          }}
          onMomentumScrollEnd={(e) => {
            if (!feedDragging.current) return;
            feedDragging.current = false;
            const bounded = clampVideoOffset(
              e.nativeEvent.contentOffset.y,
              height,
              feedDragIndex.current,
              videos.length,
            );
            const next = Math.round(bounded / height);
            setActive(next);
            if (Math.abs(e.nativeEvent.contentOffset.y - next * height) > 1)
              feedRef.current?.scrollToOffset({
                offset: next * height,
                animated: false,
              });
          }}
          onScroll={(e) => {
            if (!feedDragging.current) return;
            const offset = e.nativeEvent.contentOffset.y;
            const bounded = clampVideoOffset(
              offset,
              height,
              feedDragIndex.current,
              videos.length,
            );
            if (Math.abs(bounded - offset) > 1)
              feedRef.current?.scrollToOffset({
                offset: bounded,
                animated: false,
              });
            setActive(Math.round(bounded / height));
          }}
          scrollEventThrottle={16}
          onEndReached={() => void loadFeed()}
          onEndReachedThreshold={1.5}
          refreshControl={
            <RefreshControl
              refreshing={loading && page > 0}
              onRefresh={() => void loadFeed(true)}
              tintColor={videoColors.cyan}
            />
          }
          renderItem={({ item, index }) => (
            <VideoCard
              item={item}
              height={height}
              active={index === active && feedVisible}
              player={
                feedVisible &&
                index === active &&
                preparedVideos.get(item.id)?.url === item.url
                  ? preparedVideos.get(item.id)?.player
                  : undefined
              }
              social={socialEnabled}
              session={session}
              favorite={favorites.includes(item.property_id || "")}
              onFavorite={() => {
                if (item.property_id) void favorite(item.property_id);
              }}
              onDetails={() => {
                if (item.property) void openDetail(item.property);
              }}
              onContact={
                item.property && !item.property.is_demo
                  ? () => {
                      if (item.property) openDetail(item.property, true);
                    }
                  : undefined
              }
              onShare={() => {
                if (item.property) void share(item.property);
              }}
            />
          )}
          ListEmptyComponent={
            <View style={[s.empty, { height }]}>
              {loading ? (
                <ActivityIndicator color={videoColors.cyan} />
              ) : (
                <>
                  <Text style={s.h2}>Videos de propiedades</Text>
                  <Text style={s.muted}>
                    {feedError || "Todavía no hay videos publicados."}
                  </Text>
                  <Button
                    label={feedError ? "Reintentar" : "Ver propiedades"}
                    onPress={() =>
                      feedError ? void loadFeed(true) : setTab("catalog")
                    }
                  />
                </>
              )}
            </View>
          }
          ListFooterComponent={
            videos.length > 0 ? (
              feedError ? (
                <View style={s.pad}>
                  <Text style={s.error}>{feedError}</Text>
                  <Button
                    label="Reintentar carga"
                    onPress={() => void loadFeed()}
                  />
                </View>
              ) : loading ? (
                <ActivityIndicator color={videoColors.cyan} style={s.pad} />
              ) : undefined
            ) : undefined
          }
        />
      )}
    </View>
  );
  const catalogScreen = (
    <PropertyCatalog
      key={savedSearchId || "catalog"}
      savedSearchId={savedSearchId}
      session={session}
      activityUnread={activityUnread}
      favorites={favorites}
      onFavorite={(id) => void favorite(id)}
      onOpen={openDetail}
    />
  );
  const accountScreen = (
    <ScrollView style={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>TU ESPACIO</Text>
      <Text style={s.h1}>
        {session
          ? `Hola, ${session.user.firstName}`
          : registering
            ? "Crea tu cuenta"
            : "Bienvenido a casa"}
      </Text>
      {session ? (
        <>
          <Text style={s.muted}>{session.user.email}</Text>
          {session.user.role !== "admin" && (
            <View style={s.info}>
              <Text style={s.h2}>
                {session.user.account_type
                  ? "Tu perfil"
                  : "¿Qué quieres hacer?"}
              </Text>
              <Text style={s.muted}>
                Compra, guarda favoritos o publica propiedades gratis.
              </Text>
              <Button
                label="Soy comprador · Ver propiedades"
                disabled={authBusy}
                onPress={() => void chooseAccount("buyer")}
              />
              <Button
                label="Soy vendedor · Publicar gratis"
                disabled={authBusy}
                onPress={() => void chooseAccount("seller")}
              />
            </View>
          )}
          <Text style={s.muted}>
            {favorites.length} propiedades guardadas{" "}
            {IS_PRODUCTION ? "" : "· Cuenta local"}
          </Text>
          <Button
            label="Cerrar sesión"
            secondary
            onPress={() => void logout()}
          />
        </>
      ) : (
        <>
          <Button
            label="Continuar con Google"
            disabled={authBusy || !googleEnabled}
            onPress={() => void googleLogin()}
            secondary
          />
          {!googleEnabled && (
            <Text style={s.muted}>
              Google estará disponible pronto. Regístrate con tu correo.
            </Text>
          )}
          {registering && (
            <>
              <Text style={s.label}>Nombre</Text>
              <TextInput
                style={s.input}
                value={firstName}
                onChangeText={setFirstName}
                accessibilityLabel="Nombre"
                autoComplete="given-name"
              />
              <Text style={s.label}>Apellido</Text>
              <TextInput
                style={s.input}
                value={lastName}
                onChangeText={setLastName}
                accessibilityLabel="Apellido"
                autoComplete="family-name"
              />
            </>
          )}
          <Text style={s.muted}>
            {IS_PRODUCTION
              ? "Usa tu correo y contraseña de Proppix."
              : "Usa la cuenta generada en tmp/mobile-local/credentials.json. Solo funciona en este entorno de pruebas."}
          </Text>
          <Text style={s.label}>Correo</Text>
          <TextInput
            accessibilityLabel="Correo"
            style={s.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Text style={s.label}>
            {IS_PRODUCTION ? "Contraseña" : "Contraseña local"}
          </Text>
          <TextInput
            accessibilityLabel={
              IS_PRODUCTION ? "Contraseña" : "Contraseña local"
            }
            style={s.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={registering ? "new-password" : "current-password"}
          />
          {registering && (
            <>
              <Text style={s.label}>
                Repite la contraseña · mínimo 10 caracteres
              </Text>
              <TextInput
                style={s.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                accessibilityLabel="Confirmar contraseña"
                autoComplete="new-password"
              />
            </>
          )}
          <Button
            label={
              authBusy
                ? "Procesando…"
                : registering
                  ? "Crear cuenta"
                  : "Iniciar sesión"
            }
            disabled={
              authBusy ||
              !email ||
              !password ||
              (registering &&
                (!firstName.trim() ||
                  !lastName.trim() ||
                  password.length < 10 ||
                  password !== confirmPassword))
            }
            onPress={() => void login()}
          />
          <Button
            secondary
            label={
              registering ? "Ya tengo cuenta" : "Crear una cuenta con correo"
            }
            disabled={authBusy}
            onPress={() => {
              setRegistering(!registering);
              setPassword("");
              setConfirmPassword("");
            }}
          />
        </>
      )}
      <View style={s.info}>
        <Text style={s.h2}>
          {IS_PRODUCTION ? "Tu cuenta, en web y app" : "Entorno independiente"}
        </Text>
        <Text style={s.muted}>
          {IS_PRODUCTION
            ? "Las propiedades y tus favoritos se sincronizan con tu cuenta de Propiedades."
            : "Esta app comparte el código del backend de la web, pero aquí utiliza una instancia y una base de datos locales. Los ejemplos no son ofertas reales."}
        </Text>
        <Text style={s.code}>{API_URL}</Text>
      </View>
    </ScrollView>
  );
  const manageScreen = (
    <ScrollView style={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>RECORRIDOS QUE CONECTAN</Text>
      <Text style={s.h1}>Mis videos</Text>
      {!session ? (
        <>
          <Text style={s.muted}>
            Inicia sesión para vincular videos a tus propiedades.
          </Text>
          <Button label="Ir a mi cuenta" onPress={() => setTab("account")} />
        </>
      ) : (
        <>
          <SellerPanel
            session={session}
            onChanged={() => void loadMine(true)}
          />
          <Text style={s.muted}>
            1. Elige la propiedad · 2. Agrega un MP4 · 3. Publícalo
          </Text>
          {!!manageError && <Text style={s.error}>{manageError}</Text>}
          {!selected ? (
            <>
              {mine.map((p) => (
                <Pressable
                  accessibilityRole="button"
                  key={p.id}
                  onPress={() => void selectProperty(p)}
                  style={s.select}
                >
                  <Text style={s.h2}>{p.title}</Text>
                  <Text style={s.muted}>
                    {p.publication_status} · {price(p)}
                  </Text>
                </Pressable>
              ))}
              {!mine.length && !manageBusy && (
                <Text style={s.muted}>
                  Esta cuenta aún no tiene propiedades. Usa una cuenta de
                  corredor local o el administrador de pruebas.
                </Text>
              )}
              {minePage < minePages && (
                <Button
                  label="Cargar más propiedades"
                  disabled={manageBusy}
                  onPress={() => void loadMine(false)}
                />
              )}
              <Button
                label="Actualizar propiedades"
                disabled={manageBusy}
                secondary
                onPress={() => void loadMine()}
              />
            </>
          ) : (
            <>
              <Button
                label="← Elegir otra propiedad"
                secondary
                disabled={manageBusy}
                onPress={() => setSelected(null)}
              />
              <Text style={s.h2}>{selected.title}</Text>
              <Text style={s.muted}>
                MP4/H.264, hasta 50 MB. El cupo depende de tu plan. La
                publicación se oculta si se pausa la propiedad.
              </Text>
              <Button
                label="Grabar video · 15, 30 o 45 s"
                disabled={manageBusy}
                onPress={() =>
                  router.push({
                    pathname: "/grabar",
                    params: { propertyId: selected.id },
                  })
                }
              />
              <Button
                label={asset ? "Cambiar video" : "Seleccionar video MP4"}
                disabled={manageBusy}
                secondary
                onPress={() => void pick()}
              />
              {asset && (
                <Text style={s.muted}>
                  {asset.fileName || "Video seleccionado"} ·{" "}
                  {((asset.fileSize || 0) / 1024 / 1024).toFixed(1)} MB
                </Text>
              )}
              <Text style={s.label}>Título del recorrido</Text>
              <TextInput
                accessibilityLabel="Título del recorrido"
                style={s.input}
                value={title}
                onChangeText={setTitle}
                maxLength={160}
                placeholder="Una casa para comenzar otra historia"
                placeholderTextColor={videoColors.muted}
              />
              <Button
                label={
                  manageBusy
                    ? "Guardando, espera…"
                    : "Vincular video como borrador"
                }
                disabled={manageBusy || !asset || !title.trim()}
                onPress={() => void upload()}
              />
              <Text style={[s.h2, { marginTop: 24 }]}>
                Videos de esta propiedad
              </Text>
              {managed.map((v) => (
                <View key={v.id} style={s.select}>
                  <Text style={s.h2}>{v.title}</Text>
                  <Text style={s.muted}>
                    {v.status === "published" ? "Publicado" : "Borrador"} ·{" "}
                    {(v.size_bytes / 1024 / 1024).toFixed(1)} MB
                  </Text>
                  <Button
                    label={
                      v.status === "published" ? "Despublicar" : "Publicar"
                    }
                    disabled={manageBusy}
                    onPress={() =>
                      void videoStatus(
                        v,
                        v.status === "published" ? "draft" : "published",
                      )
                    }
                  />
                  <Button
                    label="Archivar video"
                    secondary
                    disabled={manageBusy}
                    onPress={() =>
                      Alert.alert(
                        "Archivar video",
                        "Dejará de aparecer en el feed y en esta lista.",
                        [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: "Archivar",
                            onPress: () => void videoStatus(v, "archived"),
                          },
                        ],
                      )
                    }
                  />
                </View>
              ))}
            </>
          )}
          {manageBusy && <ActivityIndicator color={videoColors.cyan} />}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
  return (
    <ScreenContext.Provider
      value={{
        feed: feedScreen,
        catalog: catalogScreen,
        messages: (
          <MessagesScreen
            notificationStatus={notifications.status}
            onRetryNotifications={notifications.retry}
            key={[
              session?.user.id,
              conversationId,
              recipientId,
              propertyId,
            ].join(":")}
            session={session}
            conversationId={conversationId}
            recipientId={recipientId}
            propertyId={propertyId}
          />
        ),
        account: accountScreen,
        manage: socialEnabled ? (
          <VideoProfile
            key={
              videoId
                ? videoId + ":" + propertyMode
                : profileSection || "profile"
            }
            initialSection={profileSection}
            pendingVideoId={videoId}
            propertyMode={propertyMode}
            propertyFavorite={{ ids: favorites, toggle: favorite }}
            session={session}
            onPropertiesChanged={() => {
              void loadMine();
              void loadFeed(true);
            }}
          />
        ) : (
          manageScreen
        ),
        videoProfile: (
          <VideoProfile
            session={session}
            userId={userId}
            propertyFavorite={{ ids: favorites, toggle: favorite }}
          />
        ),
        notificationVideo: (
          <NotificationVideoScreen
            key={videoId + ":" + commentId}
            videoId={videoId}
            commentId={commentId}
            session={session}
          />
        ),
        activity: (
          <ActivityScreen
            key={session?.user.id || "guest"}
            session={session}
            onChanged={() => setActivityRevision((value) => value + 1)}
          />
        ),
        savedSearches: (
          <SavedSearchesScreen
            key={session?.user.id || "guest"}
            session={session}
          />
        ),
        active: tab,
        recorder: recordingRoute ? (
          <VideoRecorder
            propertyId={propertyId}
            session={session}
            onPublished={() => {
              void loadFeed(true);
              setSelected(null);
            }}
            onSaved={() => {
              setSelected(null);
            }}
          />
        ) : null,
      }}
    >
      <SafeAreaView
        style={[
          s.safe,
          tab === "feed" && !propertyRoute && { backgroundColor: "#052b65" },
        ]}
        edges={
          recordingRoute
            ? ["top", "left", "right", "bottom"]
            : ["top", "left", "right"]
        }
      >
        <StatusBar
          style={
            recordingRoute || (tab === "feed" && !propertyRoute)
              ? "light"
              : "dark"
          }
        />
        {!recordingRoute && tab !== "catalog" && (
          <View style={s.header}>
            <ProppixBrand compact />
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Buscar propiedades"
                onPress={() => setTab("catalog")}
                style={{ padding: 9 }}
              >
                <ProppixIcon name="search" size={25} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir menú"
                onPress={() => setAccountMenu(true)}
                style={{ padding: 9 }}
              >
                <ProppixIcon name="menu" size={25} />
              </Pressable>
              <ActivityBell unread={activityUnread} />
            </View>
          </View>
        )}
        <Modal
          visible={accountMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setAccountMenu(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "#0009",
              paddingTop: 64,
              paddingHorizontal: 16,
              alignItems: "flex-end",
            }}
            onPress={() => setAccountMenu(false)}
          >
            <View
              style={{
                backgroundColor: videoColors.surface,
                padding: 12,
                borderRadius: 16,
                width: 225,
              }}
            >
              <Button
                label={
                  activityUnread ? `Actividad (${activityUnread})` : "Actividad"
                }
                secondary
                onPress={() => {
                  setAccountMenu(false);
                  router.push("/actividad");
                }}
              />
              <Button
                label="Cuenta"
                secondary
                onPress={() => {
                  setAccountMenu(false);
                  setTab("account");
                }}
              />
              <Button
                label="Mis búsquedas"
                secondary
                onPress={() => {
                  setAccountMenu(false);
                  router.push("/busquedas");
                }}
              />
              <Button
                label="Mi Perfil"
                secondary
                onPress={() => {
                  setAccountMenu(false);
                  setTab("manage");
                }}
              />
              <Button
                label="Mis Propiedades"
                secondary
                onPress={() => {
                  setAccountMenu(false);
                  if (!session) setTab("account");
                  else
                    router.replace({
                      pathname: "/mis-videos",
                      params: { profileSection: "properties" },
                    });
                }}
              />
            </View>
          </Pressable>
        </Modal>
        <Slot />

        {!recordingRoute && (
          <SafeAreaView edges={["bottom"]} style={s.navSafe}>
            <View accessibilityRole="tablist" style={s.nav}>
              {tabs.map((item) => {
                const selectedTab = tab === item.key;
                const color = selectedTab ? "#0866f5" : "#0b295a";
                return (
                  <Pressable
                    accessibilityRole={
                      item.key === "publish" ? "button" : "tab"
                    }
                    accessibilityState={{ selected: selectedTab }}
                    accessibilityLabel={item.label}
                    key={item.key}
                    style={s.navItem}
                    onPress={() =>
                      item.key === "publish"
                        ? router.push("/grabar")
                        : setTab(item.key)
                    }
                  >
                    {item.key === "publish" ? (
                      <View style={s.publishCircle}>
                        <ProppixIcon name="plus" size={31} />
                      </View>
                    ) : item.key === "catalog" ? (
                      <Text style={[s.propertyNavIcon, { color }]}>P</Text>
                    ) : (
                      <ProppixIcon
                        name={item.icon!}
                        size={25}
                        color={color}
                        filled={selectedTab}
                      />
                    )}
                    <Text
                      style={[
                        s.navLabel,
                        { color },
                        selectedTab && { fontWeight: "700" },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {selectedTab && <View style={s.navIndicator} />}
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaView>
        )}
        <Modal
          visible={propertyRoute && !!detail}
          animationType="slide"
          onRequestClose={closeDetail}
        >
          <SafeAreaView style={s.safe}>
            <ScrollView style={s.content} keyboardShouldPersistTaps="handled">
              <Button
                label="← Volver al recorrido"
                secondary
                onPress={closeDetail}
              />
              {detail && (
                <>
                  {detailBusy && <ActivityIndicator color={videoColors.cyan} />}
                  {contact === "1" && (
                    <>
                      <Text style={s.h2}>{detail.title}</Text>
                      <ContactProperty
                        key={detail.id}
                        property={detail}
                        session={session}
                      />
                    </>
                  )}
                  <PropertySlideshow key={detail.id} media={detail.media} />
                  <Text style={s.eyebrow}>
                    {detail.commune_name} · {detail.region_name}
                  </Text>
                  <Text style={s.h1}>{detail.title}</Text>
                  <Text style={s.accent}>{price(detail)}</Text>
                  <Text style={s.muted}>{detail.description}</Text>
                  <Text style={s.h2}>{detail.advertiser.name}</Text>
                  {contact !== "1" && (
                    <ContactProperty
                      key={detail.id}
                      property={detail}
                      session={session}
                    />
                  )}
                  {detail.is_demo ? (
                    <View style={s.info}>
                      <Text style={s.demo}>PUBLICACIÓN DE EJEMPLO</Text>
                      <Text style={s.muted}>
                        Datos e imágenes ficticios. No recibe consultas ni
                        visitas.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {detail.advertiser.phone && (
                        <Button
                          label="Llamar al anunciante"
                          onPress={() =>
                            void Linking.openURL(
                              `tel:${detail.advertiser.phone!.replace(/[^\d+]/g, "")}`,
                            ).catch(() =>
                              Alert.alert(
                                "No disponible",
                                "Este dispositivo no puede realizar llamadas.",
                              ),
                            )
                          }
                        />
                      )}
                      <Button
                        label={
                          favorites.includes(detail.id)
                            ? "Quitar de favoritos"
                            : "Guardar en favoritos"
                        }
                        secondary
                        onPress={() => void favorite(detail.id)}
                      />
                    </>
                  )}
                  <View style={{ height: 40 }} />
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </ScreenContext.Provider>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: videoColors.background },
  header: {
    height: 72,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#052b65",
  },
  brand: { fontSize: 24, fontWeight: "800", color: "#fff", letterSpacing: -1 },
  headerSub: { fontSize: 9, color: videoColors.muted, marginTop: 3 },
  local: {
    fontSize: 10,
    letterSpacing: 2,
    color: videoColors.cyan,
    borderWidth: 1,
    borderColor: videoColors.border,
    borderRadius: 6,
    padding: 7,
  },
  feed: { flex: 1, backgroundColor: "#000" },
  videoCreate: { color: videoColors.cyan },
  content: { flex: 1, padding: 22 },
  welcome: { flex: 1, justifyContent: "center", padding: 28, gap: 20 },
  hero: {
    fontSize: 39,
    fontWeight: "800",
    color: videoColors.text,
    letterSpacing: -1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: videoColors.cyan,
    marginTop: 10,
    marginBottom: 12,
  },
  h1: {
    fontSize: 31,
    fontWeight: "800",
    color: videoColors.text,
    marginBottom: 20,
    letterSpacing: -1,
  },
  h2: {
    fontSize: 17,
    fontWeight: "700",
    color: videoColors.text,
    marginBottom: 8,
  },
  muted: {
    fontSize: 14,
    color: videoColors.muted,
    lineHeight: 23,
    marginBottom: 12,
  },
  code: { fontSize: 11, color: videoColors.muted, marginVertical: 12 },
  button: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: videoColors.cyan,
    alignItems: "center",
    marginVertical: 8,
  },
  secondary: {
    backgroundColor: videoColors.surface,
    borderWidth: 1,
    borderColor: videoColors.border,
  },
  buttonLabel: { fontWeight: "800", color: "#fff" },
  label: {
    fontSize: 13,
    color: videoColors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: videoColors.border,
    borderRadius: 12,
    padding: 15,
    color: videoColors.text,
    backgroundColor: videoColors.surface,
    fontSize: 15,
  },
  error: { color: "#a12b36", lineHeight: 23, paddingVertical: 10 },
  info: {
    padding: 20,
    backgroundColor: videoColors.surface,
    borderRadius: 18,
    marginVertical: 24,
  },
  empty: { padding: 30, justifyContent: "center", alignItems: "stretch" },
  navSafe: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  nav: {
    flexDirection: "row",
    height: 74,
    paddingHorizontal: 5,
  },
  navItem: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 13,
    alignItems: "center",
    gap: 6,
  },
  publishCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0866f5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -15,
    borderWidth: 3,
    borderColor: "#fff",
  },
  propertyNavIcon: { fontSize: 29, fontWeight: "800", lineHeight: 29 },
  navIndicator: {
    position: "absolute",
    height: 3,
    backgroundColor: "#0866f5",
    borderRadius: 2,
    bottom: 3,
    width: 43,
  },
  messageScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  messageIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "#0c315e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  navIcon: { color: videoColors.muted, fontSize: 23 },
  navLabel: { fontSize: 10, color: "#0b295a" },
  active: { color: videoColors.text },
  propertyCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: videoColors.surface,
    marginBottom: 20,
  },
  propertyImage: {
    height: 220,
    width: "100%",
    backgroundColor: videoColors.surface,
  },
  pad: { padding: 18 },
  accent: {
    fontSize: 24,
    fontWeight: "800",
    color: videoColors.cyan,
    marginBottom: 10,
  },
  demo: {
    fontSize: 10,
    color: videoColors.cyan,
    letterSpacing: 1,
    marginVertical: 10,
  },
  select: {
    padding: 18,
    borderWidth: 1,
    borderColor: videoColors.border,
    borderRadius: 16,
    marginVertical: 8,
  },
});
