"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { assetUrl } from "@/lib/estate-api";
import { designStyle, type HeroCopy, type SiteDesign } from "@/lib/site-design";
import { HeroMedia } from "./HeroMedia";

export function VisualHeroEditor({
  design,
  fallback,
  selectedId,
  onSelect,
  update,
  ready,
  busy,
  onReplace,
  onReplaceUpload,
}: {
  design: SiteDesign;
  fallback: HeroCopy;
  selectedId?: string;
  onSelect: (id: string) => void;
  update: (key: keyof SiteDesign, value: unknown) => void;
  ready: boolean;
  busy: boolean;
  onReplace: (button: HTMLButtonElement) => void;
  onReplaceUpload: (files: File[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
  }, [expanded]);
  const slider = design.hero_mode === "slider";
  const slide = slider
    ? design.hero_slides?.find((s) => s.media_id === selectedId) ||
      design.hero_slides?.[0]
    : undefined;
  const common = design.hero_copy ?? fallback;
  const copy = slide?.copy ?? common;
  const canReplace = slider ? !!slide : !!design.hero_media_id;
  function change(key: keyof HeroCopy, value: string) {
    const next = { ...copy, [key]: value };
    if (slide?.copy)
      update(
        "hero_slides",
        design.hero_slides!.map((s) =>
          s.media_id === slide.media_id ? { ...s, copy: next } : s,
        ),
      );
    else update("hero_copy", next);
  }
  function content(large: boolean) {
    return (
      <div
        className="visual-hero-editor"
        data-design-panel="hero"
        style={designStyle(design)}
      >
        <div className="visual-hero-toolbar">
          <div>
            <h3>Escribe directamente sobre la imagen</h3>
            <p>
              {slide
                ? `Foto ${(design.hero_slides || []).findIndex((s) => s.media_id === slide.media_id) + 1} de ${design.hero_slides?.length}`
                : "Imagen de portada"}{" "}
              · Borrador sin publicar
            </p>
          </div>
          <button
            type="button"
            className="button outline small"
            onClick={() => {
              if (large) {
                dialog.current?.close();
                setExpanded(false);
              } else setExpanded(true);
            }}
          >
            {large ? <X size={16} /> : <Maximize2 size={16} />}
            {large ? "Cerrar editor ampliado" : "Ampliar editor"}
          </button>
        </div>
        {!ready && (
          <p className="notice">
            La edición de textos estará disponible al terminar la actualización.
            Recarga en unos minutos.
          </p>
        )}
        {slider && !slide ? (
          <p className="notice">
            Agrega una foto para comenzar a editar sobre ella.
          </p>
        ) : (
          <>
            <fieldset disabled={!ready || busy} className="visual-hero-fields">
              {slide && (
                <label className="design-checkbox">
                  <input
                    type="checkbox"
                    checked={!!slide.copy}
                    onChange={(e) =>
                      update(
                        "hero_slides",
                        design.hero_slides!.map((s) =>
                          s.media_id === slide.media_id
                            ? {
                                ...s,
                                copy: e.target.checked ? { ...common } : null,
                              }
                            : s,
                        ),
                      )
                    }
                  />
                  Usar textos propios para esta foto
                </label>
              )}
              <p className="visual-hero-scope">
                {slide?.copy
                  ? "Editas solo esta foto. Las demás conservan sus textos."
                  : "Editas el texto compartido por las fotos sin texto propio."}
              </p>
              {!slide?.copy && design.hero_copy && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => update("hero_copy", null)}
                >
                  Restaurar texto compartido original
                </button>
              )}
              <div className="slider-live-stage visual-hero-stage">
                <HeroMedia
                  preview
                  design={design}
                  selectedMediaId={slide?.media_id}
                  onSelectMedia={onSelect}
                  renderCopy={() => (
                    <div className="visual-hero-copy">
                      <label>
                        <span>Título</span>
                        <textarea
                          aria-label="Título sobre la imagen"
                          required
                          maxLength={180}
                          rows={3}
                          value={copy.title}
                          onChange={(e) => change("title", e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Descripción</span>
                        <textarea
                          aria-label="Descripción sobre la imagen"
                          maxLength={400}
                          rows={3}
                          value={copy.subtitle}
                          placeholder="Escribe una descripción o déjala vacía"
                          onChange={(e) => change("subtitle", e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                />
              </div>
              <small>
                {copy.title.length}/180 caracteres en el título ·{" "}
                {copy.subtitle.length}/400 en la descripción. Las fotos no
                avanzan solas mientras editas.
              </small>
            </fieldset>
            {canReplace && (
              <div className="visual-hero-image-actions">
                <button
                  type="button"
                  className="button outline small"
                  disabled={busy}
                  onClick={(e) => {
                    if (large) {
                      dialog.current?.close();
                      setExpanded(false);
                    }
                    onReplace(e.currentTarget);
                  }}
                >
                  Cambiar foto desde biblioteca
                </button>
                <label className="button outline small">
                  Cambiar foto desde mi equipo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Reemplazar la foto seleccionada"
                    disabled={busy}
                    onChange={(e) => {
                      onReplaceUpload(Array.from(e.target.files || []));
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}
          </>
        )}
        {slider && !!design.hero_slides?.length && (
          <div
            className="slider-live-thumbnails"
            role="group"
            aria-label="Seleccionar foto para editar"
          >
            {design.hero_slides.map((s, i) => (
              <button
                key={s.media_id}
                type="button"
                aria-label={`Editar foto ${i + 1}`}
                aria-pressed={s.media_id === slide?.media_id}
                onClick={() => onSelect(s.media_id)}
              >
                <img
                  src={assetUrl(s.url || `/api/media/${s.media_id}`)}
                  alt=""
                />
                <span>
                  {i + 1}
                  {s.copy ? " · Texto propio" : " · Compartido"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      {content(false)}
      {expanded && (
        <dialog
          ref={dialog}
          className="visual-hero-dialog"
          aria-label="Editor ampliado de portada"
          onCancel={() => setExpanded(false)}
          onClose={() => setExpanded(false)}
        >
          {content(true)}
        </dialog>
      )}
    </>
  );
}
