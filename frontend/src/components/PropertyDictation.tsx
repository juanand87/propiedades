"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  dictationLabelsFor,
  dictationEnumLabel,
  toggleDictationField,
  dictatedPatch,
} from "@/lib/property-dictation";
import { request } from "@/lib/estate-api";
type Draft = {
  transcript: string;
  fields: Record<string, string>;
  warnings: string[];
};
export function PropertyDictation({
  form,
  catalog,
  onApply,
}: {
  form: Record<string, unknown>;
  catalog: any;
  onApply: (fields: Record<string, string>) => void;
}) {
  const labels = dictationLabelsFor(catalog.amenities || []);
  const [open, setOpen] = useState(false),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [phase, setPhase] = useState("intro"),
    [error, setError] = useState(""),
    [transcript, setTranscript] = useState(""),
    [draft, setDraft] = useState<Draft | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [audio, setAudio] = useState<Blob | null>(null),
    [seconds, setSeconds] = useState(0);
  const [videoMode, setVideoMode] = useState(false),
    [videoId, setVideoId] = useState(""),
    [videos, setVideos] = useState<
      { id: string; title: string; status: string }[]
    >([]),
    [videoPage, setVideoPage] = useState(0),
    [moreVideos, setMoreVideos] = useState(false),
    [loadingVideos, setLoadingVideos] = useState(false);
  async function loadVideos(page: number) {
    if (loadingVideos) return;
    setLoadingVideos(true);
    setError("");
    try {
      const r = await request("/manage/property-dictation/videos?page=" + page);
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
  const generation = useRef(0),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    requestRef = useRef<AbortController | null>(null),
    limit = useRef<ReturnType<typeof setTimeout> | null>(null),
    ticker = useRef<ReturnType<typeof setInterval> | null>(null),
    lock = useRef(false),
    live = useRef(true);
  function release() {
    if (limit.current) clearTimeout(limit.current);
    if (ticker.current) clearInterval(ticker.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      requestRef.current?.abort();
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state === "recording") recorder.current.stop();
      }
      release();
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const c = new AbortController();
    void request("/manage/property-dictation/capabilities", {
      signal: c.signal,
    })
      .then((r) => {
        if (!c.signal.aborted) setEnabled(r.enabled);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [open]);
  function close() {
    generation.current++;
    requestRef.current?.abort();
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state === "recording") recorder.current.stop();
    }
    release();
    setOpen(false);
    setVideoMode(false);
    setVideoId("");
    setPhase("intro");
    setAudio(null);
    setDraft(null);
    setTranscript("");
    setError("");
  }
  async function start() {
    if (lock.current) return;
    lock.current = true;
    const run = generation.current;
    setError("");
    setPhase("starting");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw Error(
          "Este navegador no permite grabar audio. Puedes escribir la descripción para interpretarla.",
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!live.current || run !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mime = ["audio/webm", "audio/mp4"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const record = new MediaRecorder(
        media,
        mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined,
      );
      recorder.current = record;
      const chunks: Blob[] = [];
      record.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      record.onstop = () => {
        release();
        if (!live.current) return;
        setAudio(new Blob(chunks, { type: record.mimeType }));
        setPhase("ready");
      };
      record.onerror = () => {
        release();
        if (live.current) {
          setError("La grabación se interrumpió. Intenta de nuevo.");
          setPhase("intro");
        }
      };
      setAudio(null);
      setDraft(null);
      setTranscript("");
      setSeconds(0);
      record.start();
      setPhase("recording");
      const began = Date.now();
      ticker.current = setInterval(
        () =>
          setSeconds(Math.min(180, Math.floor((Date.now() - began) / 1000))),
        500,
      );
      limit.current = setTimeout(() => {
        if (record.state === "recording") record.stop();
      }, 180000);
    } catch (e) {
      release();
      if (live.current) {
        setError((e as Error).message);
        setPhase("intro");
      }
    } finally {
      lock.current = false;
    }
  }
  async function interpret(recorded: boolean, fromVideo = false) {
    if (lock.current) return;
    lock.current = true;
    setPhase("processing");
    setError("");
    const c = new AbortController();
    requestRef.current = c;
    try {
      let body: FormData | string;
      if (fromVideo) {
        if (!videoId) throw Error("Selecciona un video propio.");
        body = JSON.stringify({ video_id: videoId });
      } else if (recorded) {
        if (!audio) throw Error("Graba primero una descripción.");
        if (audio.size > 12 * 1024 * 1024)
          throw Error("El audio supera 12 MB.");
        const fd = new FormData();
        fd.append(
          "file",
          audio,
          audio.type.includes("mp4") ? "propiedad.m4a" : "propiedad.webm",
        );
        body = fd;
      } else body = JSON.stringify({ transcript });
      const result = await request("/manage/property-dictation", {
        method: "POST",
        body,
        signal: c.signal,
      });
      if (c.signal.aborted || !live.current) return;
      if (!result.fields || !Array.isArray(result.warnings))
        throw Error("No se pudo leer la propuesta.");
      setDraft(result);
      setTranscript(result.transcript);
      setSelected(
        Object.keys(result.fields).filter((k) =>
          Object.prototype.hasOwnProperty.call(labels, k),
        ),
      );
      setAudio(null);
      setPhase("review");
    } catch (e) {
      if (!c.signal.aborted && live.current) {
        setError((e as Error).message);
        setPhase("ready");
      }
    } finally {
      lock.current = false;
    }
  }
  function toggle(key: string) {
    setSelected((old) => toggleDictationField(old, key, draft?.fields || {}));
  }
  function display(key: string, value: unknown) {
    if (key === "type_id")
      return (
        catalog.types.find((x: any) => String(x.id) === String(value))?.name ||
        String(value)
      );
    if (key === "region_id")
      return (
        catalog.regions.find((x: any) => String(x.id) === String(value))
          ?.name || String(value)
      );
    if (key === "commune_id")
      return (
        catalog.communes.find((x: any) => String(x.id) === String(value))
          ?.name || String(value)
      );
    if (key === "operation_type")
      return value === "rent" ? "Arriendo" : "Venta";
    if (key === "price_amount" && draft?.fields.price_unit === "CLP")
      return Number(value).toLocaleString("es-CL");
    return dictationEnumLabel(key, String(value));
  }
  const busy = phase === "starting" || phase === "processing";
  return (
    <>
      <button
        type="button"
        className="button secondary"
        onClick={() => setOpen(true)}
      >
        🎙 Dictar propiedad
      </button>
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          setVideoMode(true);
          setOpen(true);
          void loadVideos(1);
        }}
      >
        Usar audio del video
      </button>
      {open &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "#06295199",
              display: "grid",
              placeItems: "center",
              padding: 16,
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="dictation-title"
              style={{
                background: "#fff",
                color: "#123b70",
                borderRadius: 20,
                padding: 24,
                width: "min(700px,100%)",
                maxHeight: "90dvh",
                overflowY: "auto",
                display: "grid",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h2 id="dictation-title">
                  {videoMode ? "Usar audio del video" : "Dictar propiedad"}
                </h2>
                <button
                  type="button"
                  aria-label="Cerrar dictado"
                  onClick={close}
                >
                  ✕
                </button>
              </div>
              <p>
                El audio y la descripción se envían a OpenAI. Dicta hasta 3
                minutos. La IA propondrá datos para revisar: no guarda ni
                publica la propiedad automáticamente.
              </p>
              {videoMode && !busy && !draft && phase !== "recording" && (
                <>
                  <p>
                    Selecciona uno de tus videos cargados. Solo su audio se
                    enviará a OpenAI. Revisa la transcripción y los datos antes
                    de aplicar; no se guarda ni se enlaza automáticamente.
                  </p>
                  <label>
                    Video cargado
                    <select
                      value={videoId}
                      onChange={(e) => {
                        setVideoId(e.target.value);
                        setDraft(null);
                        setSelected([]);
                        setTranscript("");
                      }}
                    >
                      <option value="">Seleccionar video</option>
                      {videos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title} ·{" "}
                          {v.status === "published" ? "Publicado" : "Borrador"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {loadingVideos && <p role="status">Cargando tus videos…</p>}
                  {!loadingVideos && !videos.length && (
                    <p>
                      No hay videos disponibles. Puedes grabar un dictado o
                      escribir los datos.
                    </p>
                  )}
                  {moreVideos && (
                    <button
                      type="button"
                      disabled={loadingVideos}
                      onClick={() => void loadVideos(videoPage + 1)}
                    >
                      Cargar más videos
                    </button>
                  )}
                  <button
                    type="button"
                    className="button"
                    disabled={enabled !== true || !videoId || loadingVideos}
                    onClick={() => void interpret(false, true)}
                  >
                    Extraer audio y proponer datos
                  </button>
                </>
              )}
              {enabled === false && (
                <p role="status">
                  El dictado con IA todavía no está configurado.
                </p>
              )}
              {error && (
                <p role="alert" style={{ color: "#a12b36" }}>
                  {error}
                </p>
              )}
              {busy ? (
                <p role="status">
                  {phase === "starting"
                    ? "Preparando micrófono…"
                    : "Interpretando la descripción…"}
                </p>
              ) : phase === "recording" ? (
                <>
                  <strong>● Grabando · {seconds} / 180 s</strong>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      if (recorder.current?.state === "recording")
                        recorder.current.stop();
                    }}
                  >
                    Terminar grabación
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="button secondary"
                  disabled={enabled !== true}
                  onClick={() => void start()}
                >
                  {phase === "intro" ? "Comenzar dictado" : "Grabar de nuevo"}
                </button>
              )}
              {audio && !busy && (
                <button
                  type="button"
                  className="button"
                  disabled={!enabled}
                  onClick={() => void interpret(true)}
                >
                  Interpretar grabación
                </button>
              )}
              {phase !== "recording" && (
                <>
                  <label>
                    Descripción o transcripción · puedes corregirla
                    <textarea
                      rows={5}
                      value={transcript}
                      disabled={busy}
                      maxLength={12000}
                      onChange={(e) => {
                        setTranscript(e.target.value);
                        setDraft(null);
                        setSelected([]);
                      }}
                      placeholder="Ejemplo: vendo casa en Puerto Varas por 150 millones de pesos…"
                    />
                  </label>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || !enabled || transcript.trim().length < 8}
                    onClick={() => void interpret(false)}
                  >
                    Interpretar este texto
                  </button>
                </>
              )}
              {draft && !busy && (
                <>
                  <h3>Revisa los datos propuestos</h3>
                  <p>
                    Selecciona qué aplicar. Los campos indicados reemplazarán
                    los valores actuales.
                  </p>
                  {draft.warnings.map((w, i) => (
                    <p key={i} style={{ background: "#fff6df", padding: 10 }}>
                      {w}
                    </p>
                  ))}
                  {Object.entries(draft.fields)
                    .filter(([key]) =>
                      Object.prototype.hasOwnProperty.call(labels, key),
                    )
                    .map(([key, value]) => (
                      <label
                        key={key}
                        style={{
                          border: "1px solid #c9def4",
                          borderRadius: 12,
                          padding: 12,
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <span>
                          <input
                            type="checkbox"
                            checked={selected.includes(key)}
                            onChange={() => toggle(key)}
                          />{" "}
                          {labels[key]}
                        </span>
                        <span>{display(key, value)}</span>
                        {form[key] != null &&
                          String(form[key]) !== value &&
                          String(form[key]) !== "" && (
                            <small>
                              Reemplazará: {display(key, form[key])}
                            </small>
                          )}
                      </label>
                    ))}
                  <button
                    type="button"
                    className="button"
                    disabled={!selected.length}
                    onClick={() => {
                      const patch = dictatedPatch(
                        form,
                        draft.fields,
                        selected,
                        catalog.amenities || [],
                      );
                      onApply(patch);
                      close();
                    }}
                  >
                    Aplicar al formulario
                  </button>
                </>
              )}
              <button
                type="button"
                className="button secondary"
                onClick={close}
              >
                {busy ? "Cancelar procesamiento" : "Volver sin aplicar"}
              </button>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
