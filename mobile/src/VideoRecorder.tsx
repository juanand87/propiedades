import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  CameraType,
} from "expo-camera";
import { File } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter } from "expo-router";
import { api, ApiError, Property, Session, IS_PRODUCTION } from "./api";

type Clip = {
  uri: string;
  size: number;
  requestId: string;
  limit: 15 | 30 | 45;
};
type Phase = "camera" | "recording" | "stopping" | "preview" | "uploading";
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la operación.";
function Preview({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [player, active]);
  return (
    <VideoView
      player={player}
      style={styles.preview}
      nativeControls
      contentFit="contain"
      surfaceType="textureView"
    />
  );
}
function Action({
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
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.action,
        secondary && styles.secondary,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[styles.actionText, secondary && { color: "#e5f0eb" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function VideoRecorder({
  propertyId,
  session,
  onPublished,
  onSaved,
}: {
  propertyId: string | undefined;
  session: Session | null;
  onPublished: () => void;
  onSaved: () => void;
}) {
  const router = useRouter(),
    camera = useRef<CameraView>(null),
    recording = useRef(false),
    alive = useRef(true),
    watchdog = useRef<ReturnType<typeof setTimeout> | null>(null),
    uploading = useRef(false);
  const [cameraPermission, requestCamera] = useCameraPermissions(),
    [micPermission, requestMic] = useMicrophonePermissions();
  const [property, setProperty] = useState<Property | null>(null),
    [loadError, setLoadError] = useState(""),
    [phase, setPhase] = useState<Phase>("camera"),
    [limit, setLimit] = useState<15 | 30 | 45>(15),
    [elapsed, setElapsed] = useState(0),
    [facing, setFacing] = useState<CameraType>("back"),
    [silent, setSilent] = useState(false),
    [cameraReady, setCameraReady] = useState(false),
    [cameraError, setCameraError] = useState(""),
    [clip, setClip] = useState<Clip | null>(null),
    [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [foreground, setForeground] = useState(AppState.currentState === "active"),
    [attempt, setAttempt] = useState<"published" | "draft" | null>(null);
  const [reload, setReload] = useState(0);
  function stop() {
    if (!recording.current) return;
    try {
      camera.current?.stopRecording();
      setPhase("stopping");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function leave() {
    if (uploading.current) {
      Alert.alert("Publicación en curso", "Espera a que termine la subida.");
      return;
    }
    if (recording.current) {
      Alert.alert("Grabación en curso", "Detén el video antes de salir.");
      return;
    }
    const exit = () => {
      router.replace("/mis-videos");
    };
    if (clip)
      Alert.alert(
        "¿Salir sin guardar?",
        attempt
          ? "La última subida no se confirmó. Revisa Mis videos antes de volver a publicar."
          : "Este video aún no está guardado en el servidor.",
        [
          { text: "Seguir editando", style: "cancel" },
          { text: "Salir", onPress: exit },
        ],
      );
    else exit();
  }
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      if (state !== "active") setCameraReady(false);
      if (state !== "active" && recording.current) {
        camera.current?.stopRecording();
      }
    });
    return () => {
      alive.current = false;
      sub.remove();
      if (watchdog.current) clearTimeout(watchdog.current);
      // CameraView stops its native recording when it unmounts.
    };
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      leave();
      return true;
    });
    return () => sub.remove();
  });
  useEffect(() => {
    if (!session || !propertyId) return;
    let current = true;
    const controller = new AbortController();
    void api<Property>(`/manage/properties/${encodeURIComponent(propertyId)}`, {
      token: session.access_token,
      signal: controller.signal,
    })
      .then((p) => {
        if (current) {
          setProperty(p);
          setLoadError("");
          setTitle(`Recorrido · ${p.title}`.slice(0, 160));
        }
      })
      .catch((e) => {
        if (current) setLoadError(errorMessage(e));
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [session, propertyId, reload]);
  async function enableCamera() {
    setError("");
    try {
      const c = await requestCamera();
      if (c.granted && !silent) {
        const m = await requestMic();
        if (!m.granted) setSilent(true);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function start() {
    if (
      recording.current ||
      !cameraReady ||
      !camera.current ||
      !cameraPermission?.granted
    )
      return;
    if (!silent && !micPermission?.granted) {
      await enableCamera();
      return;
    }
    recording.current = true;
    setError("");
    setElapsed(0);
    setPhase("recording");
    watchdog.current = setTimeout(
      () => {
        if (recording.current) camera.current?.stopRecording();
      },
      (limit + 2) * 1000,
    );
    try {
      const result = await camera.current.recordAsync({
        maxDuration: limit,
        maxFileSize: 48 * 1024 * 1024,
        codec: "avc1",
        progressUpdateInterval: 0.1,
      });
      if (!alive.current) return;
      if (!result?.uri)
        throw new Error("La cámara no devolvió un video. Intenta nuevamente.");
      const size = new File(result.uri).size;
      if (!size || size > 50 * 1024 * 1024)
        throw new Error(
          "El video está vacío o supera los 50 MB. Vuelve a grabarlo.",
        );
      setClip({ uri: result.uri, size, requestId: randomUUID(), limit });
      setAttempt(null);
      setPhase("preview");
    } catch (e) {
      if (alive.current) {
        setError(errorMessage(e));
        setPhase("camera");
        setCameraReady(false);
      }
    } finally {
      recording.current = false;
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = null;
    }
  }
  function retake() {
    Alert.alert(
      "¿Volver a grabar?",
      attempt
        ? "La subida no fue confirmada. Revisa Mis videos antes de crear otro video."
        : "Se reemplazará esta grabación que todavía no guardaste.",
      [
        { text: "Conservar", style: "cancel" },
        {
          text: "Volver a grabar",
          onPress: () => {
            setClip(null);
            setAttempt(null);
            setElapsed(0);
            setError("");
            setCameraReady(false);
            setCameraError("");
            setPhase("camera");
          },
        },
      ],
    );
  }
  async function save(publish: boolean) {
    if (!clip || !property || !session || uploading.current || !title.trim())
      return;
    const mode = publish ? "published" : "draft";
    if (attempt && attempt !== mode) return;
    uploading.current = true;
    setAttempt(mode);
    setPhase("uploading");
    setError("");
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("capture_seconds", String(clip.limit));
      form.append("request_id", clip.requestId);
      form.append("publish", String(publish));
      form.append("file", new File(clip.uri));
      const value = await api<{ id: string; status: string }>(
        `/manage/properties/${property.id}/videos`,
        { method: "POST", token: session.access_token, body: form },
      );
      if (!alive.current) return;
      if (value.status !== mode)
        throw new Error(
          "El video ya existe con otro estado. Revísalo en Mis videos.",
        );
      if (publish) {
        onPublished();
        router.replace("/");
      } else {
        onSaved();
        router.replace("/mis-videos");
      }
    } catch (e) {
      if (alive.current) {
        setError(
          errorMessage(e) +
            (e instanceof ApiError && e.status < 500
              ? ""
              : " Puedes reintentar sin duplicar el video."),
        );
        if (e instanceof ApiError && e.status < 500) setAttempt(null);
        setPhase("preview");
      }
    } finally {
      uploading.current = false;
    }
  }
  if (!session)
    return (
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>CREA TU RECORRIDO</Text>
        <Text style={styles.heading}>Primero, inicia sesión</Text>
        <Text style={styles.body}>
          {IS_PRODUCTION
            ? "Usa tu cuenta de Propiedades para grabar y publicar."
            : "Usa una cuenta local para grabar y publicar en tus propiedades."}
        </Text>
        <Action
          label="Ir a mi cuenta"
          onPress={() => router.replace("/cuenta")}
        />
        <Action
          label="Volver"
          secondary
          onPress={() => router.replace("/mis-videos")}
        />
      </View>
    );
  if (!property)
    return (
      <View style={styles.panel}>
        <Text style={styles.heading}>Preparando tu propiedad</Text>
        {loadError ? (
          <>
            <Text style={styles.error}>{loadError}</Text>
            <Action
              label="Reintentar"
              onPress={() => setReload((v) => v + 1)}
            />
          </>
        ) : (
          <ActivityIndicator color="#d0f5a8" />
        )}
        <Action label="Volver a Mis videos" secondary onPress={leave} />
      </View>
    );
  if (clip)
    return (
      <ScrollView style={styles.review} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>REVISA Y PUBLICA</Text>
        <Text style={styles.heading}>Tu propiedad, en movimiento</Text>
        <Preview uri={clip.uri} active={foreground && phase === "preview"} />
        <Text style={styles.property}>{property.title}</Text>
        <Text style={styles.body}>
          Modo {clip.limit} s · {(clip.size / 1024 / 1024).toFixed(1)} MB ·
          Vinculado a esta propiedad
        </Text>
        <Text style={styles.label}>Título del video</Text>
        <TextInput
          accessibilityLabel="Título del video grabado"
          value={title}
          onChangeText={setTitle}
          maxLength={160}
          editable={phase !== "uploading" && !attempt}
          style={styles.input}
        />
        {!!error && (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        )}
        {property.publication_status !== "published" && (
          <Text style={styles.error}>
            La propiedad aún no está publicada. Puedes guardar el video como
            borrador.
          </Text>
        )}
        <Action
          label={
            phase === "uploading"
              ? "Subiendo y guardando…"
              : attempt === "published"
                ? "Reintentar publicación"
                : "Publicar ahora"
          }
          disabled={
            phase === "uploading" ||
            !title.trim() ||
            property.publication_status !== "published" ||
            attempt === "draft"
          }
          onPress={() => void save(true)}
        />
        <Action
          label={
            attempt === "draft"
              ? "Reintentar guardado"
              : "Guardar como borrador"
          }
          secondary
          disabled={
            phase === "uploading" || !title.trim() || attempt === "published"
          }
          onPress={() => void save(false)}
        />
        <Action
          label="Volver a grabar"
          secondary
          disabled={phase === "uploading"}
          onPress={retake}
        />
        <Action
          label="Volver a Mis videos"
          secondary
          disabled={phase === "uploading"}
          onPress={leave}
        />
        <Text style={styles.hint}>
          {IS_PRODUCTION
            ? "El video se publicará en la propiedad seleccionada."
            : "La publicación se realiza únicamente en la demo local."}{" "}
          Si falla la conexión, el video permanece aquí para reintentar. Salir o
          recargar la app descarta el editor.
        </Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    );
  if (!cameraPermission?.granted)
    return (
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>15 · 30 · 45 SEGUNDOS</Text>
        <Text style={styles.heading}>Dale vida a tu propiedad</Text>
        <Text style={styles.body}>
          Permite la cámara para grabar. El micrófono es opcional; puedes
          continuar sin sonido. Nada se publica hasta que lo revises y pulses
          Publicar ahora.
        </Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Action label="Activar cámara" onPress={() => void enableCamera()} />
        {cameraPermission?.canAskAgain === false && (
          <>
            <Text style={styles.body}>
              Android bloqueó nuevas solicitudes. Habilita la cámara en los
              ajustes de Expo Go y vuelve a la app.
            </Text>
            <Action
              label="Abrir ajustes de Android"
              secondary
              onPress={() => void Linking.openSettings()}
            />
          </>
        )}
        <Action label="Volver a Mis videos" secondary onPress={leave} />
      </View>
    );
  const capturing = phase === "recording" || phase === "stopping";
  return (
    <View style={styles.cameraScreen}>
      {foreground && (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
          videoQuality="720p"
          videoBitrate={3_000_000}
          mute={silent || !micPermission?.granted}
          onCameraReady={() => {
            setCameraReady(true);
            setCameraError("");
          }}
          onMountError={(e) => {
            setCameraError(e.message);
            setCameraReady(false);
          }}
          onRecordingProgress={(e) => {
            setElapsed(Math.min(e.duration, limit));
          }}
        />
      )}
      <View style={styles.cameraTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar grabador"
          onPress={leave}
          style={styles.round}
        >
          <Text style={styles.white}>✕</Text>
        </Pressable>
        <Text style={styles.badge}>
          {IS_PRODUCTION ? "PROPIEDADES" : "LOCAL"} ·{" "}
          {silent ? "SIN SONIDO" : "CON SONIDO"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cambiar cámara"
          disabled={capturing}
          onPress={() => {
            setCameraReady(false);
            setFacing((v) => (v === "back" ? "front" : "back"));
          }}
          style={[styles.round, capturing && { opacity: 0.3 }]}
        >
          <Text style={styles.white}>↻</Text>
        </Pressable>
      </View>
      <View style={styles.cameraBottom}>
        <Text style={styles.property} numberOfLines={2}>
          {property.title}
        </Text>
        <View style={styles.progress}>
          <View
            style={[
              styles.progressFill,
              { width: `${(elapsed / limit) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.counter}>
          {elapsed.toFixed(1)} / {limit} s
        </Text>
        {!!cameraError && (
          <Text style={styles.error}>
            No se pudo iniciar la cámara: {cameraError}. En el emulador la
            grabación depende de la cámara virtual; compruébala también en un
            teléfono.
          </Text>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.durations}>
          {([15, 30, 45] as const).map((n) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Duración máxima ${n} segundos`}
              accessibilityState={{ selected: limit === n }}
              key={n}
              disabled={capturing}
              onPress={() => setLimit(n)}
              style={[styles.duration, limit === n && styles.durationActive]}
            >
              <Text style={limit === n ? styles.dark : styles.white}>
                {n} s
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              silent ? "Activar micrófono" : "Grabar sin sonido"
            }
            disabled={capturing}
            onPress={() => {
              if (silent && !micPermission?.granted) {
                void requestMic().then((p) => {
                  if (p.granted) setSilent(false);
                });
              } else setSilent((v) => !v);
            }}
            style={styles.audio}
          >
            <Text style={styles.white}>{silent ? "Sin sonido" : "Sonido"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              capturing ? "Detener grabación" : "Iniciar grabación"
            }
            disabled={phase === "stopping" || (!capturing && !cameraReady)}
            onPress={() => (capturing ? stop() : void start())}
            style={[styles.record, phase === "stopping" && { opacity: 0.4 }]}
          >
            {capturing ? (
              <View style={styles.stop} />
            ) : (
              <View style={styles.recordInner} />
            )}
          </Pressable>
          <View style={{ width: 70 }} />
        </View>
        <Text style={styles.hint}>
          {capturing
            ? "La grabación se detiene automáticamente al llegar al límite."
            : "Toca para grabar. Después podrás revisar el video y publicarlo."}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    flex: 1,
    padding: 26,
    justifyContent: "center",
    backgroundColor: "#0b1e21",
  },
  review: { flex: 1, padding: 20, backgroundColor: "#0b1e21" },
  eyebrow: {
    color: "#b9dda0",
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 14,
  },
  heading: {
    color: "#f1f6ee",
    fontSize: 29,
    fontWeight: "800",
    marginBottom: 18,
  },
  body: { color: "#b3cbbf", fontSize: 14, lineHeight: 23, marginBottom: 15 },
  action: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#d0f5a8",
    marginVertical: 6,
  },
  secondary: {
    backgroundColor: "#1e3c3c",
    borderWidth: 1,
    borderColor: "#3c5a51",
  },
  actionText: { color: "#19362b", fontWeight: "800" },
  preview: {
    height: 360,
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#000",
    marginBottom: 18,
  },
  property: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 10,
  },
  label: { color: "#d4e7d9", fontSize: 13, marginVertical: 10 },
  input: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#426554",
    color: "#fff",
    fontSize: 15,
    marginBottom: 12,
  },
  error: { color: "#ffd0c3", lineHeight: 22, marginVertical: 10 },
  hint: {
    color: "#b5c9c2",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 12,
  },
  cameraScreen: { flex: 1, backgroundColor: "#000" },
  cameraTop: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  round: {
    width: 42,
    height: 42,
    borderRadius: 22,
    backgroundColor: "#092624aa",
    alignItems: "center",
    justifyContent: "center",
  },
  white: { color: "#fff", fontWeight: "700" },
  badge: {
    color: "#e4f7dc",
    fontSize: 10,
    letterSpacing: 1,
    backgroundColor: "#173e35bb",
    padding: 10,
    borderRadius: 20,
  },
  cameraBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 22,
    backgroundColor: "#081c22ba",
  },
  progress: {
    height: 4,
    borderRadius: 3,
    backgroundColor: "#8fa59b55",
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: "#e5f7b5" },
  counter: {
    color: "#fff",
    fontVariant: ["tabular-nums"],
    fontSize: 14,
    textAlign: "center",
    margin: 14,
  },
  durations: { flexDirection: "row", justifyContent: "center", gap: 10 },
  duration: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: "#284a45",
  },
  durationActive: { backgroundColor: "#d0f5a8" },
  dark: { color: "#14372c", fontWeight: "800" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  audio: { width: 70, alignItems: "center" },
  record: {
    width: 76,
    height: 76,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  recordInner: {
    width: 60,
    height: 60,
    borderRadius: 32,
    backgroundColor: "#f54a63",
  },
  stop: { width: 30, height: 30, borderRadius: 6, backgroundColor: "#f54a63" },
});
