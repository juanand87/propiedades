"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowUpRight,
  Bath,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  House,
  Maximize2,
  Share2,
} from "lucide-react";
import { assetUrl, labels, price, request } from "@/lib/estate-api";
import { FavoriteButton, useEstate } from "./EstateApp";

function FeedCard({
  p,
  index,
  active,
  onShare,
}: {
  p: any;
  index: number;
  active: boolean;
  onShare: (p: any) => void;
}) {
  const [photo, setPhoto] = useState(0);
  const media = p.media?.length
    ? p.media
    : [{ url: "/architecture.svg", alt_text: p.title }];
  const current = photo % media.length;
  return (
    <article
      className="feed-card"
      data-feed-index={index}
      aria-label={`Propiedad ${index + 1}: ${p.title}`}
    >
      {p._video ? (
        <FeedVideo
          url={p._video.url}
          active={active}
          title={p._video.title}
          poster={assetUrl(media[0].url)}
        />
      ) : (
        <img
          className="feed-photo"
          src={assetUrl(media[current].url)}
          alt={media[current].alt_text || p.title}
          loading={active ? "eager" : "lazy"}
          fetchPriority={active ? "high" : "auto"}
        />
      )}
      <div className="feed-photo-progress" aria-hidden="true">
        {!p._video &&
          media.map((m: any, i: number) => (
            <i key={m.id || i} className={i === current ? "active" : ""} />
          ))}
      </div>
      <div className="feed-card-top">
        <span>
          {p.is_demo
            ? "Ejemplo · Datos ficticios"
            : labels[p.type_id] || p.type_id}
        </span>
        <span>
          {p._video
            ? "Video · " + Math.round((p._video.duration_ms || 0) / 1000) + " s"
            : `${current + 1}/${media.length} fotos`}
        </span>
      </div>
      {!p._video && media.length > 1 && (
        <div className="feed-photo-arrows">
          <button
            type="button"
            aria-label={`Foto anterior de ${p.title}`}
            onClick={() =>
              setPhoto((current - 1 + media.length) % media.length)
            }
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            aria-label={`Foto siguiente de ${p.title}`}
            onClick={() => setPhoto((current + 1) % media.length)}
          >
            <ChevronRight />
          </button>
        </div>
      )}
      <div className="feed-actions">
        <FavoriteButton id={p.property_id || p.id} />
        <button
          type="button"
          aria-label={`Compartir ${p.title}`}
          onClick={() => onShare(p)}
        >
          <Share2 size={22} />
        </button>
      </div>
      <div className="feed-copy">
        <span className="feed-location">
          {[p.commune_name, p.region_name].filter(Boolean).join(" · ")}
        </span>
        <strong className="feed-price">
          {price(p.price_amount, p.price_unit)}
        </strong>
        <h2>{p.title}</h2>
        <div className="feed-metrics">
          {p.bedrooms != null && (
            <span>
              <BedDouble size={17} />
              {p.bedrooms} dorm.
            </span>
          )}
          {p.bathrooms != null && (
            <span>
              <Bath size={17} />
              {p.bathrooms} baños
            </span>
          )}
          <span>
            <Maximize2 size={17} />
            {Number(p.built_area || p.land_area || 0).toLocaleString(
              "es-CL",
            )}{" "}
            m²
          </span>
        </div>
        <p>{p.advertiser?.name}</p>
        {p._video && <p>{p._video.title}</p>}
        <Link className="feed-detail" href={`/propiedades/${p.slug}`}>
          {p.is_demo ? "Ver ficha de ejemplo" : "Ver detalles y consultar"}
          <ArrowUpRight size={18} />
        </Link>
        {p.is_demo && (
          <small>Publicación ilustrativa, no es una oferta real.</small>
        )}
      </div>
    </article>
  );
}

