import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, Session } from "./api";
import { SavedSearch, searchDescription } from "./saved-search-types";
import { ProppixIcon } from "./ProppixIcon";
type Match = {
  id: string;
  property_id: string;
  search_name: string;
  title: string;
  commune_name: string | null;
  read_at: string | null;
  price_amount: string | null;
  price_unit: string;
};
export function SavedSearchesScreen({ session }: { session: Session | null }) {
  const router = useRouter(),
    token = session?.access_token;
  const [items, setItems] = useState<SavedSearch[]>([]),
    [matches, setMatches] = useState<Match[]>([]),
    [next, setNext] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [section, setSection] = useState<"searches" | "matches">("searches");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(
    async (before?: string) => {
      if (!token) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setBusy(true);
      setError("");
      try {
        if (section === "searches") {
          const page = await api<{ items: SavedSearch[] }>(
            "/me/saved-searches",
            { token, signal: controller.signal },
          );
          if (!controller.signal.aborted) setItems(page.items);
        } else {
          const page = await api<{
            items: Match[];
            next_cursor: string | null;
          }>(
            `/me/saved-searches/matches${before ? "?before=" + encodeURIComponent(before) : ""}`,
            { token, signal: controller.signal },
          );
          if (!controller.signal.aborted) {
            setMatches((old) =>
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
          }
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo cargar.");
      } finally {
        if (request.current === controller) setBusy(false);
      }
    },
    [token, section],
  );
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
    };
  }, [load]);
  async function toggle(item: SavedSearch) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<SavedSearch>(`/me/saved-searches/${item.id}`, {
        method: "PATCH",
        token,
        body: { enabled: !item.enabled },
      });
      setItems((old) => old.map((row) => (row.id === item.id ? updated : row)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: SavedSearch) {
    setBusy(true);
    setError("");
    try {
      await api(`/me/saved-searches/${item.id}`, { method: "DELETE", token });
      setItems((old) => old.filter((row) => row.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }
  async function open(match: Match) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/me/saved-searches/matches/${match.id}/read`, {
        method: "POST",
        token,
      });
      setMatches((old) =>
        old.map((row) =>
          row.id === match.id
            ? { ...row, read_at: new Date().toISOString() }
            : row,
        ),
      );
      router.push({
        pathname: "/property/[propertyId]",
        params: { propertyId: match.property_id, from: "catalog" },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.root}>
      <View style={s.heading}>
        <Text style={s.title}>Mis búsquedas</Text>
        <Pressable
          accessibilityLabel="Cerrar búsquedas"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/propiedades")
          }
          style={{ padding: 10 }}
        >
          <ProppixIcon name="close" color="#052553" />
        </Pressable>
      </View>
      {!session ? (
        <View style={s.empty}>
          <Text style={s.text}>
            Inicia sesión para guardar búsquedas y recibir alertas.
          </Text>
          <Pressable style={s.primary} onPress={() => router.push("/cuenta")}>
            <Text style={s.white}>Iniciar sesión</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={s.tabs}>
            {[
              { id: "searches" as const, label: "Búsquedas" },
              { id: "matches" as const, label: "Novedades" },
            ].map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setSection(tab.id)}
                style={[s.tab, section === tab.id && s.active]}
              >
                <Text style={[s.link, section === tab.id && s.white]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              disabled={busy}
              accessibilityLabel="Actualizar búsquedas"
              onPress={() => void load()}
              style={{ padding: 10 }}
            >
              <ProppixIcon name="refresh" color="#0866f5" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.content}>
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            {busy && <ActivityIndicator color="#0866f5" />}
            {section === "searches" ? (
              <>
                <Text style={s.muted}>
                  Te avisaremos cuando se publique una nueva propiedad que
                  coincida. Puedes pausar las alertas cuando quieras.
                </Text>
                {!busy && !items.length && (
                  <Text style={s.text}>
                    Todavía no tienes búsquedas guardadas. Elige filtros en
                    Propiedades y pulsa “Guardar búsqueda”.
                  </Text>
                )}
                {items.map((item) => (
                  <View key={item.id} style={s.card}>
                    <View style={s.row}>
                      <Text style={s.name}>{item.name}</Text>
                      <Switch
                        accessibilityLabel={`Alertas de ${item.name}`}
                        value={item.enabled}
                        disabled={busy}
                        onValueChange={() => void toggle(item)}
                        trackColor={{ false: "#d6e1ec", true: "#85d9f4" }}
                        thumbColor={item.enabled ? "#0866f5" : "#fff"}
                      />
                    </View>
                    <Text style={s.text}>
                      {searchDescription(item.filters)}
                    </Text>
                    <Text style={s.muted}>
                      {item.enabled ? "Alertas activas" : "Alertas pausadas"}
                    </Text>
                    <View style={s.row}>
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/propiedades",
                            params: { savedSearchId: item.id },
                          })
                        }
                      >
                        <Text style={s.link}>Ver resultados</Text>
                      </Pressable>
                      <Pressable
                        disabled={busy}
                        onPress={() =>
                          Alert.alert(
                            "Eliminar búsqueda",
                            `Se eliminará “${item.name}” y dejarás de recibir sus alertas.`,
                            [
                              { text: "Cancelar", style: "cancel" },
                              {
                                text: "Eliminar",
                                style: "destructive",
                                onPress: () => void remove(item),
                              },
                            ],
                          )
                        }
                      >
                        <Text style={s.error}>Eliminar</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                <Pressable
                  style={s.primary}
                  onPress={() => router.push("/propiedades")}
                >
                  <Text style={s.white}>Buscar propiedades</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.muted}>
                  Las coincidencias nuevas quedan guardadas aquí, aunque no
                  tengas activados los avisos del teléfono.
                </Text>
                {!busy && !matches.length && (
                  <Text style={s.text}>
                    Todavía no hay propiedades nuevas para tus búsquedas. Las
                    que ya existían al guardarlas se consultan en “Ver
                    resultados”.
                  </Text>
                )}
                {matches.map((match) => (
                  <Pressable
                    key={match.id}
                    disabled={busy}
                    onPress={() => void open(match)}
                    style={[s.card, !match.read_at && s.unread]}
                  >
                    <Text style={s.link}>
                      {match.search_name}
                      {!match.read_at ? " · Nueva" : ""}
                    </Text>
                    <Text style={s.name}>{match.title}</Text>
                    <Text style={s.text}>
                      {match.commune_name}
                      {match.price_amount
                        ? ` · ${match.price_unit === "CLP" ? "$" : ""}${Number(match.price_amount).toLocaleString("es-CL")}${match.price_unit === "UF" ? " UF" : ""}`
                        : ""}
                    </Text>
                    <Text style={s.link}>Ver propiedad →</Text>
                  </Pressable>
                ))}
                {next && (
                  <Pressable
                    disabled={busy}
                    style={s.primary}
                    onPress={() => void load(next)}
                  >
                    <Text style={s.white}>Cargar más</Text>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  heading: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 26, fontWeight: "800", color: "#052553" },
  tabs: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  tab: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: "#edf5fc",
  },
  active: { backgroundColor: "#0866f5" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe8f4",
    gap: 12,
  },
  unread: { backgroundColor: "#effaff", borderColor: "#9bdef5" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  name: { flexShrink: 1, fontSize: 17, fontWeight: "700", color: "#052553" },
  text: { color: "#33506d", lineHeight: 22 },
  muted: { color: "#6c7f94", fontSize: 13, lineHeight: 20 },
  link: { color: "#0866f5", fontWeight: "700" },
  error: { color: "#a42c3a" },
  primary: {
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
    backgroundColor: "#0866f5",
  },
  white: { color: "#fff", fontWeight: "700" },
  empty: { padding: 24, gap: 20 },
});
