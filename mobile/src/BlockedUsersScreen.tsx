import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, Session } from "./api";
import { notifyModerationChange } from "./moderation-events";
import { ProppixIcon } from "./ProppixIcon";
type Person = { id: string; display_name: string };
export function BlockedUsersScreen({ session }: { session: Session | null }) {
  const router = useRouter();
  const [items, setItems] = useState<Person[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      void api<{ items: Person[] }>("/me/blocks", {
        token: session.access_token,
        signal: controller.signal,
      })
        .then((page) => {
          if (!controller.signal.aborted) {
            setItems(page.items);
            setError("");
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [session, retry]);
  async function unblock(person: Person) {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await api(`/me/blocks/${person.id}`, {
        method: "POST",
        token: session.access_token,
        body: { active: false },
      });
      setItems((old) => old.filter((row) => row.id !== person.id));
      notifyModerationChange({ userId: person.id, blocked: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo desbloquear.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.root}>
      <View style={s.heading}>
        <Text style={s.title}>Usuarios bloqueados</Text>
        <Pressable
          accessibilityLabel="Cerrar usuarios bloqueados"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={{ padding: 10 }}
        >
          <ProppixIcon name="close" color="#052553" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.text}>
          Desbloquear no restaura los seguimientos anteriores. Si la otra cuenta
          también te bloqueó, ese bloqueo sigue vigente.
        </Text>
        {busy && <ActivityIndicator color="#0866f5" />}
        {!!error && (
          <>
            <Text accessibilityRole="alert" style={{ color: "#a42c3a" }}>
              {error}
            </Text>
            <Pressable onPress={() => setRetry((n) => n + 1)}>
              <Text style={s.blue}>Reintentar</Text>
            </Pressable>
          </>
        )}
        {!session ? (
          <Pressable onPress={() => router.push("/cuenta")}>
            <Text style={s.blue}>Iniciar sesión</Text>
          </Pressable>
        ) : (
          !busy &&
          !items.length && (
            <Text style={s.text}>No tienes usuarios bloqueados.</Text>
          )
        )}
        {items.map((person) => (
          <View key={person.id} style={s.row}>
            <Text style={[s.text, { flex: 1, fontWeight: "700" }]}>
              {person.display_name}
            </Text>
            <Pressable
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  "Desbloquear usuario",
                  `¿Desbloquear a ${person.display_name}?`,
                  [
                    { text: "Cancelar" },
                    {
                      text: "Desbloquear",
                      onPress: () => void unblock(person),
                    },
                  ],
                )
              }
            >
              <Text style={s.blue}>Desbloquear</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  heading: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#052553", fontWeight: "800", fontSize: 22, flexShrink: 1 },
  content: { padding: 22, gap: 20 },
  text: { color: "#33506d", fontSize: 14, lineHeight: 22 },
  blue: { color: "#0866f5", fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#eff8ff",
  },
});
