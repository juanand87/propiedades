"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { assetUrl } from "@/lib/estate-api";
import type { SiteDesign } from "@/lib/site-design";

export function HeroMedia({
  design,
  preview = false,
  selectedMediaId,
  onSelectMedia,
}: {
  design: SiteDesign;
  preview?: boolean;
  selectedMediaId?: string;
  onSelectMedia?: (id: string) => void;
}) {
  const slides =
    design.hero_mode === "slider" &&
    (design.hero_slides?.length || 0) >= (preview ? 1 : 2)
      ? design.hero_slides!.map((s) => ({
          id: s.media_id,
          url: s.url || `/api/media/${s.media_id}`,
          alt: s.alt_text,
        }))
      : [
          {
            id: design.hero_media_id || "ambientacion",
            url: design.hero_url || "/hero-ambientacion.webp",
            alt: design.hero_url
              ? design.hero_alt
              : "Imagen de ambientación: terraza contemporánea con vista hacia la ciudad y la cordillera",
          },
        ];
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [hover, setHover] = useState(false),
    [focused, setFocused] = useState(false);
  const active = selectedMediaId
    ? Math.max(
        0,
        slides.findIndex((slide) => slide.id === selectedMediaId),
      )
    : index % slides.length;
  function showSlide(next: number) {
    const position = (next + slides.length) % slides.length;
    if (onSelectMedia) onSelectMedia(slides[position].id);
    else setIndex(position);
  }
  const interval = design.hero_interval || 6;
  const signature = slides.map((s) => s.id).join(",");
  useEffect(() => {
    if (
      preview ||
      slides.length < 2 ||
      !design.hero_autoplay ||
      paused ||
      hover ||
      focused
    )
      return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      if (timer) clearInterval(timer);
      if (!reduced.matches && document.visibilityState === "visible")
        timer = setInterval(() => setIndex((i) => i + 1), interval * 1000);
    };
    sync();
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      if (timer) clearInterval(timer);
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [
    signature,
    slides.length,
    interval,
    design.hero_autoplay,
    paused,
    hover,
    focused,
    preview,
  ]);
  return (
    <div
      className={`hero-media${preview ? " hero-media-preview" : ""}`}
      role="region"
      aria-roledescription={slides.length > 1 ? "carrusel" : undefined}
      aria-label={slides.length > 1 ? "Slider de portada" : "Imagen de portada"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <img
        key={slides[active].id}
        className="hero-media-image"
        src={assetUrl(slides[active].url)}
        alt={slides[active].alt}
        fetchPriority={active === 0 ? "high" : "auto"}
      />
      {!design.hero_url && design.hero_mode !== "slider" && !preview && (
        <span className="ambient-caption">Imagen de ambientación</span>
      )}
      {slides.length > 1 && (
        <div className="hero-media-controls">
          <button
            type="button"
            aria-label="Imagen anterior"
            onClick={() => showSlide(active - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="hero-media-dots">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Ver imagen ${i + 1}`}
                aria-pressed={i === active}
                className={i === active ? "active" : ""}
                onClick={() => showSlide(i)}
              />
            ))}
          </div>
          <span className="hero-media-count">
            {active + 1} / {slides.length}
          </span>
          <button
            type="button"
            aria-label="Imagen siguiente"
            onClick={() => showSlide(active + 1)}
          >
            <ChevronRight size={18} />
          </button>
          {design.hero_autoplay && !preview && (
            <button
              type="button"
              aria-label={paused ? "Reanudar slider" : "Pausar slider"}
              aria-pressed={paused}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
