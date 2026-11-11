import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import { api, ApiError, mediaUrl, Session } from "./api";
import { ProppixIcon } from "./ProppixIcon";
import { videoColors } from "./video-colors";

type Person = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  available: boolean;
};
type Message = {
  id: string;
  sender_id: string;
  client_id: string;
  body: string;
  created_at: string;
};
type Thread = {
  id: string;
  participant: Person;
  last_message: string;
  updated_at: string;
  unread: number;
  from_me: boolean;
};
type History = {
  id: string;
  participant: Person;
  items: Message[];
  has_more: boolean;
  last_message_id: string;
};
function combine(previous: Message[], incoming: Message[]) {
  const messages = new Map(previous.map((item) => [item.id, item]));
  incoming.forEach((item) => messages.set(item.id, item));
  return [...messages.values()].sort((a, b) =>
    BigInt(a.id) > BigInt(b.id) ? -1 : BigInt(a.id) < BigInt(b.id) ? 1 : 0,
  );
}
function messageError(error: unknown) {
  if (
    error instanceof ApiError &&
    (error.status === 404 || error.status === 503)
  )
    return "Los mensajes están temporalmente fuera de servicio. Intenta más tarde.";
  return error instanceof Error
    ? error.message
    : "No se pudieron cargar los mensajes.";
}
function Avatar({ person }: { person: Person }) {
  return person.avatar_url ? (
    <Image source={{ uri: mediaUrl(person.avatar_url) }} style={s.avatar} />
  ) : (
    <View style={s.avatar}>
      <Text style={s.initial}>
        {person.display_name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

export function MessagesScreen({
  session,
  conversationId,
  recipientId,
  propertyId,
}: {
  session: Session | null;
  conversationId?: string;
  recipientId?: string;
  propertyId?: string;
}) {
  const router = useRouter();
  const token = session?.access_token;
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [threads, setThreads] = useState<Thread[]>([]),
    [inboxPage, setInboxPage] = useState(0),
    [inboxMore, setInboxMore] = useState(false);
  const [selected, setSelected] = useState<string | null>(
      conversationId || null,
    ),
    [person, setPerson] = useState<Person | null>(null),
    [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sending, setSending] = useState(false),
    [older, setOlder] = useState(false);
  const [retry, setRetry] = useState(0);
  const cursor = useRef("0"),
    markedRead = useRef("0"),
    earliest = useRef("0"),
    loadingInbox = useRef(false),
    loadingHistory = useRef<string | null>(null),
    sendBusy = useRef(false);
  const selectedRef = useRef<string | null>(conversationId || null);
  const pending = useRef<{
    conversation: string;
    body: string;
    client_id: string;
  } | null>(null);
  const sendController = useRef<AbortController | null>(null);
  const selectConversation = useCallback((id: string | null) => {
    sendController.current?.abort();
    selectedRef.current = id;
    cursor.current = "0";
    earliest.current = "0";
    sendBusy.current = false;
    setSending(false);
    setText("");
    setMessages([]);
    setSelected(id);
    setOlder(false);
    setError("");
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (value) =>
      setForeground(value === "active"),
    );
    return () => {
      sub.remove();
      sendController.current?.abort();
    };
  }, []);
  const backToInbox = useCallback(() => {
    selectConversation(null);
    if (conversationId || recipientId || propertyId)
      router.replace("/mensajes");
    else {
      setPerson(null);
    }
  }, [conversationId, recipientId, propertyId, router, selectConversation]);
  useEffect(() => {
    if (!selected) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      backToInbox();
      return true;
    });
    return () => sub.remove();
  }, [selected, backToInbox]);
  useEffect(() => {
    if (!token || (!recipientId && !propertyId) || selectedRef.current) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      void api<{ id: string; participant: Person }>("/messages/conversations", {
        method: "POST",
        token,
        body: propertyId
          ? { property_id: propertyId }
          : { recipient_id: recipientId },
        signal: controller.signal,
      })
        .then((data) => {
          if (!controller.signal.aborted) {
            selectConversation(data.id);
            setPerson(data.participant);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(messageError(e));
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [token, recipientId, propertyId, selectConversation, retry]);
  const loadInbox = useCallback(
    async (page = 1, signal?: AbortSignal) => {
      if (!token || loadingInbox.current) return;
      loadingInbox.current = true;
      setBusy(true);
      try {
        const data = await api<{ items: Thread[]; has_more: boolean }>(
          `/messages/conversations?page=${page}`,
          { token, signal },
        );
        if (signal?.aborted) return;
        setThreads((previous) =>
          page === 1
            ? data.items
            : [
                ...previous,
                ...data.items.filter(
                  (item) => !previous.some((thread) => thread.id === item.id),
                ),
              ],
        );
        setInboxPage(page);
        setInboxMore(data.has_more);
        setError("");
      } catch (e) {
        if (!signal?.aborted) setError(messageError(e));
      } finally {
        loadingInbox.current = false;
        if (!signal?.aborted) setBusy(false);
      }
    },
    [token],
  );
  useEffect(() => {
    if (!token || selected || recipientId || propertyId || !foreground) return;
    const controller = new AbortController();
    const timer = setTimeout(() => void loadInbox(1, controller.signal), 0);
    const interval = setInterval(
      () => void loadInbox(1, controller.signal),
      10000,
    );
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      controller.abort();
    };
  }, [token, selected, recipientId, propertyId, foreground, loadInbox, retry]);
  useEffect(() => {
    if (!selected || !token || !foreground) return;
    const controller = new AbortController();
    let initial = true;
    cursor.current = "0";
    markedRead.current = "0";
    async function refresh() {
      if (loadingHistory.current === selected) return;
      loadingHistory.current = selected;
      if (initial) setBusy(true);
      try {
        let more: boolean;
        do {
          const query = initial ? "" : `?after=${cursor.current}`;
          const data = await api<History>(
            `/messages/conversations/${selected}${query}`,
            { token, signal: controller.signal },
          );
          if (controller.signal.aborted || selectedRef.current !== selected)
            return;
          setPerson(data.participant);
          if (initial) {
            setOlder(data.has_more);
            const firstId = data.items[0]?.id;
            if (
              firstId &&
              (earliest.current === "0" ||
                BigInt(firstId) < BigInt(earliest.current))
            )
              earliest.current = firstId;
            setMessages((previous) => combine(previous, data.items));
          } else setMessages((previous) => combine(previous, data.items));
          const newest = data.items.at(-1)?.id;
          if (newest) cursor.current = newest;
          more = !initial && data.has_more;
          initial = false;
          if (newest && BigInt(newest) > BigInt(markedRead.current)) {
            await api(`/messages/conversations/${selected}/read`, {
              method: "POST",
              token,
              body: { last_message_id: newest },
              signal: controller.signal,
            });
            markedRead.current = newest;
          }
        } while (more && !controller.signal.aborted);
        setError("");
      } catch (e) {
        if (!controller.signal.aborted) setError(messageError(e));
      } finally {
        if (loadingHistory.current === selected) loadingHistory.current = null;
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    const timer = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 4000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      controller.abort();
    };
  }, [selected, token, foreground, retry]);
  async function loadOlder() {
    if (!selected || !token || busy || loadingHistory.current === selected)
      return;
    loadingHistory.current = selected;
    setBusy(true);
    try {
      const data = await api<History>(
        `/messages/conversations/${selected}?before=${earliest.current}`,
        { token },
      );
      if (selectedRef.current !== selected) return;
      setMessages((previous) => combine(previous, data.items));
      earliest.current = data.items[0]?.id || earliest.current;
      setOlder(data.has_more);
    } catch (e) {
      if (selectedRef.current === selected) setError(messageError(e));
    } finally {
      if (loadingHistory.current === selected) loadingHistory.current = null;
      if (selectedRef.current === selected) setBusy(false);
    }
  }
  async function send() {
    const body = text.trim();
    if (!selected || !token || !body || sendBusy.current) return;
    sendBusy.current = true;
    setSending(true);
    setError("");
    if (
      pending.current?.body !== body ||
      pending.current.conversation !== selected
    )
      pending.current = {
        conversation: selected,
        body,
        client_id: randomUUID(),
      };
    const controller = new AbortController();
    sendController.current = controller;
    try {
      const data = await api<Message>(`/messages/conversations/${selected}`, {
        method: "POST",
        token,
        body: { body, client_id: pending.current.client_id },
        signal: controller.signal,
      });
      if (controller.signal.aborted || selectedRef.current !== selected) return;
      setMessages((previous) => combine(previous, [data]));
      setText((value) => (value.trim() === body ? "" : value));
      pending.current = null;
    } catch (e) {
      if (!controller.signal.aborted) setError(messageError(e));
    } finally {
      if (sendController.current === controller) {
        sendBusy.current = false;
        if (!controller.signal.aborted) setSending(false);
      }
    }
  }
  if (!session)
    return (
      <View style={s.empty}>
        <ProppixIcon name="messages" size={50} color={videoColors.cyan} />
        <Text style={s.title}>Tus conversaciones</Text>
        <Text style={s.muted}>
          Inicia sesión para escribir a otros usuarios de Proppix.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/cuenta")}
          style={s.primary}
        >
          <Text style={s.white}>Iniciar sesión</Text>
        </Pressable>
      </View>
    );
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.heading}>
        {selected && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a las conversaciones"
            onPress={backToInbox}
            style={s.iconButton}
          >
            <Text style={s.back}>‹</Text>
          </Pressable>
        )}
        {selected && person && <Avatar person={person} />}
        <Text style={[s.title, { flex: 1 }]} numberOfLines={1}>
          {selected ? person?.display_name || "Conversación" : "Mensajes"}
        </Text>
        {!selected && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Actualizar conversaciones"
            style={s.iconButton}
            onPress={() => void loadInbox()}
          >
            <ProppixIcon name="refresh" color={videoColors.cyan} />
          </Pressable>
        )}
      </View>
      {!!error && (
        <View style={s.errorBox}>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetry((value) => value + 1)}
            style={{ paddingTop: 10 }}
          >
            <Text style={s.white}>Reintentar conexión</Text>
          </Pressable>
        </View>
      )}
      {busy && (
        <ActivityIndicator style={{ padding: 8 }} color={videoColors.cyan} />
      )}
      {selected ? (
        <>
          <FlatList
            data={messages}
            inverted
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 15, gap: 9 }}
            renderItem={({ item }) => {
              const mine = item.sender_id === session.user.id;
              return (
                <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                  <Text style={s.body}>{item.body}</Text>
                  <Text style={s.time}>
                    {new Date(item.created_at).toLocaleTimeString("es-CL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              );
            }}
            ListFooterComponent={
              older ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  style={s.loadMore}
                  onPress={() => void loadOlder()}
                >
                  <Text style={s.muted}>Cargar mensajes anteriores</Text>
                </Pressable>
              ) : undefined
            }
            ListEmptyComponent={
              !busy && !error ? (
                <View style={{ padding: 30, transform: [{ scaleY: -1 }] }}>
                  <Text style={s.muted}>
                    Escribe el primer mensaje para comenzar.
                  </Text>
                </View>
              ) : undefined
            }
          />
          {person?.available === false ? (
            <Text style={[s.muted, { padding: 20 }]}>
              Esta cuenta no está disponible.
            </Text>
          ) : (
            <View style={s.composer}>
              <TextInput
                accessibilityLabel="Escribir mensaje"
                value={text}
                onChangeText={setText}
                style={s.input}
                multiline
                maxLength={4000}
                placeholder="Escribe un mensaje…"
                placeholderTextColor={videoColors.muted}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  sending ? "Enviando mensaje" : "Enviar mensaje"
                }
                disabled={sending || !text.trim()}
                onPress={() => void send()}
                style={[s.send, (sending || !text.trim()) && { opacity: 0.45 }]}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ProppixIcon name="arrow" />
                )}
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Conversar con ${item.participant.display_name}${item.unread ? `, ${item.unread} mensajes sin leer` : ""}`}
              style={s.thread}
              onPress={() => {
                selectConversation(item.id);
                setPerson(item.participant);
              }}
            >
              <Avatar person={item.participant} />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={s.name} numberOfLines={1}>
                  {item.participant.display_name}
                </Text>
                <Text style={s.preview} numberOfLines={1}>
                  {item.from_me ? "Tú: " : ""}
                  {item.last_message}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 7 }}>
                <Text style={s.date}>
                  {new Date(item.updated_at).toLocaleDateString("es-CL", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </Text>
                {item.unread > 0 && (
                  <View style={s.unread}>
                    <Text style={s.unreadText}>
                      {item.unread > 99 ? "99+" : item.unread}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            !busy && !error ? (
              <View style={s.empty}>
                <ProppixIcon
                  name="messages"
                  color={videoColors.cyan}
                  size={46}
                />
                <Text style={s.title}>Comienza una conversación</Text>
                <Text style={s.muted}>
                  Abre un perfil o una propiedad y pulsa “Enviar mensaje”.
                </Text>
              </View>
            ) : undefined
          }
          ListFooterComponent={
            inboxMore ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={s.loadMore}
                onPress={() => void loadInbox(inboxPage + 1)}
              >
                <Text style={s.muted}>Cargar más conversaciones</Text>
              </Pressable>
            ) : undefined
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: videoColors.background },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: videoColors.border,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  back: { color: "#fff", fontSize: 36, lineHeight: 38 },
  iconButton: {
    minWidth: 38,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#20518b",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: "#fff", fontSize: 19, fontWeight: "700" },
  thread: {
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    padding: 18,
    borderBottomWidth: 1,
    borderColor: "#ffffff0d",
  },
  name: { color: "#fff", fontSize: 16, fontWeight: "600" },
  preview: { color: videoColors.muted, fontSize: 13 },
  date: { color: videoColors.muted, fontSize: 10 },
  unread: {
    backgroundColor: videoColors.cyan,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { color: "#052553", fontSize: 11, fontWeight: "800" },
  empty: {
    padding: 30,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  muted: { color: videoColors.muted, textAlign: "center", lineHeight: 22 },
  white: { color: "#fff", fontWeight: "700" },
  primary: {
    backgroundColor: "#0866f5",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 5,
  },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: "#0866f5",
    borderBottomRightRadius: 4,
  },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: "#18416f",
    borderBottomLeftRadius: 4,
  },
  body: { color: "#fff", fontSize: 15, lineHeight: 22 },
  time: { color: "#d8eaff", fontSize: 9, alignSelf: "flex-end" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderColor: videoColors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: videoColors.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    backgroundColor: "#0866f5",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMore: { padding: 18, alignItems: "center" },
  errorBox: { padding: 12, backgroundColor: "#402032" },
  error: { color: "#ffd6d6", fontSize: 13, lineHeight: 19 },
});
