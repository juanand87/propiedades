import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, mediaUrl, Session } from "./api";
import { ProppixIcon } from "./ProppixIcon";

type ActivityItem = {
  id: string;
  kind: "comment" | "reply";
  comment_id: string;
  video_id: string;
  body: string;
  title: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  read_at: string | null;
};
type ActivityPage = {
  items: ActivityItem[];
  unread_count: number;
  next_cursor: string | null;
};

export function ActivityScreen({
  session,
  onChanged,
}: {
  session: Session | null;
  onChanged: () => void;
}) {
  const router = useRouter();
  const token = session?.access_token;
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(
    async (before?: string) => {
      if (!token) return;
      if (before && request.current) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          limit: "20",
          unread: String(unreadOnly),
        });
        if (before) query.set("before", before);
        const page = await api<ActivityPage>(`/me/activity?${query}`, {
          token,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setItems((old) =>
          before
            ? [
                ...old,
                ...page.items.filter(
                  (item) => !old.some((row) => row.id === item.id),
                ),
              ]
            : page.items,
        );
        setNext(page.next_cursor);
        setUnread(page.unread_count);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la actividad.",
          );
      } finally {
        if (request.current === controller) {
          request.current = null;
          setLoading(false);
        }
      }
    },
    [token, unreadOnly],
  );
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
      request.current = null;
    };
  }, [load]);
  async function open(item: ActivityItem) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (!item.read_at) {
        await api(`/me/activity/${item.id}/read`, { method: "POST", token });
        setItems((old) =>
          old.map((row) =>
            row.id === item.id
              ? { ...row, read_at: new Date().toISOString() }
              : row,
          ),
        );
        setUnread((old) => Math.max(0, old - 1));
        onChanged();
      }
      router.push({
        pathname: "/video/[videoId]",
        params: { videoId: item.video_id, commentId: item.comment_id },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el aviso.");
    } finally {
      setSaving(false);
    }
  }
  async function markAll() {
    if (saving || !items.length) return;
    setSaving(true);
    setError("");
    try {
      await api("/me/activity/read-all", {
        method: "POST",
        token,
        body: { through_id: items[0].id },
      });
      onChanged();
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar la actividad.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (!session)
    return (
      <View style={s.empty}>
        <ProppixIcon name="bell" color="#0866f5" size={40} />
        <Text style={s.title}>Tu actividad en Proppix</Text>
        <Text style={s.muted}>
          Inicia sesión para ver comentarios y respuestas.
        </Text>
        <Pressable style={s.primary} onPress={() => router.push("/cuenta")}>
          <Text style={s.primaryText}>Iniciar sesión</Text>
        </Pressable>
      </View>
    );
  return (
    <View style={s.root}>
      <View style={s.heading}>
        <View>
          <Text style={s.title}>Actividad</Text>
          <Text style={s.muted}>
            {unread ? `${unread} sin leer` : "Estás al día"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar actividad"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={s.close}
        >
          <ProppixIcon name="close" color="#052553" />
        </Pressable>
      </View>
      <View style={s.filters}>
        {[
          { label: "Todas", value: false },
          { label: "Sin leer", value: true },
        ].map((filter) => (
          <Pressable
            key={filter.label}
            accessibilityRole="button"
            accessibilityState={{ selected: unreadOnly === filter.value }}
            onPress={() => {
              if (unreadOnly === filter.value) return;
              setItems([]);
              setNext(null);
              setLoading(true);
              setUnreadOnly(filter.value);
            }}
            style={[s.chip, unreadOnly === filter.value && s.chipSelected]}
          >
            <Text
              style={[
                s.chipText,
                unreadOnly === filter.value && s.selectedText,
              ]}
            >
              {filter.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          disabled={saving || !unread || !items.length}
          onPress={() => void markAll()}
          style={s.markAll}
        >
          <Text style={[s.link, (!unread || saving) && { opacity: 0.4 }]}>
            Marcar leídas
          </Text>
        </Pressable>
      </View>
      {!!error && (
        <View style={s.errorBox}>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          <Pressable onPress={() => void load()}>
            <Text style={s.link}>Reintentar</Text>
          </Pressable>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshing={loading && !next}
        onRefresh={() => void load()}
        onEndReached={() => {
          if (next && !loading) void load(next);
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={
          !items.length ? { flexGrow: 1 } : { paddingBottom: 24 }
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 50 }} color="#0866f5" />
          ) : (
            <View style={s.empty}>
              <ProppixIcon name="bell" color="#0866f5" size={40} />
              <Text style={s.subtitle}>
                {unreadOnly
                  ? "No tienes avisos sin leer"
                  : "Aquí verás tu actividad"}
              </Text>
              <Text style={s.muted}>
                Los comentarios en tus videos y las respuestas a tus comentarios
                aparecerán aquí.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loading && items.length ? (
            <ActivityIndicator color="#0866f5" />
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={`${item.display_name} ${item.kind === "reply" ? "respondió a tu comentario" : "comentó tu video"}${!item.read_at ? ", sin leer" : ""}`}
            onPress={() => void open(item)}
            style={[s.row, !item.read_at && s.unreadRow]}
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
            <View style={s.content}>
              <Text style={s.copy}>
                <Text style={s.name}>{item.display_name}</Text>
                {item.kind === "reply"
                  ? " respondió a tu comentario"
                  : " comentó tu video"}
              </Text>
              <Text style={s.body} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={s.video} numberOfLines={1}>
                {item.title || "Video de Proppix"}
              </Text>
              <Text style={s.date}>
                {new Date(item.created_at).toLocaleString("es-CL", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            {!item.read_at && <View style={s.dot} />}
          </Pressable>
        )}
      />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  heading: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 27, fontWeight: "800", color: "#052553" },
  subtitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#052553",
    textAlign: "center",
  },
  muted: { fontSize: 14, color: "#62738a", lineHeight: 21 },
  close: { padding: 10 },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 22,
    backgroundColor: "#edf5fc",
  },
  chipSelected: { backgroundColor: "#0866f5" },
  chipText: { color: "#13558b", fontWeight: "700" },
  selectedText: { color: "#fff" },
  markAll: { marginLeft: "auto", paddingVertical: 10 },
  link: { color: "#0866f5", fontSize: 13, fontWeight: "700" },
  row: {
    flexDirection: "row",
    padding: 18,
    gap: 12,
    borderBottomColor: "#e8eff7",
    borderBottomWidth: 1,
    alignItems: "flex-start",
  },
  unreadRow: { backgroundColor: "#eff9ff" },
  avatar: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: "#dceffc",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: "#0866f5", fontSize: 20, fontWeight: "700" },
  content: { flex: 1, gap: 5 },
  copy: { color: "#17334c", fontSize: 15, lineHeight: 21 },
  name: { fontWeight: "800" },
  body: { color: "#445c73", fontSize: 14, lineHeight: 20 },
  video: { color: "#0866f5", fontSize: 13, fontWeight: "600" },
  date: { fontSize: 12, color: "#73859a", marginTop: 2 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0866f5",
    marginTop: 6,
  },
  empty: {
    flex: 1,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  primary: { backgroundColor: "#0866f5", padding: 16, borderRadius: 24 },
  primaryText: { color: "#fff", fontWeight: "700" },
  errorBox: { padding: 16, gap: 10, backgroundColor: "#fff3f2" },
  error: { color: "#9a2828" },
});
