import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { randomUUID } from "expo-crypto";
import { api, Session } from "./api";
import { useNightStyles } from "./appearance";
import { brandColors } from "./brand-colors";
const kinds: Record<string, string> = {
  call: "Llamar",
  send_info: "Enviar información",
  coordinate_visit: "Coordinar visita",
  other: "Otra acción",
};
const actions: Record<string, string> = {
  created: "Programada",
  rescheduled: "Reprogramada",
  completed: "Realizada",
  cancelled: "Cancelada",
};
type Task = {
  id: string;
  inquiry_id: string;
  kind: string;
  note: string;
  due_at: string;
  status: string;
  revision: number;
  overdue: boolean;
  name: string;
  title: string;
  responsible_name: string;
};
type Data = {
  items: Task[];
  summary: { pending: number; overdue: number; completed: number };
  truncated: boolean;
};
type Draft = {
  id: string;
  kind: string;
  note: string;
  at: Date;
  revision?: number;
};
const when = (value: string) =>
  new Date(value).toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "medium",
    timeStyle: "short",
  });
function parts(value: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .map((i) => [i.type, i.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export function LeadTasks({
  session,
  inquiryId,
  revision = 0,
  onOpen,
}: {
  session: Session;
  inquiryId?: string;
  revision?: number;
  onOpen?: (id: string) => void;
}) {
  const s = useNightStyles(styles),
    [data, setData] = useState<Data | null>(null),
    [status, setStatus] = useState("pending"),
    [due, setDue] = useState("all"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<Draft | null>(null),
    [picker, setPicker] = useState<"date" | "time" | null>(null),
    [events, setEvents] = useState<
      | {
          id: string;
          actor_name: string;
          action: string;
          snapshot_json: string | { kind: string; due_at: string };
          created_at: string;
        }[]
      | null
    >(null),
    [eventTask, setEventTask] = useState("");
  const generation = useRef(0),
    path = `/me/lead-tasks?${new URLSearchParams({ status, due, ...(inquiryId ? { inquiryId } : {}) })}`;
  const load = useCallback(async () => {
    const run = ++generation.current;
    try {
      const result = await api<Data>(path, { token: session.access_token });
      if (run === generation.current) setData(result);
    } catch (e) {
      if (run === generation.current) setError((e as Error).message);
    }
  }, [path, session.access_token]);
  const cancelLoad = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      cancelLoad();
    };
  }, [load, revision, cancelLoad]);
  async function act(action: () => Promise<unknown>, text: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await load();
      setMessage(text);
    } catch (e) {
      setError((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }
  function edit(t?: Task) {
    setDraft({
      id: t?.id || randomUUID(),
      kind: t?.kind || "call",
      note: t?.note || "",
      at: t ? new Date(t.due_at) : new Date(Date.now() + 3600000),
      revision: t?.revision,
    });
    setError("");
  }
  function save() {
    if (!draft) return;
    const value = draft;
    void act(async () => {
      const body = { ...value, ...parts(value.at) };
      if (value.revision)
        await api(`/me/lead-tasks/${value.id}`, {
          token: session.access_token,
          method: "PATCH",
          body: { ...body, action: "reschedule" },
        });
      else
        await api(`/me/leads/${inquiryId}/tasks`, {
          token: session.access_token,
          method: "POST",
          body,
        });
      setDraft(null);
    }, "Acción guardada.");
  }
  function change(t: Task, action: string) {
    void act(
      () =>
        api(`/me/lead-tasks/${t.id}`, {
          token: session.access_token,
          method: "PATCH",
          body: { action, revision: t.revision },
        }),
      action === "complete" ? "Acción realizada." : "Acción cancelada.",
    );
  }
  return (
    <View style={s.panel}>
      <Text style={s.title}>
        {inquiryId ? "Próximas acciones" : "Pendientes de seguimiento"}
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {message}
        </Text>
      )}
      {inquiryId && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={s.primary}
          onPress={() => edit()}
        >
          <Text style={s.white}>Programar acción</Text>
        </Pressable>
      )}
      {draft && (
        <View style={s.form}>
          <Text style={s.label}>
            {draft.revision ? "Reprogramar" : "Nueva próxima acción"}
          </Text>
          <View style={s.row}>
            {Object.entries(kinds).map(([key, label]) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: draft.kind === key }}
                key={key}
                style={draft.kind === key ? s.primary : s.outline}
                onPress={() => setDraft({ ...draft, kind: key })}
              >
                <Text style={draft.kind === key ? s.white : s.text}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.caption}>Fecha y hora de Santiago</Text>
          <View style={s.row}>
            <Pressable style={s.outline} onPress={() => setPicker("date")}>
              <Text style={s.text}>{parts(draft.at).date}</Text>
            </Pressable>
            <Pressable style={s.outline} onPress={() => setPicker("time")}>
              <Text style={s.text}>{parts(draft.at).time}</Text>
            </Pressable>
          </View>
          {picker && (
            <DateTimePicker
              value={draft.at}
              mode={picker}
              timeZoneName="America/Santiago"
              is24Hour
              onChange={(_e, value) => {
                setPicker(null);
                if (value) setDraft({ ...draft, at: value });
              }}
            />
          )}
          <Text style={s.label}>Detalle interno · opcional</Text>
          <TextInput
            style={s.input}
            multiline
            maxLength={1000}
            value={draft.note}
            onChangeText={(note) => setDraft({ ...draft, note })}
            editable={!busy}
          />
          <Text style={s.caption}>
            Se avisará al responsable cuando llegue la hora.
          </Text>
          <View style={s.row}>
            <Pressable disabled={busy} style={s.primary} onPress={save}>
              <Text style={s.white}>Guardar acción</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              style={s.outline}
              onPress={() => {
                setDraft(null);
                setPicker(null);
              }}
            >
              <Text style={s.text}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      )}
      {data ? (
        <>
          <View style={s.row}>
            <Pressable
              style={
                status === "pending" && due === "all" ? s.primary : s.outline
              }
              onPress={() => {
                setStatus("pending");
                setDue("all");
              }}
            >
              <Text
                style={status === "pending" && due === "all" ? s.white : s.text}
              >
                Pendientes {data.summary.pending}
              </Text>
            </Pressable>
            <Pressable
              style={due === "overdue" ? s.primary : s.outline}
              onPress={() => {
                setStatus("pending");
                setDue("overdue");
              }}
            >
              <Text style={due === "overdue" ? s.white : s.text}>
                Vencidos {data.summary.overdue}
              </Text>
            </Pressable>
            <Pressable
              style={status === "completed" ? s.primary : s.outline}
              onPress={() => {
                setStatus("completed");
                setDue("all");
              }}
            >
              <Text style={status === "completed" ? s.white : s.text}>
                Realizadas
              </Text>
            </Pressable>
            <Pressable
              style={status === "cancelled" ? s.primary : s.outline}
              onPress={() => {
                setStatus("cancelled");
                setDue("all");
              }}
            >
              <Text style={status === "cancelled" ? s.white : s.text}>
                Canceladas
              </Text>
            </Pressable>
          </View>
          {data.truncated && (
            <Text style={s.caption}>
              Se muestran las primeras 200 tareas del filtro.
            </Text>
          )}
          {!data.items.length && (
            <Text style={s.caption}>
              No hay acciones en este filtro.
              {!inquiryId ? " Abre una consulta para programarlas." : ""}
            </Text>
          )}
          {data.items.map((t) => (
            <View style={s.card} key={t.id}>
              <Text style={s.label}>
                {kinds[t.kind]}
                {t.overdue ? " · Vencida" : ""}
              </Text>
              <Text style={s.text}>{when(t.due_at)} · Santiago</Text>
              <Text style={s.text}>
                {t.name} · {t.title}
              </Text>
              <Text style={s.caption}>Responsable: {t.responsible_name}</Text>
              {!!t.note && <Text style={s.text}>{t.note}</Text>}
              {t.status !== "pending" && (
                <Text style={s.caption}>
                  {t.status === "completed" ? "Realizada" : "Cancelada"}
                </Text>
              )}
              <View style={s.row}>
                {t.status === "pending" && (
                  <>
                    <Pressable
                      style={s.primary}
                      disabled={busy}
                      onPress={() => change(t, "complete")}
                    >
                      <Text style={s.white}>Realizada</Text>
                    </Pressable>
                    <Pressable
                      style={s.outline}
                      disabled={busy}
                      onPress={() => edit(t)}
                    >
                      <Text style={s.text}>Reprogramar</Text>
                    </Pressable>
                    <Pressable
                      style={s.outline}
                      disabled={busy}
                      onPress={() =>
                        Alert.alert(
                          "Cancelar acción",
                          "Se conservará en el historial.",
                          [
                            { text: "Volver", style: "cancel" },
                            {
                              text: "Cancelar acción",
                              onPress: () => change(t, "cancel"),
                            },
                          ],
                        )
                      }
                    >
                      <Text style={s.text}>Cancelar</Text>
                    </Pressable>
                  </>
                )}
                {!inquiryId && onOpen && (
                  <Pressable
                    style={s.outline}
                    onPress={() => onOpen(t.inquiry_id)}
                  >
                    <Text style={s.text}>Ver interesado</Text>
                  </Pressable>
                )}
                <Pressable
                  style={s.outline}
                  disabled={busy}
                  onPress={() =>
                    void act(async () => {
                      setEvents(
                        await api(`/me/lead-tasks/${t.id}/history`, {
                          token: session.access_token,
                        }),
                      );
                      setEventTask(t.id);
                    }, "")
                  }
                >
                  <Text style={s.text}>Historial</Text>
                </Pressable>
              </View>
              {eventTask === t.id && events && (
                <View style={s.form}>
                  <Pressable
                    onPress={() => {
                      setEvents(null);
                      setEventTask("");
                    }}
                  >
                    <Text style={s.text}>Cerrar historial ×</Text>
                  </Pressable>
                  {events.map((e) => {
                    const snap =
                      typeof e.snapshot_json === "string"
                        ? JSON.parse(e.snapshot_json)
                        : e.snapshot_json;
                    return (
                      <Text style={s.caption} key={e.id}>
                        {actions[e.action]} · {e.actor_name} ·{" "}
                        {when(e.created_at)}
                        {"\n"}
                        {kinds[snap.kind]} · {when(snap.due_at)}
                      </Text>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </>
      ) : (
        !error && <ActivityIndicator color={brandColors.secondary} />
      )}
      <Text style={s.caption}>
        Las tareas siguen al responsable. Al cerrar la consulta se cancelan los
        pendientes. Coordinar visita no crea una reserva.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    padding: 16,
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d3e0f2",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#071c55" },
  label: { fontSize: 15, fontWeight: "700", color: "#071c55" },
  text: { fontSize: 14, lineHeight: 21, color: "#071c55" },
  caption: { fontSize: 12, lineHeight: 19, color: "#49658b" },
  white: { fontSize: 14, fontWeight: "600", color: "#fff" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primary: {
    backgroundColor: brandColors.secondary,
    padding: 11,
    borderRadius: 10,
    alignItems: "center",
  },
  outline: {
    borderWidth: 1,
    borderColor: "#bdcee1",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  card: {
    borderWidth: 1,
    borderColor: "#d3e0f2",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  form: { backgroundColor: "#edf4ff", borderRadius: 12, padding: 12, gap: 12 },
  input: {
    padding: 12,
    minHeight: 78,
    textAlignVertical: "top",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#bdcee1",
    borderRadius: 10,
    backgroundColor: "#fff",
    color: "#071c55",
  },
  error: { color: "#a12b36", fontSize: 14 },
});
