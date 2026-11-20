import { missingPropertyData } from "./property-guidance";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";
import { api } from "./api";
import { KeyboardSafeView } from "./KeyboardSafeView";
import {
  DictationDraft,
  dictationLabelsFor,
  DictationAmenity,
  dictationEnumLabel,
  toggleDictationField,
} from "./property-dictation";
import { formatClpInput } from "./clp";

export function PropertyDictation({
  token,
  initialVideoId,
  sourceVideoTitle,
  initialContext = "",
  videoMode = false,
  current,
  amenities = [],
  display,
  onApply,
  onClose,
}: {
  token: string;
  initialVideoId?: string;
  sourceVideoTitle?: string;
  initialContext?: string;
  videoMode?: boolean;
  current: Record<string, string>;
  amenities?: DictationAmenity[];
  display: (key: string, value: string) => string;
  onApply: (fields: Record<string, string>, selected: string[]) => void;
  onClose: () => void;
}) {
  const dictationLabels = dictationLabelsFor(amenities);
  const [phase, setPhase] = useState<
    "intro" | "starting" | "recording" | "ready" | "processing" | "review"
  >("intro");
  const [error, setError] = useState(""),
    [transcript, setTranscript] = useState(""),
    [draft, setDraft] = useState<DictationDraft | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [configured, setConfigured] = useState<boolean | null>(null),
    [foreground, setForeground] = useState(AppState.currentState === "active");
  const [finishedRevision, setFinishedRevision] = useState(0);
  const [videoId, setVideoId] = useState(initialVideoId || ""),
    [videos, setVideos] = useState<
      { id: string; title: string; status: string }[]
    >([]),
    [videoPage, setVideoPage] = useState(0),
    [moreVideos, setMoreVideos] = useState(false),
    [loadingVideos, setLoadingVideos] = useState(videoMode && !initialVideoId);
  const live = useRef(true),
    lock = useRef(false),
    controller = useRef<AbortController | null>(null),
    owned = useRef<string | null>(null),
    contextText = useRef(initialContext),
    submittedRecording = useRef<string | null>(null),
    closing = useRef(false),
    videoStarted = useRef(false);
  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 },
    (status) => {
      if (!live.current) return;
      if (status.hasError) {
        setError("La grabación se interrumpió. Puedes volver a grabar.");
        setPhase("intro");
      } else if (status.isFinished) {
        setPhase("ready");
        setFinishedRevision((v) => v + 1);
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    },
  );
  const state = useAudioRecorderState(recorder, 250);
  const busy = phase === "processing" || phase === "starting";
  useEffect(() => {
    live.current = true;
    const request = new AbortController();
    void api<{ enabled: boolean }>("/manage/property-dictation/capabilities", {
      token,
      signal: request.signal,
    })
      .then((r) => {
        if (live.current && !request.signal.aborted) {
          setConfigured(r.enabled);
        }
      })
      .catch((e) => {
        if (live.current) setError(e.message);
      });
    if (videoMode && !initialVideoId)
      void api<{
        items: { id: string; title: string; status: string }[];
        has_more: boolean;
      }>("/manage/property-dictation/videos?page=1", {
        token,
        signal: request.signal,
      })
        .then((r) => {
          if (!request.signal.aborted && live.current) {
            setVideos(r.items);
            setVideoPage(1);
            setMoreVideos(r.has_more);
          }
        })
        .catch((e) => {
          if (!request.signal.aborted && live.current) setError(e.message);
        })
        .finally(() => {
          if (!request.signal.aborted && live.current) setLoadingVideos(false);
        });
    const sub = AppState.addEventListener("change", (value) => {
      setForeground(value === "active");
      if (value !== "active" && recorder.isRecording)
        void recorder.stop().catch(() => {});
    });
    return () => {
      live.current = false;
      request.abort();
      controller.current?.abort();
      const uri = owned.current;
      if (uri)
        try {
          const file = new File(uri);
          if (file.exists) file.delete();
        } catch {}
      sub.remove();
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, [token, recorder, videoMode, initialVideoId]);
  async function loadVideos(page: number) {
    if (loadingVideos) return;
    setLoadingVideos(true);
    setError("");
    try {
      const r = await api<{
        items: { id: string; title: string; status: string }[];
        has_more: boolean;
      }>("/manage/property-dictation/videos?page=" + page, { token });
      if (!live.current) return;
      setVideos((old) => (page === 1 ? r.items : [...old, ...r.items]));
      setVideoPage(page);
      setMoreVideos(r.has_more);
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      if (live.current) setLoadingVideos(false);
    }
  }
  function eraseRecording() {
    const uri = owned.current || recorder.uri;
    owned.current = null;
    if (uri)
      try {
        const file = new File(uri);
        if (file.exists) file.delete();
      } catch {}
  }
  async function close() {
    closing.current = true;
    if (lock.current && phase === "starting") return;
    controller.current?.abort();
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {}
    eraseRecording();
    onClose();
  }
  async function start(complement = false) {
    if (lock.current) return;
    lock.current = true;
    closing.current = false;
    submittedRecording.current = null;
    contextText.current = complement
      ? draft?.transcript || transcript || initialContext
      : initialContext;
    setError("");
    setPhase("starting");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Permite el micrófono en los ajustes del teléfono para dictar. También puedes escribir la descripción aquí.",
        );
      eraseRecording();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      owned.current = recorder.uri;
      if (!live.current) return;
      if (!complement) setDraft(null);
      setTranscript("");
      recorder.record({ forDuration: 180 });
      setPhase("recording");
    } catch (e) {
      if (live.current) {
        setError((e as Error).message);
        setPhase("intro");
      }
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } finally {
      lock.current = false;
    }
  }
  async function stop() {
    if (lock.current) return;
    lock.current = true;
    try {
      await recorder.stop();
      owned.current = recorder.uri;
      if (live.current) setPhase("ready");
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (live.current) setFinishedRevision((v) => v + 1);
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }
  async function interpret(useAudio: boolean, fromVideo = false) {
    if (lock.current || closing.current) return;
    const recordingUri = owned.current || recorder.uri;
    if (useAudio && recordingUri && submittedRecording.current === recordingUri)
      return;
    lock.current = true;
    setError("");
    setPhase("processing");
    const request = new AbortController();
    controller.current = request;
    try {
      let body:
        | FormData
        | { transcript: string; context_transcript?: string }
        | { video_id: string; context_transcript?: string };
      if (fromVideo) {
        if (!videoId) throw new Error("Selecciona un video propio.");
        body = {
          video_id: initialVideoId || videoId,
          context_transcript: contextText.current,
        };
      } else if (useAudio) {
        const uri = owned.current || recorder.uri;
        if (!uri) throw new Error("Graba primero una descripción.");
        owned.current = uri;
        const file = new File(uri);
        if (file.size > 12 * 1024 * 1024)
          throw new Error(
            "El audio supera 12 MB. Graba una descripción más breve.",
          );
        const form = new FormData();
        form.append("file", file, "propiedad.m4a");
        if (contextText.current)
          form.append("context_transcript", contextText.current);
        submittedRecording.current = uri;
        body = form;
      } else
        body = {
          transcript: transcript.trim(),
          context_transcript: contextText.current,
        };
      const result = await api<DictationDraft>("/manage/property-dictation", {
        method: "POST",
        token,
        body,
        signal: request.signal,
      });
      if (request.signal.aborted || !live.current) return;
      if (
        !result.fields ||
        !Array.isArray(result.warnings) ||
        typeof result.transcript !== "string"
      )
        throw new Error("No se pudo leer la propuesta. Intenta nuevamente.");
      contextText.current = "";
      setTranscript(result.transcript);
      setDraft(result);
      setSelected(
        Object.keys(result.fields).filter((k) =>
          Object.prototype.hasOwnProperty.call(dictationLabels, k),
        ),
      );
      setPhase("review");
      eraseRecording();
    } catch (e) {
      submittedRecording.current = null;
      if (!request.signal.aborted && live.current) {
        setError((e as Error).message);
        setPhase(transcript ? "review" : "ready");
      }
    } finally {
      lock.current = false;
    }
  }
  const processRecording = useEffectEvent(() => {
    if (live.current && !closing.current) void interpret(true);
  });
  const processVideo = useEffectEvent(() => {
    if (live.current && !closing.current && !videoStarted.current) {
      videoStarted.current = true;
      void interpret(false, true);
    }
  });
  useEffect(() => {
    if (
      phase !== "ready" ||
      !foreground ||
      !configured ||
      !recorder.uri ||
      error
    )
      return;
    const timer = setTimeout(() => processRecording(), 0);
    return () => clearTimeout(timer);
  }, [phase, foreground, configured, recorder.uri, error, finishedRevision]);
  useEffect(() => {
    if (!videoMode || !initialVideoId || !configured) return;
    const timer = setTimeout(() => processVideo(), 0);
    return () => clearTimeout(timer);
  }, [videoMode, initialVideoId, configured]);
  const value = (key: string, text: string) =>
    key === "price_amount" && draft?.fields.price_unit === "CLP"
      ? formatClpInput(text)
      : dictationEnumLabel(key, display(key, text));
  return (
    <Modal visible animationType="slide" onRequestClose={() => void close()}>
      <SafeAreaView style={s.root}>
        <KeyboardSafeView>
          <View style={s.header}>
            <Text style={s.title}>
              {videoMode ? "Usar audio del video" : "Dictar propiedad"}
            </Text>
            <Pressable
              accessibilityLabel="Cerrar dictado"
              onPress={() => void close()}
              disabled={phase === "starting"}
              style={{ padding: 8 }}
            >
              <Text style={{ fontSize: 30, color: "#123b70" }}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ padding: 18, gap: 14 }}
          >
            <Text style={s.text}>
              Cuenta la ubicación, precio, dormitorios, baños, superficies y
              otras características. Después revisa la propuesta: nada se guarda
              ni publica automáticamente. Al terminar la grabación, la
              interpretación comienza automáticamente.
            </Text>
            {videoMode && !busy && !draft && phase !== "recording" && (
              <>
                <Text style={s.text}>
                  Usaremos el audio del video para completar la propiedad. Solo
                  su audio se enviará a OpenAI. Revisa los datos antes de
                  aplicar: no se guarda ni se enlaza automáticamente.
                </Text>
                {loadingVideos && <ActivityIndicator color="#0866f5" />}
                {!!initialVideoId && (
                  <Text style={s.label}>
                    Audio de: {sourceVideoTitle || "el video que seleccionaste"}
                  </Text>
                )}
                {!initialVideoId &&
                  videos.map((v) => (
                    <Pressable
                      key={v.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: videoId === v.id }}
                      style={s.proposal}
                      onPress={() => {
                        setVideoId(v.id);
                        setDraft(null);
                        setSelected([]);
                        setTranscript("");
                      }}
                    >
                      <Text style={s.label}>
                        {videoId === v.id ? "●" : "○"} {v.title}
                      </Text>
                      <Text style={s.text}>
                        {v.status === "published" ? "Publicado" : "Borrador"}
                      </Text>
                    </Pressable>
                  ))}
                {moreVideos && (
                  <DictationButton
                    label="Cargar más videos"
                    onPress={() => void loadVideos(videoPage + 1)}
                    secondary
                    disabled={loadingVideos}
                  />
                )}
                <DictationButton
                  label="Extraer audio y proponer datos"
                  onPress={() => void interpret(false, true)}
                  disabled={
                    configured !== true ||
                    !(initialVideoId || videoId) ||
                    loadingVideos
                  }
                />
              </>
            )}
            {configured === false && (
              <Text style={s.error}>
                El dictado con IA todavía no está configurado. Puedes seguir
                completando la propiedad manualmente.
              </Text>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            {busy && (
              <>
                <ActivityIndicator color="#0866f5" />
                <Text style={s.text}>
                  {phase === "starting"
                    ? "Preparando micrófono…"
                    : "Interpretando tu descripción…"}
                </Text>
              </>
            )}
            {phase === "recording" ? (
              <>
                <Text accessibilityLiveRegion="polite" style={s.title}>
                  ● Grabando · {Math.floor(state.durationMillis / 1000)} / 180 s
                </Text>
                {
                  <DictationButton
                    label={"Terminar grabación"}
                    onPress={() => void stop()}
                    secondary={false}
                    disabled={false}
                  />
                }
              </>
            ) : (
              !busy && (
                <DictationButton
                  label={phase === "intro" ? "Grabar audio" : "Nuevo dictado"}
                  onPress={() => void start()}
                  secondary={true}
                  disabled={configured !== true}
                />
              )
            )}
            {phase === "ready" && !busy && !!error && !!recorder.uri && (
              <DictationButton
                label={"Reintentar interpretación"}
                onPress={() => void interpret(true)}
                secondary={false}
                disabled={configured !== true || !recorder.uri}
              />
            )}
            {phase !== "recording" && (
              <>
                <Text style={s.label}>
                  Descripción o transcripción · puedes corregirla
                </Text>
                <TextInput
                  accessibilityLabel="Texto dictado para revisar"
                  value={transcript}
                  onChangeText={(text) => {
                    setTranscript(text);
                    setDraft(null);
                    setSelected([]);
                  }}
                  multiline
                  maxLength={12000}
                  editable={!busy}
                  placeholder="Ejemplo: vendo casa en Puerto Varas por 150 millones de pesos…"
                  placeholderTextColor="#61728a"
                  style={s.input}
                />
                {
                  <DictationButton
                    label={"Interpretar este texto"}
                    onPress={() => void interpret(false)}
                    secondary={true}
                    disabled={
                      busy ||
                      configured !== true ||
                      transcript.trim().length < 8
                    }
                  />
                }
              </>
            )}
            {!!draft && phase === "review" && (
              <>
                <Text style={s.title}>Revisa los datos propuestos</Text>
                <Text style={s.warning}>
                  {missingPropertyData({ ...current, ...draft.fields }).length
                    ? "Puedes completar por voz: " +
                      missingPropertyData({ ...current, ...draft.fields }).join(
                        ", ",
                      ) +
                      "."
                    : "Los datos principales están completos. Puedes agregar más detalles por voz."}
                </Text>
                <DictationButton
                  label="Completar por voz"
                  onPress={() => void start(true)}
                  secondary
                />
                <Text style={s.text}>
                  Selecciona los campos que quieres aplicar. Puedes editarlos en
                  el formulario antes de guardar.
                </Text>
                {draft.warnings.map((w, i) => (
                  <Text key={i} style={s.warning}>
                    {w}
                  </Text>
                ))}
                {!Object.keys(draft.fields).length && (
                  <Text style={s.text}>
                    No se identificaron campos. Completa o corrige la
                    descripción y vuelve a interpretar.
                  </Text>
                )}
                {Object.entries(draft.fields)
                  .filter(([key]) =>
                    Object.prototype.hasOwnProperty.call(dictationLabels, key),
                  )
                  .map(([key, text]) => (
                    <Pressable
                      key={key}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected.includes(key) }}
                      onPress={() =>
                        setSelected((old) =>
                          toggleDictationField(old, key, draft.fields),
                        )
                      }
                      style={s.proposal}
                    >
                      <Text style={s.label}>
                        {selected.includes(key) ? "☑" : "☐"}{" "}
                        {dictationLabels[key]}
                      </Text>
                      <Text style={s.text}>{value(key, text)}</Text>
                      {!!current[key] && current[key] !== text && (
                        <Text style={s.previous}>
                          Reemplazará:{" "}
                          {dictationEnumLabel(key, display(key, current[key]))}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                {
                  <DictationButton
                    label={"Aplicar al formulario"}
                    onPress={() => {
                      onApply(draft.fields, selected);
                      onClose();
                    }}
                    secondary={false}
                    disabled={!selected.length}
                  />
                }
              </>
            )}
            {
              <DictationButton
                label={busy ? "Cancelar procesamiento" : "Volver sin aplicar"}
                onPress={() => void close()}
                secondary={true}
                disabled={phase === "starting"}
              />
            }
          </ScrollView>
        </KeyboardSafeView>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#123b70" },
  text: { fontSize: 15, lineHeight: 22, color: "#526b85" },
  label: { color: "#123b70", fontWeight: "700", fontSize: 15 },
  button: {
    padding: 15,
    borderRadius: 14,
    backgroundColor: "#0866f5",
    alignItems: "center",
  },
  secondary: { backgroundColor: "#edf6ff" },
  buttonText: { color: "#fff", fontWeight: "700" },
  input: {
    minHeight: 115,
    padding: 14,
    borderWidth: 1,
    borderColor: "#c9def4",
    borderRadius: 14,
    color: "#123b70",
    textAlignVertical: "top",
  },
  proposal: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#c9def4",
    borderRadius: 14,
    gap: 7,
  },
  error: { color: "#a12b36" },
  warning: {
    color: "#77521a",
    backgroundColor: "#fff6df",
    padding: 12,
    borderRadius: 10,
  },
  previous: { color: "#61728a", fontSize: 13 },
});

function DictationButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        s.button,
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: "#123b70" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
