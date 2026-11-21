"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { assetUrl, request } from "@/lib/estate-api";

type PublicVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail_url?: string;
  hls_url?: string | null;
};
type VideoPage = { items: PublicVideo[]; pages: number; page: number };

function PropertyPlayer({ video }: { video: PublicVideo }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    // Safari can use HLS natively. Other browsers stream the MP4 with ranges.
    if (video.hls_url && player.canPlayType("application/vnd.apple.mpegurl"))
      player.src = assetUrl(video.hls_url);
  }, [video]);
  return (
    <>
      <video
        ref={ref}
        className="property-public-video"
        src={assetUrl(video.url)}
        poster={video.thumbnail_url ? assetUrl(video.thumbnail_url) : undefined}
        controls
        playsInline
        preload="metadata"
        aria-label={video.title || "Video de la propiedad"}
        onCanPlay={() => setError(false)}
        onError={() => {
          const player = ref.current;
          if (
            player &&
            player.src !==
              new URL(assetUrl(video.url), window.location.href).href
          ) {
            player.src = assetUrl(video.url);
            player.load();
          } else setError(true);
        }}
      />
      {error && (
        <div role="status">
          <p>No pudimos reproducir el video.</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setError(false);
              ref.current?.load();
            }}
          >
            Reintentar video
          </button>
        </div>
      )}
    </>
  );
}

export function PropertyPublicVideos({ propertyId }: { propertyId: string }) {
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request(`/properties/${encodeURIComponent(propertyId)}/videos`, {
      signal: controller.signal,
    })
      .then((data: VideoPage) => {
        setVideos(data.items);
        setPage(data.page);
        setPages(data.pages);
        setError("");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("No pudimos cargar los videos de esta propiedad.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [propertyId, retry]);
  if (!loading && !error && !videos.length) return null;
  return (
    <section
      className="property-public-videos"
      aria-label="Videos de la propiedad"
    >
      <h2>
        <Play size={22} aria-hidden="true" /> Videos de la propiedad
      </h2>
      {loading && !videos.length && <p role="status">Cargando videos…</p>}
      {error && (
        <div role="status">
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setLoading(true);
              setRetry((n) => n + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      {videos[selected] && (
        <>
          <PropertyPlayer key={videos[selected].id} video={videos[selected]} />
          <p>{videos[selected].title}</p>
          {videos.length > 1 && (
            <div className="property-video-choices" aria-label="Elegir video">
              {videos.map((video, i) => (
                <button
                  type="button"
                  key={video.id}
                  className={i === selected ? "button" : "button secondary"}
                  aria-pressed={i === selected}
                  onClick={() => setSelected(i)}
                >
                  <Play size={16} aria-hidden="true" /> Video {i + 1}
                </button>
              ))}
            </div>
          )}
          {page < pages && (
            <button
              type="button"
              className="button secondary"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError("");
                try {
                  const data = (await request(
                    `/properties/${encodeURIComponent(propertyId)}/videos?page=${page + 1}`,
                  )) as VideoPage;
                  setVideos((current) => [
                    ...current,
                    ...data.items.filter(
                      (v) => !current.some((old) => old.id === v.id),
                    ),
                  ]);
                  setPage(data.page);
                  setPages(data.pages);
                } catch {
                  setError("No pudimos cargar más videos.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Cargando…" : "Ver más videos"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
