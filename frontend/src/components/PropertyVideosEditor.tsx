"use client";

import { useEffect, useState } from "react";
import { assetUrl, request, send } from "@/lib/estate-api";

type ManagedVideo = {
  id: string;
  title: string;
  status: "draft" | "published";
  duration_ms: number | null;
};

export function PropertyVideosEditor({ propertyId }: { propertyId?: string }) {
  const [videos, setVideos] = useState<ManagedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(
    null,
  );
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      setVideos([]);
      setPreview(null);
      try {
        const capabilities = await request("/videos/capabilities");
        if (!active) return;
        setEnabled(capabilities.enabled === true);
        if (capabilities.enabled && propertyId) {
          const rows = await request(`/manage/properties/${propertyId}/videos`);
          if (active) setVideos(rows);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [propertyId, revision]);

  async function openPreview(video: ManagedVideo) {
    setBusy(video.id);
    setError("");
    setPreview(null);
    try {
      const result = await request(`/manage/videos/${video.id}/preview`);
      setPreview({ id: video.id, url: assetUrl(result.url) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(video: ManagedVideo) {
    const status = video.status === "published" ? "draft" : "published";
    setBusy(video.id);
    setError("");
    setMessage("");
    try {
      await send(`/manage/videos/${video.id}`, { status }, "PATCH");
      // Read back the persisted status instead of assuming the update succeeded.
      setVideos(await request(`/manage/properties/${propertyId}/videos`));
      setMessage(
        status === "published"
          ? "Video publicado."
          : "Video guardado como borrador.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="panel-card property-videos-editor"
      aria-labelledby="property-videos-heading"
    >
      <div className="section-heading">
        <h2 id="property-videos-heading">06 · Videos</h2>
        {propertyId && (
          <button
            type="button"
            className="button secondary"
            disabled={loading || busy !== null}
            onClick={() => setRevision((n) => n + 1)}
          >
            Actualizar videos
          </button>
        )}
      </div>
      <p>
        Revisa los videos grabados desde Android y elige cuáles publicar. Para
        publicarlos, la propiedad debe estar publicada y el anunciante aprobado
        y activo.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {!propertyId ? (
        <p>Guarda primero la propiedad para ver sus videos.</p>
      ) : loading ? (
        <p role="status">Cargando videos…</p>
      ) : !enabled ? (
        <p>Los videos todavía no están habilitados en este servidor.</p>
      ) : !error && videos.length === 0 ? (
        <p>
          Esta propiedad todavía no tiene videos. Puedes grabarlos o subirlos
          desde Android.
        </p>
      ) : null}
      <div className="property-video-list">
        {videos.map((video) => (
          <article key={video.id} className="property-video-card">
            <h3>{video.title}</h3>
            <p>
              <span className="status-badge">
                {video.status === "published" ? "Publicado" : "Borrador"}
              </span>
              {video.duration_ms
                ? ` · ${Math.round(video.duration_ms / 1000)} s`
                : ""}
            </p>
            {preview?.id === video.id && (
              <video
                key={preview.url}
                src={preview.url}
                controls
                playsInline
                autoPlay
                preload="metadata"
                aria-label={`Vista previa: ${video.title}`}
                onError={() =>
                  setError(
                    "No se pudo reproducir el video. Pulsa Ver video para renovar la vista previa.",
                  )
                }
              />
            )}
            <div className="button-row">
              <button
                type="button"
                className="button secondary"
                disabled={busy !== null}
                onClick={() => void openPreview(video)}
              >
                Ver video
              </button>
              <button
                type="button"
                className="button"
                disabled={busy !== null}
                onClick={() => void changeStatus(video)}
              >
                {busy === video.id
                  ? "Procesando…"
                  : video.status === "published"
                    ? "Dejar como borrador"
                    : "Publicar video"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
