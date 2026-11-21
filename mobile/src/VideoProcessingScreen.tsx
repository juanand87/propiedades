import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { api, mediaUrl, Session } from "./api";
import { useVideoPlayer, VideoView } from "expo-video";

function ReadyPreview({ id, token }: { id: string; token: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void api<{ url: string }>(`/manage/videos/${id}/preview`, {
      token,
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setUrl(mediaUrl(value.url));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Puedes abrir el video desde Ver mi video.");
      });
    return () => controller.abort();
  }, [id, token]);
  return url ? (
    <ReadyPlayer uri={url} />
  ) : (
    <Text style={s.note}>{error || "Preparando vista previa…"}</Text>
  );
}
function ReadyPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{ height: 260, backgroundColor: "#000", borderRadius: 16 }}
    />
  );
}

export type ProcessingJob = {
  upload_id: string;
  processing_status:
    | "pending"
    | "processing"
    | "preparing"
    | "ready"
    | "failed";
  video_id: string | null;
  result: {
    id: string;
    title: string;
    status: string;
    property_id: string | null;
  } | null;
  message: string | null;
};
export function VideoProcessingScreen({
  uploadId,
  session,
  onReady,
}: {
  uploadId?: string;
  session: Session | null;
  onReady: () => void;
}) {
  const router = useRouter();
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [retry, setRetry] = useState(0);
  const token = session?.access_token;
  useEffect(() => {
    if (!token || !uploadId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false,
      terminal = false;
    async function poll() {
      if (polling || controller.signal.aborted || terminal) return;
      polling = true;
      try {
        const value = await api<ProcessingJob>(
          `/manage/video-uploads/${encodeURIComponent(uploadId!)}`,
          { token, signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setJob(value);
        setError("");
        terminal = ["ready", "failed"].includes(value.processing_status);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo consultar el procesamiento. Tu video sigue en el servidor.",
          );
      } finally {
        polling = false;
        if (!controller.signal.aborted && !terminal)
          timer = setTimeout(() => void poll(), 3000);
      }
    }
    void poll();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (timer) clearTimeout(timer);
        void poll();
      }
    });
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      listener.remove();
    };
  }, [uploadId, token, retry]);
  async function notify() {
    if (!token || !uploadId || busy) return;
    setBusy(true);
    setError("");
    try {
      if (Platform.OS !== "android")
        throw Error(
          "El aviso está disponible en Android. Puedes esperar aquí.",
        );
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain)
        permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted)
        throw Error(
          "Activa las notificaciones de Proppix en los ajustes del teléfono o espera aquí.",
        );
      const { data } = await Notifications.getDevicePushTokenAsync();
      if (typeof data !== "string")
        throw Error("No se pudo activar el aviso. Puedes esperar aquí.");
      await api("/messages/devices", {
        method: "POST",
        token,
        body: { token: data },
      });
      await api(`/manage/video-uploads/${uploadId}/notify`, {
        method: "POST",
        token,
      });
      Alert.alert(
        "Te avisaremos cuando esté listo",
        "Puedes seguir usando Proppix o cerrar la app. La notificación te llevará a este video.",
      );
      router.replace("/mis-videos");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo activar el aviso. Puedes esperar aquí.",
      );
    } finally {
      setBusy(false);
    }
  }
  const result = job?.result;
  async function publish() {
    if (!token || !result || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/manage/videos/${result.id}`, {
        method: "PATCH",
        token,
        body: { status: "published" },
      });
      setJob((value) =>
        value && value.result
          ? { ...value, result: { ...value.result, status: "published" } }
          : value,
      );
      onReady();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo publicar el video.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function retryProcessing() {
    if (!token || !uploadId || busy) return;
    setBusy(true);
    setError("");
    try {
      const value = await api<ProcessingJob>(
        `/manage/video-uploads/${uploadId}/retry`,
        { method: "POST", token },
      );
      setJob(value);
      setRetry((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reintentar.");
    } finally {
      setBusy(false);
    }
  }
  const ready = job?.processing_status === "ready" && !!result;
  const failed = job?.processing_status === "failed";
  function action(label: string, press: () => void, secondary = false) {
    return (
      <Pressable
        disabled={busy}
        onPress={press}
        accessibilityRole="button"
        style={[s.button, secondary && s.secondary, busy && { opacity: 0.5 }]}
      >
        <Text style={[s.buttonText, secondary && s.secondaryText]}>
          {label}
        </Text>
      </Pressable>
    );
  }
  return (
    <ScrollView contentContainerStyle={s.screen}>
      <View style={s.card}>
        {!ready && !failed && (
          <ActivityIndicator size="large" color="#0866f5" />
        )}
        <Text style={s.title}>
          {ready
            ? "Tu video está listo"
            : failed
              ? "No pudimos preparar tu video"
              : "Estamos procesando tu video"}
        </Text>
        <Text style={s.description}>
          {ready
            ? result.title
            : failed
              ? job.message
              : "Tu video ya se cargó. Estamos preparándolo para reproducirlo con buena calidad. Puedes esperar aquí o pedir que te avisemos cuando esté listo."}
        </Text>
        {!session && (
          <Text style={s.description}>
            Inicia sesión con la cuenta que cargó el video para continuar.
          </Text>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        {ready ? (
          <>
            {token && <ReadyPreview id={result.id} token={token} />}
            {result.status === "draft" &&
              action("Publicar video", () => void publish())}
            {action("Ver mi video", () => {
              onReady();
              router.push({
                pathname: "/video/[videoId]",
                params: { videoId: result.id },
              });
            })}
            {!result.property_id &&
              action(
                "Agregar datos de esta propiedad",
                () =>
                  router.replace({
                    pathname: "/mis-videos",
                    params: { videoId: result.id, propertyMode: "new" },
                  }),
                true,
              )}
            {!result.property_id &&
              action(
                "Enlazar a una propiedad existente",
                () =>
                  router.replace({
                    pathname: "/mis-videos",
                    params: { videoId: result.id, propertyMode: "link" },
                  }),
                true,
              )}
            <Text style={s.description}>
              {result.status === "published"
                ? "Tu video está publicado."
                : "Tu video quedó como borrador. Puedes publicarlo desde tu galería o asociarlo a una propiedad."}
            </Text>
            {action(
              result.status === "draft"
                ? "Dejar como borrador"
                : "Ir a Mis videos",
              () => {
                onReady();
                router.replace("/mis-videos");
              },
              true,
            )}
          </>
        ) : failed ? (
          <>
            {action("Reintentar procesamiento", () => void retryProcessing())}
            {action("Ir a Mis videos", () => router.replace("/mis-videos"))}
            {action(
              "Volver a cargar un video",
              () => router.replace("/grabar"),
              true,
            )}
          </>
        ) : (
          <>
            {action(
              waiting
                ? "Esperando: te mostraremos el video aquí"
                : "Esperar aquí",
              () => {
                setWaiting(true);
                setRetry((n) => n + 1);
              },
              true,
            )}
            {action(
              busy ? "Activando aviso…" : "Avísame cuando esté listo",
              () => void notify(),
            )}
            <Text style={s.note}>
              Al activar el aviso podrás seguir usando Proppix o cerrar la app.
              Toca la notificación para continuar con este video.
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  screen: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 22,
    backgroundColor: "#f5f9ff",
  },
  card: {
    gap: 20,
    borderRadius: 22,
    padding: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce8f8",
  },
  title: {
    color: "#082750",
    fontWeight: "800",
    fontSize: 25,
    textAlign: "center",
  },
  description: {
    color: "#365b80",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  note: { color: "#56728c", fontSize: 13, lineHeight: 21, textAlign: "center" },
  error: { color: "#a5303a", textAlign: "center", lineHeight: 22 },
  button: {
    backgroundColor: "#0866f5",
    borderRadius: 16,
    padding: 17,
    alignItems: "center",
  },
  secondary: {
    backgroundColor: "#edf5ff",
    borderWidth: 1,
    borderColor: "#bdd5f5",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  secondaryText: { color: "#123b70" },
});
