import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, Session } from "./api";
import { KeyboardSafeView } from "./KeyboardSafeView";
import { useNightStyles } from "./appearance";
import { brandColors } from "./brand-colors";
const stages: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  visit_scheduled: "Visita agendada",
  negotiation: "En negociación",
  closed: "Cerrado",
};
type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  title: string;
  company_name: string;
  stage: string;
  revision: number;
  assignee_name: string | null;
};
type History = {
  notes: {
    id: string;
    message: string;
    author_name: string;
    created_at: string;
  }[];
};
export function LeadsScreen({ session }: { session: Session | null }) {
  const s = useNightStyles(styles),
    router = useRouter(),
    { inquiryId } = useLocalSearchParams<{ inquiryId?: string }>();
  const [items, setItems] = useState<Lead[]>([]),
    [selected, setSelected] = useState<Lead | null>(null),
    [history, setHistory] = useState<History | null>(null),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!session) return;
    const run = ++generation.current;
    setLoading(true);
    setError("");
    setSelected(null);
    setHistory(null);
    try {
      const token = session.access_token;
      if (inquiryId) {
        const lead = await api<Lead>(
          `/me/leads/${encodeURIComponent(inquiryId)}`,
          { token },
        );
        const h = await api<History>(`/me/leads/${lead.id}/history`, { token });
        if (run === generation.current) {
          setSelected(lead);
          setHistory(h);
        }
      } else {
        const data = await api<{ items: Lead[] }>("/me/leads", { token });
        if (run === generation.current) setItems(data.items);
      }
    } catch (e) {
      if (run === generation.current) setError((e as Error).message);
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }, [session, inquiryId]);
  const cancelLoad = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      cancelLoad();
    };
  }, [load, cancelLoad]);
  async function update(stage: string) {
    if (!session || !selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/me/leads/${selected.id}`, {
        token: session.access_token,
        method: "PATCH",
        body: { stage, revision: selected.revision },
      });
      setSelected(
        await api<Lead>(`/me/leads/${selected.id}`, {
          token: session.access_token,
        }),
      );
      setMessage("Estado actualizado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveNote() {
    if (!session || !selected || !note.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/me/leads/${selected.id}/notes`, {
        token: session.access_token,
        method: "POST",
        body: { message: note },
      });
      setNote("");
      setHistory(
        await api<History>(`/me/leads/${selected.id}/history`, {
          token: session.access_token,
        }),
      );
      setMessage("Nota guardada.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardSafeView style={s.page}>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={s.back}
        >
          <Text style={s.backText}>‹</Text>
        </Pressable>
        <Text style={s.heading}>Interesados</Text>
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.caption}>
          Tus consultas y las que una empresa te haya asignado.
        </Text>
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        {!!error && session && (
          <Pressable
            style={s.outline}
            accessibilityRole="button"
            onPress={() => void load()}
          >
            <Text style={s.text}>Volver a cargar</Text>
          </Pressable>
        )}
        {!!message && (
          <Text accessibilityLiveRegion="polite" style={s.success}>
            {message}
          </Text>
        )}
        {!session ? (
          <>
            <Text style={s.text}>Inicia sesión para ver esta consulta.</Text>
            <Pressable style={s.primary} onPress={() => router.push("/cuenta")}>
              <Text style={s.primaryText}>Iniciar sesión</Text>
            </Pressable>
          </>
        ) : loading ? (
          <ActivityIndicator color={brandColors.secondary} />
        ) : selected ? (
          <View style={s.card}>
            <Text style={s.caption}>{selected.company_name}</Text>
            <Text style={s.title}>{selected.title}</Text>
            <Text style={s.name}>{selected.name}</Text>
            <Text selectable style={s.text}>
              {selected.email}
            </Text>
            {!!selected.phone && (
              <Text selectable style={s.text}>
                {selected.phone}
              </Text>
            )}
            <Text style={s.text}>{selected.message}</Text>
            <Text style={s.caption}>
              Responsable: {selected.assignee_name || "Anunciante"}
            </Text>
            <Text style={s.label}>Estado · {stages[selected.stage]}</Text>
            <View style={s.chips}>
              {Object.entries(stages).map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: selected.stage === key,
                    disabled: busy,
                  }}
                  disabled={busy || selected.stage === key}
                  onPress={() => void update(key)}
                  style={[s.chip, selected.stage === key && s.chipSelected]}
                >
                  <Text style={selected.stage === key ? s.primaryText : s.text}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.caption}>
              «Visita agendada» es seguimiento comercial. Confirma la cita desde
              la Agenda.
            </Text>
            <Text style={s.label}>Nota interna</Text>
            <TextInput
              multiline
              maxLength={5000}
              value={note}
              onChangeText={setNote}
              editable={!busy}
              style={s.input}
              placeholder="Próximo paso o resultado de la conversación"
              placeholderTextColor="#49658b"
            />
            <Pressable
              disabled={busy || !note.trim()}
              accessibilityRole="button"
              accessibilityLabel="Guardar nota"
              style={[s.primary, (busy || !note.trim()) && s.disabled]}
              onPress={() => void saveNote()}
            >
              <Text style={s.primaryText}>
                {busy ? "Guardando…" : "Guardar nota"}
              </Text>
            </Pressable>
            <Text style={s.caption}>
              Las notas son internas; no se envían al interesado.
            </Text>
            {history?.notes.map((n) => (
              <View key={n.id} style={s.note}>
                <Text style={s.name}>{n.author_name || "Integrante"}</Text>
                <Text style={s.text}>{n.message}</Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            {items.map((i) => (
              <Pressable
                accessibilityRole="button"
                style={s.card}
                key={i.id}
                onPress={() =>
                  router.push({
                    pathname: "/interesados",
                    params: { inquiryId: i.id },
                  })
                }
              >
                <Text style={s.caption}>
                  {i.company_name} · {stages[i.stage]}
                </Text>
                <Text style={s.title}>{i.title}</Text>
                <Text style={s.name}>{i.name}</Text>
                <Text style={s.text}>
                  {i.assignee_name || "Atención directa"}
                </Text>
              </Pressable>
            ))}
            {!items.length && !error && (
              <Text style={s.text}>Todavía no hay interesados asignados.</Text>
            )}
          </>
        )}
        {session && !loading && (
          <Pressable
            style={s.outline}
            accessibilityRole="button"
            onPress={() => {
              if (inquiryId) router.replace("/interesados");
              else void load();
            }}
          >
            <Text style={s.text}>
              {inquiryId ? "Ver mis interesados" : "Actualizar"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardSafeView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f7ff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: "#fff",
  },
  heading: { fontSize: 23, fontWeight: "700", color: "#071c55" },
  back: { padding: 8 },
  backText: { fontSize: 32, color: "#31517a" },
  content: { padding: 18, gap: 14, paddingBottom: 36 },
  caption: { fontSize: 13, lineHeight: 20, color: "#49658b" },
  text: { fontSize: 15, lineHeight: 22, color: "#071c55" },
  title: { fontSize: 21, fontWeight: "700", color: "#071c55" },
  name: { fontSize: 16, fontWeight: "600", color: "#071c55" },
  card: {
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#d3e0f2",
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  label: { fontSize: 16, fontWeight: "700", marginTop: 10, color: "#31517a" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { padding: 10, borderRadius: 12, backgroundColor: "#edf4ff" },
  chipSelected: { backgroundColor: brandColors.secondary },
  primary: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: brandColors.secondary,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  outline: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bdcee1",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#bdcee1",
    borderRadius: 12,
    minHeight: 96,
    padding: 12,
    color: "#071c55",
    backgroundColor: "#fff",
    fontSize: 16,
    textAlignVertical: "top",
  },
  disabled: { opacity: 0.5 },
  error: {
    color: "#a32235",
    padding: 12,
    backgroundColor: "#fff0f2",
    borderRadius: 10,
  },
  success: {
    color: "#216641",
    padding: 12,
    backgroundColor: "#e3f4ea",
    borderRadius: 10,
  },
  note: {
    borderTopWidth: 1,
    borderTopColor: "#d3e0f2",
    paddingTop: 12,
    gap: 6,
  },
});
