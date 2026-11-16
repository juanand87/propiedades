import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, mediaUrl, Session } from "./api";
import { KeyboardSafeView } from "./KeyboardSafeView";
import { VideoProfileData } from "./social-types";
type Person = Pick<
  VideoProfileData,
  | "id"
  | "display_name"
  | "avatar_url"
  | "followed"
  | "username"
  | "profile_kind"
>;
type Results = { items: Person[]; has_more: boolean; page: number };
export function ProfileSearchScreen({ session }: { session: Session | null }) {
  const router = useRouter(),
    token = session?.access_token;
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState<"all" | "person" | "company">("all");
  const [items, setItems] = useState<Person[]>([]),
    [more, setMore] = useState(false),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [following, setFollowing] = useState<string[]>([]),
    [revision, setRevision] = useState(0);
  const generation = useRef(0),
    searchRequest = useRef<AbortController | null>(null),
    followRequests = useRef(new Map<string, AbortController>());
  const q = query.trim().replace(/^@/, "");
  const displayedQuery = useRef("");
  useEffect(() => {
    const controller = new AbortController(),
      run = ++generation.current;
    searchRequest.current?.abort();
    searchRequest.current = controller;
    const timer = setTimeout(() => {
      setItems([]);
      setMore(false);
      setError("");
      setPage(1);
      if (!token || q.length < 2) {
        setBusy(false);
        return;
      }
      setBusy(true);
      displayedQuery.current = q + "\n" + kind;
      void api<Results>(
        `/video-profiles/search?q=${encodeURIComponent(q)}&kind=${kind}&page=1`,
        { token, signal: controller.signal },
      )
        .then((result) => {
          if (!controller.signal.aborted && run === generation.current) {
            setItems(result.items);
            setMore(result.has_more);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted && run === generation.current)
            setError(e instanceof Error ? e.message : "No se pudo buscar.");
        })
        .finally(() => {
          if (!controller.signal.aborted && run === generation.current)
            setBusy(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, kind, token, revision]);
  useEffect(() => {
    const pending = followRequests.current;
    return () => {
      for (const request of pending.values()) request.abort();
      pending.clear();
    };
  }, []);
  async function next() {
    if (!token || busy || !more || displayedQuery.current !== q + "\n" + kind)
      return;
    const run = generation.current,
      controller = searchRequest.current;
    if (!controller || controller.signal.aborted) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Results>(
        `/video-profiles/search?q=${encodeURIComponent(q)}&kind=${kind}&page=${page + 1}`,
        { token, signal: controller.signal },
      );
      if (!controller.signal.aborted && run === generation.current) {
        setItems((old) => [
          ...old,
          ...result.items.filter((p) => !old.some((o) => o.id === p.id)),
        ]);
        setMore(result.has_more);
        setPage(result.page);
      }
    } catch (e) {
      if (!controller.signal.aborted && run === generation.current)
        setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      if (!controller.signal.aborted && run === generation.current)
        setBusy(false);
    }
  }
  async function follow(person: Person) {
    if (!token || followRequests.current.has(person.id)) return;
    const controller = new AbortController();
    followRequests.current.set(person.id, controller);
    setFollowing((ids) => [...ids, person.id]);
    setError("");
    try {
      const result = await api<VideoProfileData>(
        `/video-profiles/${person.id}/follow`,
        {
          method: "POST",
          token,
          signal: controller.signal,
          body: { active: !person.followed },
        },
      );
      if (!controller.signal.aborted)
        setItems((rows) =>
          rows.map((row) =>
            row.id === person.id ? { ...row, followed: result.followed } : row,
          ),
        );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "No se pudo seguir este perfil.",
        );
    } finally {
      followRequests.current.delete(person.id);
      if (!controller.signal.aborted)
        setFollowing((ids) => ids.filter((id) => id !== person.id));
    }
  }
  return (
    <KeyboardSafeView style={s.root}>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/mis-videos")
          }
        >
          <Text style={s.back}>‹</Text>
        </Pressable>
        <Text style={s.title}>Buscar perfiles</Text>
      </View>
      {!session ? (
        <View style={s.empty}>
          <Text style={s.text}>
            Inicia sesión para encontrar personas y empresas.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/cuenta")}
            style={s.follow}
          >
            <Text style={s.followText}>Iniciar sesión</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            autoFocus
            accessibilityLabel="Buscar por nombre o usuario"
            placeholder="Nombre, @usuario o empresa"
            placeholderTextColor="#526b85"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={100}
            style={s.input}
            returnKeyType="search"
            onSubmitEditing={() => setRevision((n) => n + 1)}
          />
          <View style={s.filters}>
            {(
              [
                ["all", "Todos"],
                ["person", "Personas"],
                ["company", "Empresas"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: kind === value }}
                key={value}
                style={[s.chip, kind === value && s.activeChip]}
                onPress={() => setKind(value)}
              >
                <Text style={[s.chipText, kind === value && { color: "#fff" }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {!!error && (
            <View style={s.errorBox}>
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRevision((n) => n + 1)}
              >
                <Text style={s.link}>Reintentar</Text>
              </Pressable>
            </View>
          )}
          <FlatList
            data={items}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 18, gap: 6 }}
            renderItem={({ item }) => (
              <View style={s.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ver perfil de ${item.display_name}`}
                  style={s.person}
                  onPress={() =>
                    router.push({
                      pathname: "/perfil/[userId]",
                      params: { userId: item.id },
                    })
                  }
                >
                  {item.avatar_url ? (
                    <Image
                      fadeDuration={0}
                      source={{ uri: mediaUrl(item.avatar_url) }}
                      style={s.avatar}
                    />
                  ) : (
                    <View style={s.avatar}>
                      <Text style={s.initial}>
                        {item.display_name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.name} numberOfLines={1}>
                      {item.display_name}
                    </Text>
                    {item.username && (
                      <Text style={s.muted} numberOfLines={1}>
                        @{item.username}
                      </Text>
                    )}
                    <Text style={s.kind}>
                      {item.profile_kind === "company"
                        ? "Empresa"
                        : item.profile_kind === "person"
                          ? "Persona"
                          : "Perfil"}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.followed ? "Dejar de seguir a" : "Seguir a"} ${item.display_name}`}
                  disabled={following.includes(item.id)}
                  onPress={() => void follow(item)}
                  style={[s.follow, item.followed && s.followed]}
                >
                  <Text
                    style={[
                      s.followText,
                      item.followed && { color: "#0866f5" },
                    ]}
                  >
                    {following.includes(item.id)
                      ? "…"
                      : item.followed
                        ? "Siguiendo"
                        : "Seguir"}
                  </Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              !busy && !error ? (
                <View style={s.empty}>
                  <Text style={s.muted}>
                    {q.length < 2
                      ? "Escribe al menos 2 caracteres del nombre o @usuario."
                      : "No encontramos perfiles con esa búsqueda."}
                  </Text>
                </View>
              ) : undefined
            }
            ListFooterComponent={
              <View style={{ gap: 15, paddingVertical: 20 }}>
                {busy && <ActivityIndicator color="#0866f5" />}
                {more && !busy && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void next()}
                  >
                    <Text style={[s.link, { textAlign: "center" }]}>
                      Cargar más perfiles
                    </Text>
                  </Pressable>
                )}
              </View>
            }
          />
        </>
      )}
    </KeyboardSafeView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", gap: 15, padding: 18 },
  back: { fontSize: 36, color: "#123b70" },
  title: { fontSize: 23, fontWeight: "800", color: "#123b70" },
  input: {
    marginHorizontal: 18,
    backgroundColor: "#edf6ff",
    borderRadius: 16,
    padding: 15,
    color: "#123b70",
    borderWidth: 1,
    borderColor: "#c9def4",
  },
  filters: { flexDirection: "row", gap: 9, padding: 18 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#edf6ff",
  },
  activeChip: { backgroundColor: "#0866f5" },
  chipText: { color: "#123b70", fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#edf2f8",
  },
  person: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#edf6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: "#0866f5", fontSize: 24, fontWeight: "700" },
  name: { color: "#123b70", fontSize: 16, fontWeight: "700" },
  muted: { color: "#526b85", lineHeight: 20 },
  kind: { color: "#0866f5", fontSize: 12 },
  follow: {
    backgroundColor: "#0866f5",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 86,
    alignItems: "center",
  },
  followed: { backgroundColor: "#edf6ff" },
  followText: { color: "#fff", fontWeight: "700" },
  empty: { padding: 25, gap: 18 },
  text: { color: "#123b70", fontSize: 16 },
  errorBox: { padding: 18, gap: 10 },
  error: { color: "#b02b3b" },
  link: { color: "#0866f5", fontWeight: "700" },
});
