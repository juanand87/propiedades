import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { randomUUID } from "expo-crypto";
import { useRouter } from "expo-router";
import { api, Session } from "./api";
import { KeyboardSafeView } from "./KeyboardSafeView";

type Visit = {
  id: string;
  property_id: string;
  property_title: string;
  buyer_id: string;
  buyer_name: string;
  seller_name: string;
  state: string;
  version: number;
  starts_at: string;
  note: string;
  conversation_id: string;
  property_available: boolean;
  allowed_actions: string[];
  events?: {
    id: string;
    state: string;
    actor_name: string;
    starts_at: string;
    note: string;
  }[];
};
const labels: Record<string, string> = {
  requested: "Por confirmar",
  proposed: "Nuevo horario propuesto",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  rejected: "Rechazada",
  completed: "Realizada",
  accept: "Confirmar horario",
  propose: "Proponer otro horario",
  cancel: "Cancelar visita",
  reject: "Rechazar",
  complete: "Marcar como realizada",
};
const zone = "America/Santiago";
function parts(date: Date) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const g = (key: string) => p.find((v) => v.type === key)?.value;
  return {
    date: `${g("year")}-${g("month")}-${g("day")}`,
    time: `${g("hour")}:${g("minute")}`,
  };
}
function when(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  });
}
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
      <Text style={[s.buttonText, secondary && { color: "#0958bb" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function VisitsScreen({
  session,
  visitId,
  propertyId,
  conversationId,
}: {
  session: Session | null;
  visitId?: string;
  propertyId?: string;
  conversationId?: string;
}) {
  const router = useRouter();
  const token = session?.access_token;
  const [data, setData] = useState<{ items: Visit[]; has_more: boolean }>({
    items: [],
    has_more: false,
  });
  const [detail, setDetail] = useState<Visit | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [page, setPage] = useState(1);
  const [proposing, setProposing] = useState(false),
    [consent, setConsent] = useState(false),
    [note, setNote] = useState("");
  const [slot, setSlot] = useState(() => new Date(Date.now() + 86400000)),
    [picker, setPicker] = useState<"date" | "time" | null>(null);
  const request = useRef<{ payload: string; id: string } | null>(null),
    live = useRef(true),
    mutation = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      try {
        if (visitId) {
          const result = await api<Visit>(`/me/visits/${visitId}`, {
            token,
            signal,
          });
          if (!signal?.aborted && live.current) setDetail(result);
        } else if (!propertyId) {
          const result = await api<{ items: Visit[]; has_more: boolean }>(
            `/me/visits?page=${page}${conversationId ? `&conversation_id=${conversationId}` : ""}`,
            { token, signal },
          );
          if (!signal?.aborted && live.current) setData(result);
        }
        if (!signal?.aborted && live.current) setError("");
      } catch (e) {
        if (!signal?.aborted && live.current)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la agenda.",
          );
      }
    },
    [token, visitId, propertyId, conversationId, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    const start = setTimeout(() => {
      setLoading(true);
      void load(controller.signal).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 0);
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && !mutation.current)
        void load(controller.signal);
    }, 15000);
    return () => {
      clearTimeout(start);
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);
  async function save(action?: string) {
    if (!token || mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      const time = parts(slot);
      let result: Visit;
      if (!detail) {
        const body = { property_id: propertyId, ...time, note, consent };
        const payload = JSON.stringify(body);
        if (request.current?.payload !== payload)
          request.current = { payload, id: randomUUID() };
        result = await api<Visit>("/me/visits", {
          method: "POST",
          token,
          body: { ...body, request_id: request.current.id },
        });
      } else
        result = await api<Visit>(`/me/visits/${detail.id}`, {
          method: "PATCH",
          token,
          body: {
            action,
            version: detail.version,
            ...(action === "propose" ? time : {}),
            note,
          },
        });
      if (live.current) {
        setProposing(false);
        setNote("");
        router.replace({
          pathname: "/visitas",
          params: { visitId: result.id },
        });
        setDetail(result);
      }
    } catch (e) {
      if (live.current) {
        if (detail) await load();
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    } finally {
      mutation.current = false;
      if (live.current) setBusy(false);
    }
  }
  function action(value: string) {
    if (value === "propose") {
      setSlot(new Date(detail!.starts_at));
      setProposing(true);
      return;
    }
    Alert.alert(
      labels[value],
      "Se avisará a la otra persona y el cambio quedará en el historial.",
      [
        { text: "Volver", style: "cancel" },
        { text: labels[value], onPress: () => void save(value) },
      ],
    );
  }
  const form = (!!propertyId && !visitId) || proposing;
  return (
    <KeyboardSafeView style={s.root}>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/mensajes")
          }
        >
          <Text style={s.back}>‹</Text>
        </Pressable>
        <Text style={s.title}>Mis visitas</Text>
        <Pressable accessibilityRole="button" onPress={() => void load()}>
          <Text style={s.link}>Actualizar</Text>
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        contentContainerStyle={s.content}
      >
        {!session ? (
          <>
            <Text style={s.text}>
              Inicia sesión para agendar y consultar tus visitas.
            </Text>
            <Button
              label="Iniciar sesión"
              onPress={() => router.push("/cuenta")}
            />
          </>
        ) : (
          <>
            <Text style={s.muted}>
              Horarios de Chile · Santiago. Cada visita dura 30 minutos.
            </Text>
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            {loading && <ActivityIndicator color="#0866f5" />}
            {detail && (
              <View style={s.card}>
                <Text style={s.title}>{detail.property_title}</Text>
                <Text style={s.status}>{labels[detail.state]}</Text>
                <Text style={s.text}>{when(detail.starts_at)}</Text>
                <Text style={s.muted}>
                  {detail.buyer_id === session.user.id
                    ? `Vendedor: ${detail.seller_name}`
                    : `Visitante: ${detail.buyer_name}`}
                </Text>
                {!!detail.note && <Text style={s.text}>{detail.note}</Text>}
                {!detail.property_available && (
                  <Text style={s.error}>
                    La propiedad ya no está disponible. Puedes cancelar la
                    visita.
                  </Text>
                )}
                {!proposing &&
                  detail.allowed_actions.map((a) => (
                    <Button
                      key={a}
                      label={labels[a]}
                      disabled={busy}
                      secondary={a !== "accept"}
                      onPress={() => action(a)}
                    />
                  ))}
                <Button
                  label="Abrir conversación"
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/mensajes",
                      params: { conversationId: detail.conversation_id },
                    })
                  }
                />
                <Button
                  label="Ver propiedad"
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/property/[propertyId]",
                      params: {
                        propertyId: detail.property_id,
                        from: "catalog",
                      },
                    })
                  }
                />
              </View>
            )}
            {form && (
              <View style={s.card}>
                <Text style={s.title}>
                  {proposing ? "Proponer otro horario" : "Agendar visita"}
                </Text>
                <Text style={s.muted}>
                  El horario queda pendiente hasta que la otra persona lo
                  confirme.
                </Text>
                <Button
                  secondary
                  label={`Fecha: ${parts(slot).date}`}
                  onPress={() => setPicker("date")}
                />
                <Button
                  secondary
                  label={`Hora: ${parts(slot).time}`}
                  onPress={() => setPicker("time")}
                />
                {picker && (
                  <DateTimePicker
                    value={slot}
                    mode={picker}
                    timeZoneName={zone}
                    is24Hour
                    onChange={(event, date) => {
                      setPicker(null);
                      if (event.type === "set" && date) setSlot(date);
                    }}
                  />
                )}
                <TextInput
                  accessibilityLabel="Nota para la visita"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Nota para coordinar la visita (opcional)"
                  placeholderTextColor="#60758a"
                  multiline
                  maxLength={1000}
                  style={s.input}
                />
                {!proposing && (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: consent }}
                    onPress={() => setConsent(!consent)}
                  >
                    <Text style={s.text}>
                      {consent ? "☑" : "☐"} Autorizo compartir mis datos de
                      contacto con el vendedor para coordinar esta visita.
                    </Text>
                  </Pressable>
                )}
                <Button
                  label={
                    busy
                      ? "Enviando…"
                      : proposing
                        ? "Enviar propuesta"
                        : "Solicitar visita"
                  }
                  disabled={busy || (!proposing && !consent)}
                  onPress={() => void save(proposing ? "propose" : undefined)}
                />
                {proposing && (
                  <Button
                    secondary
                    label="Volver"
                    disabled={busy}
                    onPress={() => setProposing(false)}
                  />
                )}
              </View>
            )}
            {!detail && !form && !loading && (
              <>
                {data.items.map((v) => (
                  <Pressable
                    accessibilityRole="button"
                    key={v.id}
                    style={s.card}
                    onPress={() =>
                      router.push({
                        pathname: "/visitas",
                        params: { visitId: v.id },
                      })
                    }
                  >
                    <Text style={s.title}>{v.property_title}</Text>
                    <Text style={s.status}>{labels[v.state]}</Text>
                    <Text style={s.text}>{when(v.starts_at)}</Text>
                    <Text style={s.muted}>
                      {v.buyer_id === session.user.id
                        ? v.seller_name
                        : v.buyer_name}
                    </Text>
                  </Pressable>
                ))}
                {!data.items.length && (
                  <Text style={s.text}>
                    Aún no hay visitas. Puedes solicitar una desde la ficha de
                    una propiedad.
                  </Text>
                )}
                <View style={s.row}>
                  {page > 1 && (
                    <Button
                      secondary
                      label="Anterior"
                      onPress={() => setPage((p) => p - 1)}
                    />
                  )}{" "}
                  {data.has_more && (
                    <Button
                      secondary
                      label="Siguiente"
                      onPress={() => setPage((p) => p + 1)}
                    />
                  )}
                </View>
              </>
            )}
            {!!detail?.events?.length && (
              <View style={s.card}>
                <Text style={s.title}>Historial</Text>
                {[...detail.events].reverse().map((e) => (
                  <View key={e.id} style={s.event}>
                    <Text style={s.status}>
                      {labels[e.state]} · {e.actor_name}
                    </Text>
                    <Text style={s.muted}>{when(e.starts_at)}</Text>
                    {!!e.note && <Text style={s.text}>{e.note}</Text>}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardSafeView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderBottomWidth: 1,
    borderColor: "#dceafb",
  },
  back: { fontSize: 36, color: "#0755b5" },
  title: { fontSize: 20, fontWeight: "700", color: "#123d70", flexShrink: 1 },
  link: { color: "#0866f5", fontWeight: "700" },
  content: { padding: 18, gap: 16, paddingBottom: 40 },
  text: { color: "#183c67", fontSize: 16, lineHeight: 23 },
  muted: { color: "#526b85", lineHeight: 21 },
  status: { color: "#0866f5", fontWeight: "700" },
  error: { color: "#b02b3b" },
  card: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#dceafb",
    gap: 13,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0866f5",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  secondary: { backgroundColor: "#edf6ff" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#bad5ef",
    borderRadius: 12,
    padding: 14,
    minHeight: 80,
    color: "#123d70",
  },
  event: {
    gap: 5,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: "#e1edfa",
  },
  row: { flexDirection: "row", gap: 12 },
});
