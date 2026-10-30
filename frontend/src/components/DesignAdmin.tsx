"use client";
import { useEffect, useRef, useState } from "react";
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
  sectionNames,
  SiteDesign,
} from "@/lib/site-design";
import { Notice, useEstate } from "./EstateApp";

const colors = [
  ["primary_color", "Color principal", "Botones, enlaces y bloques destacados"],
  ["accent_color", "Color de acento", "Detalles y elementos decorativos"],
  ["background_color", "Fondo del sitio", "Fondo general de las páginas"],
  ["text_color", "Color del texto", "Títulos y contenido principal"],
] as const;

export function DesignAdmin() {
  const { settings, reload } = useEstate();
  const [draft, setDraft] = useState<SiteDesign | null>(null);
  const [baseline, setBaseline] = useState("");
  const [revision, setRevision] = useState(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<
    "logo_media_id" | "hero_media_id" | null
  >(null);
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
  function accept(data: any) {
    const design = data.design || defaultDesign();
    setDraft(design);
    setBaseline(JSON.stringify(design));
    setRevision(data.design_revision || 1);
    setReady(data.design_ready === true);
    setPreviews({});
    setPicker(null);
  }
  useEffect(() => {
    let live = true;
    request("/settings")
      .then((data) => {
        if (live) accept(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
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
  async function upload(key: "logo_media_id" | "hero_media_id", file: File) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (file.size > 8 * 1024 * 1024)
        throw new Error("La imagen no puede superar 8 MB.");
      const data = new FormData();
      data.set("file", file);
      const media = await request("/manage/media", {
        method: "POST",
        body: data,
      });
      setPreviews((p) => ({ ...p, [media.id]: media.url }));
      update(key, media.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choose(
    key: "logo_media_id" | "hero_media_id",
    button: HTMLButtonElement,
  ) {
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
      <h1>Diseño del sitio</h1>
      <p>
        Personaliza la web principal. Los cambios se publican únicamente al
        guardar.
      </p>
      <Notice error={error} success={success} />
      {draft && !ready && (
        <div className="notice error" role="alert">
          La configuración visual necesita una actualización de la base de
          datos. Ejecuta el archivo <strong>004_diseno_sitio.sql</strong> de la
          entrega y recarga esta página. Puedes explorar la vista previa
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
                "/admin/design",
                { design: draft, revision },
                "PATCH",
              );
              accept(result);
              await reload();
              setSuccess(
                "Diseño publicado. Ya está disponible en el sitio principal.",
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
                    accept(await request("/settings"));
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Descartar cambios
              </button>
              <button className="button" disabled={busy || !ready || !dirty}>
                <Save size={17} /> Guardar y publicar diseño
              </button>
            </div>
          </div>
          <div className="design-editor-grid">
            <fieldset className="design-controls" disabled={busy}>
              <section className="panel-card">
                <h2>
                  <Palette size={22} /> Colores
                </h2>
                <p>
                  Usa un color principal oscuro y un texto legible sobre el
                  fondo.
                </p>
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
              </section>
              <section className="panel-card">
                <h2>Imágenes de marca</h2>
                <p>
                  JPG, PNG o WebP, hasta 8 MB. El logo puede tener fondo
                  transparente.
                </p>
                {(["logo_media_id", "hero_media_id"] as const).map((key) => (
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
                          if (file) void upload(key, file);
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
                        : "Sin imagen se muestra la ilustración original. Recomendado: horizontal, de al menos 1200 px de ancho."}
                    </small>
                  </div>
                ))}
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
                  setDraft(defaultDesign());
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
              <div className="design-preview" style={designStyle(draft)}>
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
                    <strong>{settings.site_name}</strong>
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
                          <div>
                            <small>ENCUENTRA TU PRÓXIMO LUGAR</small>
                            <h2>{settings.homepage_title}</h2>
                          </div>
                          <img
                            src={
                              imageUrl("hero_media_id") || "/architecture.svg"
                            }
                            alt={draft.hero_alt}
                          />
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
                          <h3>El próximo lugar podría estar aquí.</h3>
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
                  {settings.site_name} · Vista de ejemplo
                </div>
              </div>
              <p>
                La vista previa ilustra colores, imágenes y orden. El contenido
                de las propiedades se carga en el sitio real.
              </p>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                Abrir sitio principal ↗
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
                onClick={() => {
                  setPreviews((p) => ({ ...p, [media.id]: media.url }));
                  update(picker, media.id);
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