function FeedVideo({
  url,
  active,
  title,
  poster,
}: {
  url: string;
  active: boolean;
  title: string;
  poster: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(true),
    [error, setError] = useState(false);
  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    const sync = () => {
      if (active && !paused && !document.hidden) {
        void player.play().catch(() => {});
      } else player.pause();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      player.pause();
    };
  }, [active, paused]);
  return (
    <>
      <video
        ref={ref}
        className="feed-photo"
        src={active ? assetUrl(url) : undefined}
        poster={poster}
        muted={muted}
        playsInline
        loop
        preload="none"
        aria-label={title}
        onError={() => setError(true)}
        onCanPlay={() => setError(false)}
      />
      <div className="feed-video-controls">
        <button
          type="button"
          onClick={() => setPaused((v) => !v)}
          aria-label={paused ? "Reproducir video" : "Pausar video"}
        >
          {paused ? "Reproducir" : "Pausar"}
        </button>
        <button type="button" onClick={() => setMuted((v) => !v)}>
          {muted ? "Activar sonido" : "Silenciar"}
        </button>
        {error && (
          <button
            type="button"
            onClick={() => {
              setError(false);
              setPaused(false);
              ref.current?.load();
              void ref.current?.play().catch(() => {});
            }}
          >
            Reintentar video
          </button>
        )}
      </div>
    </>
  );
}

