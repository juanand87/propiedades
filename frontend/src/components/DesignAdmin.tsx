"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  House,
  Palette,
  RotateCcw,
  Save,
} from "lucide-react";
import { assetUrl, request, send } from "@/lib/estate-api";
import {
  defaultDesign,
  designStyle,
  sectionNames as marketplaceSectionNames,
  brokerSectionNames,
  defaultBrokerDesign,
  SiteDesign,
  colorThemes,
} from "@/lib/site-design";
import { Notice, useEstate } from "./EstateApp";
import { HeroMedia } from "./HeroMedia";

type ImageSlot = "logo_media_id" | "hero_media_id" | "hero_slides";

const colors = [
  ["primary_color", "Color principal", "Botones, enlaces y bloques destacados"],
  ["accent_color", "Color de acento", "Detalles y elementos decorativos"],
  ["background_color", "Fondo del sitio", "Fondo general de las páginas"],
  ["text_color", "Color del texto", "Títulos y contenido principal"],
] as const;

export function DesignAdmin({ broker = false }: { broker?: boolean }) {
  const { settings, reload } = useEstate();
  const endpoint = broker ? "/me/site" : "/settings";
  const sectionNames = broker ? brokerSectionNames : marketplaceSectionNames;
  const [siteInfo, setSiteInfo] = useState<any>(null);
  const displaySettings = broker ? siteInfo || settings : settings;
  const makeDefault = () =>
    broker
      ? defaultBrokerDesign({ display_name: siteInfo?.site_name })
      : defaultDesign();
  const [draft, setDraft] = useState<SiteDesign | null>(null);
  const [baseline, setBaseline] = useState("");
  const [revision, setRevision] = useState(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<ImageSlot | null>(null);
  const [library, setLibrary] = useState<any[]>([]);
  const pickerPanel = useRef<HTMLElement>(null);
  const pickerButton = useRef<HTMLButtonElement | null>(null);
  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  useEffect(() => {
    if (picker) {
      pickerPanel.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      pickerPanel.current?.focus({ preventScroll: true });
    }
  }, [picker]);
  function closePicker() {
    setPicker(null);
    pickerButton.current?.focus();
  }
  const accept = useCallback(
    (data: any) => {
      const design =
        data.design || (broker ? defaultBrokerDesign() : defaultDesign());
      setSiteInfo(data);
      setDraft(design);
      setBaseline(JSON.stringify(design));
      setRevision(data.design_revision ?? 1);
      setReady(data.design_ready === true);
      setPreviews({});
      setPicker(null);
    },
    [broker],
  );
  useEffect(() => {
    let live = true;
    request(endpoint)
      .then((data) => {
        if (live) accept(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [endpoint, accept]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(key: keyof SiteDesign, value: unknown) {
    setDraft((previous) =>
      previous ? { ...previous, [key]: value } : previous,
    );
    setSuccess("");
  }
  function move(index: number, offset: number) {
    if (!draft) return;
    const sections = [...draft.sections];
    [sections[index], sections[index + offset]] = [
      sections[index + offset],
      sections[index],
    ];
    update("sections", sections);
  }
  function imageUrl(key: "logo_media_id" | "hero_media_id") {
    const id = draft?.[key];
    return id
      ? assetUrl(
          previews[id] ||
            (key === "logo_media_id" ? draft?.logo_url : draft?.hero_url) ||
            `/api/media/${id}`,
        )
      : "";
  }
  function selectMedia(key: ImageSlot, media: any) {
    setPreviews((p) => ({ ...p, [media.id]: media.url }));
    if (key === "hero_slides") {
      setDraft((p) =>
        p
          ? {
              ...p,
              hero_slides: [
                ...(p.hero_slides || []),
                {
                  media_id: media.id,
                  alt_text: media.name.slice(0, 200),
                  url: media.url,
                },
              ],
            }
          : p,
      );
      setSuccess("");
    } else update(key, media.id);
  }
  function moveSlide(index: number, offset: number) {
    const slides = [...(draft?.hero_slides || [])];
    [slides[index], slides[index + offset]] = [
      slides[index + offset],
      slides[index],
    ];
    update("hero_slides", slides);
  }
  async function upload(key: ImageSlot, files: File[]) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (
        key === "hero_slides" &&
        (draft?.hero_slides?.length || 0) + files.length > 8
      )
        throw new Error("El slider admite hasta 8 imágenes.");
      for (const file of files) {
        if (file.size > 8 * 1024 * 1024)
          throw new Error("La imagen no puede superar 8 MB.");
        const data = new FormData();
        data.set("file", file);
        const media = await request("/manage/media", {
          method: "POST",
          body: data,
        });
        selectMedia(key, media);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choose(key: ImageSlot, button: HTMLButtonElement) {
    pickerButton.current = button;
    setBusy(true);
    setError("");
    try {
      setLibrary(await request("/manage/media"));
      setPicker(key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">TU MARCA, TU ESTILO</span>
      <h1>{broker ? "Mi sitio web" : "Diseño del sitio"}</h1>
      <p>
        {broker
          ? "Personaliza tu propia web y muestra tus propiedades. Los cambios se aplican al guardar."
          : "Personaliza la web principal. Los cambios se publican únicamente al guardar."}
      </p>
      {broker && siteInfo?.advertiser && (
        <p>
          Tu dirección:{" "}
          <a
            className="text-link"
            href={`/anunciantes/${siteInfo.advertiser.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            /anunciantes/{siteInfo.advertiser.slug} ↗
          </a>
          {siteInfo.advertiser.status !== "approved" && (
            <span className="notice">
              {" "}
              Tu sitio será público cuando administración apruebe tu perfil.
            </span>
          )}
        </p>
      )}
      <Notice error={error} success={success} />
      {draft && !ready && (
        <div className="notice error" role="alert">
          La configuración visual necesita una actualización de la base de
          datos.{" "}
          {broker
            ? "Pide a administración que ejecute el archivo "
            : "Ejecuta el archivo "}
          <strong>
            {broker ? "005_sitios_corredores.sql" : "004_diseno_sitio.sql"}
          </strong>{" "}
          de la entrega y recarga esta página. Puedes explorar la vista previa
          mientras tanto.
        </div>
      )}
      {!draft ? (
        <p>Cargando el diseño guardado…</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setSuccess("");
            try {
              const result = await send(
                broker ? "/me/site" : "/admin/design",
                { design: draft, revision },
                "PATCH",
              );
              accept(result);
              await reload();
              setSuccess(
                broker
                  ? result.advertiser.status === "approved"
                    ? "Tu sitio web está actualizado."
                    : "Diseño guardado. Tu sitio se mostrará cuando el perfil esté aprobado."
                  : "Diseño publicado. Ya está disponible en el sitio principal.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="design-toolbar">
            <span role="status">
              {busy
                ? "Procesando…"
                : dirty
                  ? "Cambios sin publicar"
                  : "Diseño guardado"}
            </span>
            <div className="design-actions">
              <button
                className="button outline"
                type="button"
                disabled={busy || !dirty}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setSuccess("");
                  try {
                    accept(await request(endpoint));
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Descartar cambios
              </button>
              <button
                className="button"
                disabled={
                  busy ||
                  !ready ||
                  !dirty ||
                  (draft.hero_mode === "slider" &&
                    (draft.hero_slides?.length || 0) < 2)
                }
              >
                <Save size={17} />{" "}
                {broker ? "Guardar mi sitio" : "Guardar y publicar diseño"}
              </button>
            </div>
          </div>
          <div className="design-editor-grid">
            <fieldset className="design-controls" disabled={busy}>
              {broker && (
                <section className="panel-card">
                  <h2>Textos de tu sitio</h2>
                  <p>
                    El nombre y los datos de contacto se administran en tu
                    perfil de anunciante.
                  </p>
                  {(
                    [
                      ["hero_title", "Título de la portada", 180],
                      ["hero_subtitle", "Presentación breve", 400],
                      ["about_title", "Título de presentación", 100],
                      ["listings_title", "Título de propiedades", 100],
                      ["contact_title", "Título de contacto", 100],
                    ] as const
                  ).map(([key, label, max]) => (
                    <label key={key}>
                      {label}
                      <input
                        required={key !== "hero_subtitle"}
                        maxLength={max}
                        value={draft[key] || ""}
                        onChange={(e) => update(key, e.target.value)}
                      />
                    </label>
                  ))}
                  <label>
                    Acerca de ti o de tu inmobiliaria
                    <textarea
                      maxLength={4000}
                      rows={6}
                      value={draft.about_text || ""}
                      onChange={(e) => update("about_text", e.target.value)}
                    />
                  </label>
                </section>
              )}
              <section className="panel-card">
                <h2>
                  <Palette size={22} /> Colores
                </h2>
                <p>
                  Usa un color principal oscuro y un texto legible sobre el
                  fondo.
                </p>
                <div className="theme-grid" aria-label="Temas de colores">
                  {colorThemes.map((theme) => {
                    const active = colors.every(
                      ([key]) => draft[key].toLowerCase() === theme[key],
                    );
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={`theme-choice${active ? " selected" : ""}`}
                        aria-label={`Tema ${theme.name}`}
                        aria-pressed={active}
                        onClick={() => {
                          setDraft((p) =>
                            p
                              ? {
                                  ...p,
                                  primary_color: theme.primary_color,
                                  accent_color: theme.accent_color,
                                  background_color: theme.background_color,
                                  text_color: theme.text_color,
                                }
                              : p,
                          );
                          setSuccess("");
                          setError("");
                        }}
                      >
                        <span className="theme-swatches" aria-hidden="true">
                          <i style={{ background: theme.primary_color }} />
                          <i style={{ background: theme.accent_color }} />
                          <i style={{ background: theme.background_color }} />
                        </span>
                        <strong>{theme.name}</strong>
                        <small>{theme.description}</small>
                      </button>
                    );
                  })}
                </div>
                <details className="custom-colors">
                  <summary>Ajustar colores individualmente</summary>
                  <div className="design-color-grid">
                    {colors.map(([key, label, help]) => (
                      <label key={key}>
                        {label}
                        <div className="design-color-control">
                          <input
                            type="color"
                            aria-label={`${label}: selector`}
                            value={
                              /^#[0-9a-f]{6}$/i.test(draft[key])
                                ? draft[key]
                                : "#000000"
                            }
                            onChange={(e) => update(key, e.target.value)}
                          />
                          <input
                            aria-label={`${label}: hexadecimal`}
                            type="text"
                            maxLength={7}
                            pattern="#[0-9a-fA-F]{6}"
                            required
                            value={draft[key]}
                            onChange={(e) => update(key, e.target.value)}
                          />
                        </div>
                        <small>{help}</small>
                      </label>
                    ))}
                  </div>
                </details>
              </section>
              <section className="panel-card">
                <h2>Imágenes de marca</h2>
                <p>
                  JPG, PNG o WebP, hasta 8 MB. El logo puede tener fondo
                  transparente.
                </p>
                <label>
                  Tipo de portada
                  <select
                    value={draft.hero_mode || "image"}
                    onChange={(e) => update("hero_mode", e.target.value)}
                  >
                    <option value="image">Una imagen</option>
                    <option value="slider">Slider de imágenes</option>
                  </select>
                </label>
                {(["logo_media_id", "hero_media_id"] as const)
                  .filter(
                    (key) =>
                      key === "logo_media_id" || draft.hero_mode !== "slider",
                  )
                  .map((key) => (
                    <div className="design-image-field" key={key}>
                      <h3>
                        {key === "logo_media_id"
                          ? "Logo del sitio"
                          : "Imagen de portada"}
                      </h3>
                      {imageUrl(key) && (
                        <img
                          className={
                            key === "logo_media_id"
                              ? "design-logo-image"
                              : "design-cover-image"
                          }
                          src={imageUrl(key)}
                          alt={
                            key === "logo_media_id"
                              ? "Logo seleccionado"
                              : "Portada seleccionada"
                          }
                        />
                      )}
                      <label>
                        Subir {key === "logo_media_id" ? "logo" : "portada"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.currentTarget.value = "";
                            if (file) void upload(key, [file]);
                          }}
                        />
                      </label>
                      <div className="design-actions">
                        <button
                          type="button"
                          className="button outline small"
                          onClick={(e) => void choose(key, e.currentTarget)}
                        >
                          Elegir de mi biblioteca
                        </button>
                        {draft[key] && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => update(key, null)}
                          >
                            Quitar imagen
                          </button>
                        )}
                      </div>
                      <small>
                        {key === "logo_media_id"
                          ? "Sin logo se muestra el icono de casa. Recomendado: horizontal, con margen y fondo transparente."
                          : "Sin imagen se muestra la portada de ambientación. Recomendado: horizontal, de al menos 1600 px de ancho."}
                      </small>
                    </div>
                  ))}
                {draft.hero_mode === "slider" && (
                  <div className="slider-editor">
                    <h3>Imágenes del slider</h3>
                    <p>
                      De 2 a 8 imágenes. Ordénalas con las flechas. Al guardar
                      serán públicas cuando tu sitio esté publicado.
                    </p>
                    <label>
                      Subir imágenes del slider
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          e.currentTarget.value = "";
                          if (files.length) void upload("hero_slides", files);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="button outline small"
                      disabled={(draft.hero_slides?.length || 0) >= 8}
                      onClick={(e) =>
                        void choose("hero_slides", e.currentTarget)
                      }
                    >
                      Agregar desde mi biblioteca
                    </button>
                    {(draft.hero_slides || []).map((slide, index) => (
                      <div className="slider-editor-row" key={slide.media_id}>
                        <img
                          src={assetUrl(
                            previews[slide.media_id] ||
                              slide.url ||
                              `/api/media/${slide.media_id}`,
                          )}
                          alt={`Miniatura de imagen ${index + 1}`}
                        />
                        <div>
                          <label>
                            Descripción de imagen {index + 1}
                            <input
                              maxLength={200}
                              value={slide.alt_text}
                              onChange={(e) =>
                                update(
                                  "hero_slides",
                                  (draft.hero_slides || []).map((s) =>
                                    s.media_id === slide.media_id
                                      ? { ...s, alt_text: e.target.value }
                                      : s,
                                  ),
                                )
                              }
                            />
                          </label>
                          <div className="design-actions">
                            <button
                              type="button"
                              aria-label={`Subir imagen ${index + 1}`}
                              disabled={index === 0}
                              onClick={() => moveSlide(index, -1)}
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Bajar imagen ${index + 1}`}
                              disabled={
                                index === (draft.hero_slides?.length || 0) - 1
                              }
                              onClick={() => moveSlide(index, 1)}
                            >
                              <ArrowDown size={16} />
                            </button>
                            <button
                              type="button"
                              className="text-button"
                              aria-label={`Quitar imagen ${index + 1} del slider`}
                              onClick={() =>
                                update(
                                  "hero_slides",
                                  (draft.hero_slides || []).filter(
                                    (s) => s.media_id !== slide.media_id,
                                  ),
                                )
                              }
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(draft.hero_slides?.length || 0) < 2 && (
                      <p className="notice">
                        Agrega al menos dos imágenes para poder guardar el
                        slider.
                      </p>
                    )}
                    <label className="design-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.hero_autoplay ?? true}
                        onChange={(e) =>
                          update("hero_autoplay", e.target.checked)
                        }
                      />
                      Reproducción automática
                    </label>
                    <label>
                      Segundos entre imágenes
                      <select
                        value={draft.hero_interval || 6}
                        onChange={(e) =>
                          update("hero_interval", Number(e.target.value))
                        }
                      >
                        {[4, 5, 6, 8, 10, 12].map((n) => (
                          <option key={n} value={n}>
                            {n} segundos
                          </option>
                        ))}
                      </select>
                    </label>
                    <small>
                      El movimiento automático se pausa con el ratón, al usar el
                      teclado y cuando el navegador solicita movimiento
                      reducido.
                    </small>
                  </div>
                )}
                <label className="design-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.show_site_name}
                    onChange={(e) => update("show_site_name", e.target.checked)}
                  />{" "}
                  Mostrar el nombre del sitio junto al logo
                </label>
                <label>
                  Descripción de la imagen de portada
                  <input
                    maxLength={200}
                    value={draft.hero_alt}
                    onChange={(e) => update("hero_alt", e.target.value)}
                  />
                  <small>
                    Texto alternativo para personas que utilizan lectores de
                    pantalla.
                  </small>
                </label>
              </section>
              <section className="panel-card">
                <h2>Secciones de la página principal</h2>
                <p>
                  Usa las flechas para ordenar y las casillas para mostrar u
                  ocultar. Conserva al menos una sección visible.
                </p>
                <ol className="design-section-list">
                  {draft.sections.map((section, index) => (
                    <li key={section.id}>
                      <label className="design-checkbox">
                        <input
                          type="checkbox"
                          checked={section.visible}
                          onChange={(e) =>
                            update(
                              "sections",
                              draft.sections.map((s) =>
                                s.id === section.id
                                  ? { ...s, visible: e.target.checked }
                                  : s,
                              ),
                            )
                          }
                        />
                        {sectionNames[section.id]}
                      </label>
                      <div className="design-actions">
                        <button
                          type="button"
                          aria-label={`Subir ${sectionNames[section.id]}`}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={18} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Bajar ${sectionNames[section.id]}`}
                          disabled={index === draft.sections.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={18} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <button
                className="button outline"
                type="button"
                onClick={() => {
                  setDraft(makeDefault());
                  setSuccess("");
                }}
              >
                <RotateCcw size={17} /> Preparar diseño original
              </button>
              <p className="muted">
                Restaurar el diseño original también requiere guardar. Las
                fotografías permanecen en tu biblioteca.
              </p>
            </fieldset>
            <aside className="design-preview-column">
              <div className="design-preview-label">
                <EyeLabel /> Vista previa · sin publicar
              </div>
              <div
                className={`design-preview${draft.sections.find((s) => s.visible)?.id === "hero" ? " preview-cover-first" : ""}`}
                style={designStyle(draft)}
              >
                <div className="design-preview-header">
                  {imageUrl("logo_media_id") ? (
                    <img
                      src={imageUrl("logo_media_id")}
                      alt="Vista previa del logo"
                    />
                  ) : (
                    <House size={25} />
                  )}
                  {(!draft.logo_media_id || draft.show_site_name) && (
                    <strong>{displaySettings.site_name}</strong>
                  )}
                </div>
                {draft.sections
                  .filter((s) => s.visible)
                  .map((s) => (
                    <div
                      className={`design-preview-block preview-${s.id}`}
                      key={s.id}
                    >
                      {s.id === "hero" ? (
                        <>
                          <div className="preview-hero-copy">
                            <small>ENCUENTRA TU PRÓXIMO LUGAR</small>
                            <h2>
                              {broker
                                ? draft.hero_title
                                : settings.homepage_title}
                            </h2>
                            <p>
                              {broker
                                ? draft.hero_subtitle
                                : "Descubre propiedades y conecta con su anunciante."}
                            </p>
                          </div>
                          <HeroMedia
                            preview
                            design={{
                              ...draft,
                              hero_url: imageUrl("hero_media_id"),
                              hero_slides: (draft.hero_slides || []).map(
                                (s) => ({
                                  ...s,
                                  url:
                                    previews[s.media_id] ||
                                    s.url ||
                                    `/api/media/${s.media_id}`,
                                }),
                              ),
                            }}
                          />
                        </>
                      ) : s.id === "about" ? (
                        <>
                          <h3>{draft.about_title}</h3>
                          <p className="preserve-lines">
                            {draft.about_text ||
                              "Tu presentación aparecerá aquí."}
                          </p>
                        </>
                      ) : s.id === "contact" ? (
                        <>
                          <h3>{draft.contact_title}</h3>
                          <span className="design-preview-button">
                            Contactar
                          </span>
                        </>
                      ) : s.id === "search" ? (
                        <>
                          <span>¿Dónde buscas?</span>
                          <span className="design-preview-button">Buscar</span>
                        </>
                      ) : s.id === "types" ? (
                        <>
                          <h3>Un espacio para cada proyecto.</h3>
                          <div className="design-preview-cards">
                            <span>Casas</span>
                            <span>Departamentos</span>
                            <span>Terrenos</span>
                          </div>
                        </>
                      ) : s.id === "listings" ? (
                        <>
                          <h3>
                            {broker
                              ? draft.listings_title
                              : "El próximo lugar podría estar aquí."}
                          </h3>
                          <div className="design-preview-cards">
                            <span>Propiedad</span>
                            <span>Propiedad</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <h2>Tu propiedad. Su próximo comienzo.</h2>
                          <span className="design-preview-button">
                            Comenzar a publicar
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                <div className="design-preview-footer">
                  {displaySettings.site_name} · Vista de ejemplo
                </div>
              </div>
              <p>
                La vista previa ilustra colores, imágenes y orden. El contenido
                de las propiedades se carga en el sitio real.
              </p>
              <a
                href={
                  broker && siteInfo?.advertiser
                    ? `/anunciantes/${siteInfo.advertiser.slug}`
                    : "/"
                }
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                {broker ? "Abrir mi sitio web ↗" : "Abrir sitio principal ↗"}
              </a>
            </aside>
          </div>
        </form>
      )}
      {picker && (
        <section
          ref={pickerPanel}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "Escape") closePicker();
          }}
          className="panel-card design-library"
          aria-label="Seleccionar imagen de mi biblioteca"
        >
          <div className="section-heading">
            <h2>Elige una imagen</h2>
            <button className="button outline" onClick={closePicker}>
              Cerrar biblioteca
            </button>
          </div>
          {!library.length && (
            <p>Tu biblioteca está vacía. Sube una imagen en el formulario.</p>
          )}
          <div className="design-library-grid">
            {library.map((media) => (
              <button
                key={media.id}
                type="button"
                disabled={
                  picker === "hero_slides" &&
                  ((draft?.hero_slides?.length || 0) >= 8 ||
                    !!draft?.hero_slides?.some((s) => s.media_id === media.id))
                }
                onClick={() => {
                  selectMedia(picker, media);
                  closePicker();
                }}
              >
                <img src={assetUrl(media.url)} alt={media.name} />
                <span>{media.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
function EyeLabel() {
  return <span aria-hidden="true">◉</span>;
}
