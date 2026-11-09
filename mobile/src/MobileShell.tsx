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
  Image,
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
  mediaUrl,
  Page,
  price,
  Property,
  Session,
  Video,
} from "./api";
import { ScreenContext } from "./screen-context";
import { videoColors } from "./video-colors";
import { VideoCard } from "./VideoCard";
import { VideoRecorder } from "./VideoRecorder";
import { SellerPanel } from "./SellerPanel";
import { ContactProperty } from "./ContactProperty";
import { VideoProfile } from "./VideoProfile";

type Tab = "feed" | "catalog" | "manage" | "account";
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
  const routes: Record<Tab, "/" | "/propiedades" | "/mis-videos" | "/cuenta"> =
    {
      feed: "/",
      catalog: "/propiedades",
      manage: "/mis-videos",
      account: "/cuenta",
    };
  const propertyRoute = pathname.startsWith("/property/");
  const recordingRoute = pathname === "/grabar";
  const profileRoute = pathname.startsWith("/perfil/");
  const { propertyId, from, userId, videoId, propertyMode } =
    useGlobalSearchParams<{
      propertyId?: string;
      from?: Tab;
      userId?: string;
      videoId?: string;
      propertyMode?: "new" | "link";
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
          : pathname === "/cuenta"
            ? "account"
            : "feed";
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
  const setTab = (value: Tab) => {
    setDetail(null);
    router.replace(routes[value]);
  };
  const closeDetail = useCallback(() => {
    setDetail(null);
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);
  const [videos, setVideos] = useState<Video[]>([]),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(1),
    [loading, setLoading] = useState(false),
    [feedError, setFeedError] = useState(""),
    [active, setActive] = useState(0),
    [height, setHeight] = useState(1),
    [muted, setMuted] = useState(true),
    [foreground, setForeground] = useState(AppState.currentState === "active");
  const feedRef = useRef<FlatList<Video>>(null),
    busy = useRef(false),
    feedGeneration = useRef(0),
    mounted = useRef(true),
    favoriteBusy = useRef(false);
  const [catalog, setCatalog] = useState<Property[]>([]),
    [catalogPage, setCatalogPage] = useState(0),
    [catalogPages, setCatalogPages] = useState(1),
    [catalogBusy, setCatalogBusy] = useState(false),
    [catalogError, setCatalogError] = useState("");
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
    if (busy.current || (!reset && page >= pages)) return;
    busy.current = true;
    setLoading(true);
    setFeedError("");
    const generation = reset
        ? ++feedGeneration.current
        : feedGeneration.current,
      next = reset ? 1 : page + 1;
    try {
      const data = await api<Page<Video>>(`/videos?page=${next}`);
      if (generation !== feedGeneration.current || !mounted.current) return;
      setVideos((v) =>
        reset
          ? data.items
          : [...v, ...data.items.filter((x) => !v.some((y) => y.id === x.id))],
      );
      setPage(data.page);
      setPages(data.pages);
      if (data.total === 0) await loadCatalog(true);
      if (reset) {
        setActive(0);
        feedRef.current?.scrollToOffset({ offset: 0, animated: false });
      }
    } catch (e) {
      if (generation === feedGeneration.current) setFeedError(message(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  async function loadCatalog(reset = false) {
    if (catalogBusy) return;
    setCatalogBusy(true);
    setCatalogError("");
    try {
      const data = await api<Page<Property>>(
        `/properties?limit=12&page=${reset ? 1 : catalogPage + 1}&sort=recent`,
      );
      setCatalog((v) =>
        reset
          ? data.items
          : [...v, ...data.items.filter((x) => !v.some((p) => p.id === x.id))],
      );
      setCatalogPage(data.page);
      setCatalogPages(data.pages);
    } catch (e) {
      setCatalogError(message(e));
    } finally {
      setCatalogBusy(false);
    }
  }
  const onReady = useEffectEvent(() => {
    void loadFeed(true);
    void loadCatalog(true);
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
  function openDetail(p: Property) {
    setDetail(p);
    router.push({
      pathname: "/property/[propertyId]",
      params: { propertyId: p.id, from: tab },
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
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "feed", label: "Descubrir", icon: "▶" },
    { key: "catalog", label: "Propiedades", icon: "⌂" },
    {
      key: "manage",
      label: socialEnabled ? "Perfil" : "Mis videos",
      icon: socialEnabled ? "○" : "＋",
    },
    { key: "account", label: "Cuenta", icon: "○" },
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
          ref={feedRef}
          data={videos}
          keyExtractor={(v) => v.id}
          pagingEnabled
          snapToInterval={height}
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
          extraData={`${active}-${muted}-${foreground}-${!!detail}-${favorites.join(",")}`}
          onMomentumScrollEnd={(e) =>
            setActive(Math.round(e.nativeEvent.contentOffset.y / height))
          }
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.y / height);
            setActive(i);
          }}
          scrollEventThrottle={100}
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
              active={index === active && foreground && !detail}
              nearby={Math.abs(index - active) <= 1}
              muted={muted}
              social={socialEnabled}
              session={session}
              favorite={favorites.includes(item.property_id || "")}
              onMute={() => setMuted((v) => !v)}
              onFavorite={() => {
                if (item.property_id) void favorite(item.property_id);
              }}
              onDetails={() => {
                if (item.property) void openDetail(item.property);
              }}
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
    <ScrollView
      style={s.content}
      refreshControl={
        <RefreshControl
          refreshing={catalogBusy}
          onRefresh={() => void loadCatalog(true)}
        />
      }
    >
      <Text style={s.eyebrow}>EL MISMO CATÁLOGO, OTRA EXPERIENCIA</Text>
      <Text style={s.h1}>Encuentra tu lugar</Text>
      {!!catalogError && <Text style={s.error}>{catalogError}</Text>}
      {catalog.map((p) => (
        <Pressable
          accessibilityRole="button"
          key={p.id}
          style={s.propertyCard}
          onPress={() => void openDetail(p)}
        >
          {!!p.media[0] && (
            <Image
              source={{ uri: mediaUrl(p.media[0].url) }}
              style={s.propertyImage}
            />
          )}
          <View style={s.pad}>
            <Text style={s.accent}>{price(p)}</Text>
            <Text style={s.h2}>{p.title}</Text>
            <Text style={s.muted}>
              {p.commune_name} · {p.region_name}
            </Text>
            {p.is_demo && <Text style={s.demo}>EJEMPLO · DATOS FICTICIOS</Text>}
          </View>
        </Pressable>
      ))}
      {catalogPage < catalogPages && (
        <Button
          label={catalogBusy ? "Cargando…" : "Ver más propiedades"}
          disabled={catalogBusy}
          onPress={() => void loadCatalog(false)}
        />
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
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
        account: accountScreen,
        manage: socialEnabled ? (
          <VideoProfile
            key={videoId ? videoId + ":" + propertyMode : "profile"}
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
      <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
        <StatusBar style="light" />
        {!recordingRoute && (
          <View style={s.header}>
            <View>
              <Image
                source={require("../assets/icon.png")}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  marginBottom: 4,
                }}
              />
              <Text style={s.brand}>
                proppix
                <Text
                  style={{
                    color: videoColors.pink,
                  }}
                >
                  .
                </Text>
              </Text>
              <Text style={s.headerSub}>
                Descubre un lugar para tu próxima historia
              </Text>
            </View>
            <Text style={s.local}>{IS_PRODUCTION ? "APP" : "LOCAL"}</Text>
          </View>
        )}
        <Slot />

        {!recordingRoute && (
          <View style={s.nav}>
            {socialEnabled && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Crear video sin propiedad"
                onPress={() => router.push("/grabar")}
                style={s.navItem}
              >
                <Text style={[s.navIcon, s.active, s.videoCreate]}>＋</Text>
                <Text style={s.navLabel}>Crear</Text>
              </Pressable>
            )}
            {tabs.map((t) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t.key }}
                key={t.key}
                onPress={() => setTab(t.key)}
                style={s.navItem}
              >
                <Text style={[s.navIcon, tab === t.key && s.active]}>
                  {t.icon}
                </Text>
                <Text style={[s.navLabel, tab === t.key && s.active]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <Modal
          visible={propertyRoute && !!detail}
          animationType="slide"
          onRequestClose={closeDetail}
        >
          <SafeAreaView style={s.safe}>
            <ScrollView style={s.content}>
              <Button
                label="← Volver al recorrido"
                secondary
                onPress={closeDetail}
              />
              {detail && (
                <>
                  {detailBusy && <ActivityIndicator color={videoColors.cyan} />}
                  {detail.media.map((m) => (
                    <Image
                      key={m.id}
                      source={{ uri: mediaUrl(m.url) }}
                      style={[
                        s.propertyImage,
                        { marginBottom: 10, borderRadius: 18 },
                      ]}
                    />
                  ))}
                  <Text style={s.eyebrow}>
                    {detail.commune_name} · {detail.region_name}
                  </Text>
                  <Text style={s.h1}>{detail.title}</Text>
                  <Text style={s.accent}>{price(detail)}</Text>
                  <Text style={s.muted}>{detail.description}</Text>
                  <Text style={s.h2}>{detail.advertiser.name}</Text>
                  <ContactProperty
                    key={detail.id}
                    property={detail}
                    session={session}
                  />
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
    height: 68,
    paddingHorizontal: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: videoColors.border,
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
  feed: { flex: 1, backgroundColor: videoColors.background },
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
  buttonLabel: { fontWeight: "800", color: "#111111" },
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
    color: "#fff",
    backgroundColor: videoColors.surface,
    fontSize: 15,
  },
  error: { color: "#ffc7b9", lineHeight: 23, paddingVertical: 10 },
  info: {
    padding: 20,
    backgroundColor: videoColors.surface,
    borderRadius: 18,
    marginVertical: 24,
  },
  empty: { padding: 30, justifyContent: "center", alignItems: "stretch" },
  nav: {
    flexDirection: "row",
    height: 66,
    borderTopWidth: 1,
    borderColor: videoColors.border,
  },
  navItem: { flex: 1, justifyContent: "center", alignItems: "center", gap: 3 },
  navIcon: { color: videoColors.muted, fontSize: 23 },
  navLabel: { fontSize: 10, color: videoColors.muted },
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