export function PropertyFeed() {
  const { catalog, user, settings } = useEstate();
  const root = useRef<HTMLDivElement>(null),
    end = useRef<HTMLDivElement>(null),
    generation = useRef(0),
    pending = useRef(false);
  const [items, setItems] = useState<any[]>([]),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(0),
    [total, setTotal] = useState(0),
    [active, setActive] = useState(0),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [type, setType] = useState(""),
    [mode, setMode] = useState<"photos" | "videos">("photos"),
    [videosEnabled, setVideosEnabled] = useState(false);
  useEffect(() => {
    let current = true;
    void request("/videos/capabilities")
      .then((r) => {
        if (current) setVideosEnabled(r.enabled === true);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);
  const load = useCallback(
    async (next: number, reset = false) => {
      if (pending.current && !reset) return;
      const run = generation.current;
      pending.current = true;
      setBusy(true);
      setError("");
      try {
        const r = await request(
          `${mode === "videos" ? "/videos" : "/properties?limit=6&sort=recent"}${mode === "videos" ? "?" : "&"}page=${next}${type ? `&type_id=${encodeURIComponent(type)}` : ""}`,
        );
        if (mode === "videos")
          r.items = r.items.map((v: any) => ({
            ...v.property,
            id: v.id,
            property_id: v.property_id,
            _video: v,
          }));
        if (run !== generation.current) return;
        setItems((old) =>
          reset
            ? r.items
            : [
                ...old,
                ...r.items.filter((p: any) => !old.some((x) => x.id === p.id)),
              ],
        );
        setPage(r.page);
        setPages(r.pages);
        setTotal(r.total);
      } catch (e) {
        if (run === generation.current) setError((e as Error).message);
      } finally {
        if (run === generation.current) {
          pending.current = false;
          setBusy(false);
        }
      }
    },
    [type, mode],
  );
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    invalidate();
    pending.current = false;
    setItems([]);
    setPage(0);
    setPages(0);
    setActive(0);
    root.current?.scrollTo({ top: 0 });
    void load(1, true);
    return invalidate;
  }, [load, invalidate]);
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);
  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting)
            setActive(Number((e.target as HTMLElement).dataset.feedIndex));
      },
      { root: root.current, threshold: 0.6 },
    );
    root.current
      .querySelectorAll("[data-feed-index]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);
  useEffect(() => {
    if (!end.current || !root.current || busy || page >= pages || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void load(page + 1);
      },
      { root: root.current, rootMargin: "500px 0px" },
    );
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [busy, page, pages, items.length, error, load]);
  function go(index: number) {
    if (index < 0) return;
    const scroll = () => {
      const el = root.current?.querySelector<HTMLElement>(
        `[data-feed-index="${index}"]`,
      );
      el?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    };
    if (index < items.length) scroll();
    else if (page < pages)
      void load(page + 1).then(() => requestAnimationFrame(scroll));
  }
  async function share(p: any) {
    const url = new URL(`/propiedades/${p.slug}`, location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: p.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage("Enlace copiado.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setMessage(
          "No se pudo compartir. Puedes abrir la ficha y copiar su dirección.",
        );
    }
  }
  return (
    <main className="property-feed">
      <header className="feed-header">
        <Link className="feed-brand" href="/" aria-label="Volver al inicio">
          <House size={24} />
          <span>{settings.site_name}</span>
        </Link>
        <div>
          <strong>Descubrir</strong>
          <span>Un lugar nuevo en cada scroll</span>
        </div>
        <label className="feed-filter">
          <span>Tipo de propiedad</span>
          <select
            aria-label="Tipo de propiedad"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Todas las propiedades</option>
            {catalog.types
              ?.filter((t: any) => t.active !== 0)
              .map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <div
          className="feed-mode"
          role="group"
          aria-label="Contenido del recorrido"
        >
          <button
            type="button"
            aria-pressed={mode === "photos"}
            onClick={() => setMode("photos")}
          >
            Fotos
          </button>
          <button
            type="button"
            disabled={!videosEnabled}
            title={
              videosEnabled
                ? "Ver recorridos en video"
                : "Videos pendientes de activación en el backend"
            }
            aria-pressed={mode === "videos"}
            onClick={() => setMode("videos")}
          >
            Videos
          </button>
        </div>
        <Link className="feed-list-link" href="/propiedades">
          <ArrowLeft size={16} />
          Ver listado
        </Link>
      </header>
      <div className="feed-shell">
        <div
          ref={root}
          className="property-feed-stage"
          role="region"
          aria-label="Recorrido vertical de propiedades"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.target as HTMLElement).closest("input,select,textarea"))
              return;
            if (
              [
                "ArrowDown",
                "PageDown",
                "ArrowUp",
                "PageUp",
                "Home",
                "End",
              ].includes(e.key)
            ) {
              e.preventDefault();
              go(
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? items.length - 1
                    : active + (["ArrowUp", "PageUp"].includes(e.key) ? -1 : 1),
              );
            }
          }}
        >
          {items.map((p, i) => (
            <FeedCard
              key={p.id}
              p={p}
              index={i}
              active={i === active}
              onShare={(p) => void share(p)}
            />
          ))}
          {!items.length && !busy && !error && (
            <section className="feed-empty">
              <House size={45} />
              <h1>Aquí comienza tu próximo lugar</h1>
              <p>
                {mode === "videos"
                  ? "Todavía no hay videos publicados para este filtro."
                  : "Todavía no hay propiedades publicadas para este filtro."}
              </p>
              <Link href="/propiedades">Explorar el listado</Link>
              {user?.role === "admin" && (
                <Link href="/panel/ejemplos">
                  Instalar propiedades de ejemplo
                </Link>
              )}
            </section>
          )}
          <div ref={end} className="feed-end">
            {busy ? (
              <p role="status">Cargando propiedades…</p>
            ) : error ? (
              <>
                <p role="alert">{error}</p>
                <button
                  type="button"
                  onClick={() => void load(page ? page + 1 : 1, !page)}
                >
                  Reintentar
                </button>
              </>
            ) : items.length > 0 && page >= pages ? (
              <>
                <p>Has visto todas las propiedades de este recorrido.</p>
                <button type="button" onClick={() => go(0)}>
                  Volver al inicio
                </button>
              </>
            ) : null}
          </div>
        </div>
        <nav className="feed-scroll-controls" aria-label="Cambiar de propiedad">
          <button
            type="button"
            aria-label="Propiedad anterior"
            disabled={active === 0}
            onClick={() => go(active - 1)}
          >
            <ArrowUp />
          </button>
          <span role="status">
            {items.length ? active + 1 : 0} / {total}
          </span>
          <button
            type="button"
            aria-label="Propiedad siguiente"
            disabled={
              busy ||
              !items.length ||
              (active === items.length - 1 && page >= pages)
            }
            onClick={() => go(active + 1)}
          >
            <ArrowDown />
          </button>
        </nav>
      </div>
      <div className="feed-hint" aria-live="polite">
        {message ||
          "Desliza hacia arriba o abajo · Usa las flechas para recorrer"}
      </div>
    </main>
  );
}
