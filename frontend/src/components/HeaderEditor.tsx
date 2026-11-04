"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  headerLinks,
  headerPresets,
  defaultHeaderStyle,
  type HeaderStyle,
  type HeaderLink,
  type SiteDesign,
} from "@/lib/site-design";

export function HeaderEditor({
  draft,
  update,
  broker,
  ready,
  styleReady,
  stickyReady,
  shrinkReady,
  overlayReady,
}: {
  draft: SiteDesign;
  update: (key: keyof SiteDesign, value: unknown) => void;
  broker: boolean;
  ready: boolean;
  styleReady: boolean;
  stickyReady: boolean;
  shrinkReady: boolean;
  overlayReady: boolean;
}) {
  const style = draft.header_style ?? defaultHeaderStyle();
  const overlay = draft.header_overlay ?? {
    enabled: false,
    cover_text_color: style.text_color ?? draft.text_color,
    scroll_background_color: style.background_color ?? "#ffffff",
    scroll_text_color: style.text_color ?? draft.text_color,
  };
  const colors = [
    ["background_color", "Fondo de la cabecera", "#ffffff"],
    ["text_color", "Texto del menú", draft.text_color],
    [
      "hover_color",
      "Enlaces al pasar el cursor y sección activa",
      draft.primary_color,
    ],
    ["button_color", "Fondo del botón principal", draft.primary_color],
    ["button_text_color", "Texto del botón principal", "#ffffff"],
  ] as const;
  function changeStyle(key: keyof HeaderStyle, value: number | string | null) {
    update("header_style", { ...style, [key]: value });
  }
  const presets = headerPresets(broker, draft);
  const links = draft.header_links ?? headerLinks(draft, broker);
  const defaultButton = {
    label: broker ? "Contactar" : "Publicar propiedad",
    href: broker
      ? presets.find((p) => p.href === "#contacto")?.href ||
        presets[0]?.href ||
        "#sitio-inmobiliaria"
      : "/register",
    new_tab: false,
    visible: true,
  };
  const button = draft.header_button ?? defaultButton;
  const mode =
    draft.header_button == null
      ? "default"
      : button.visible
        ? "custom"
        : "hidden";
  function change(index: number, key: keyof HeaderLink, value: unknown) {
    update(
      "header_links",
      links.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }
  function move(index: number, offset: number) {
    const next = [...links];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    update("header_links", next);
  }
  function normalize(value: string) {
    const href = value.trim();
    return href && !/^(?:\/|#|[a-z][a-z0-9+.-]*:)/i.test(href)
      ? `https://${href}`
      : href;
  }
  return (
    <section className="panel-card header-editor">
      <h2>Comportamiento de la cabecera</h2>
      <fieldset disabled={!stickyReady} className="header-sticky-editor">
        <label className="design-checkbox">
          <input
            type="checkbox"
            checked={draft.header_sticky ?? false}
            onChange={(e) => update("header_sticky", e.target.checked)}
          />
          Mantener la cabecera visible al hacer scroll
        </label>
        <p>
          El logo, el menú y el botón principal permanecen disponibles al
          desplazarse, en escritorio y móvil. Desplázate dentro de la vista
          previa para probarlo.
        </p>
        {!stickyReady && (
          <p className="notice">
            Esta opción estará disponible al terminar la actualización. Recarga
            en unos minutos.
          </p>
        )}
      </fieldset>
      <fieldset
        disabled={!shrinkReady || !draft.header_sticky}
        className="header-sticky-editor"
      >
        <label className="design-checkbox">
          <input
            type="checkbox"
            checked={draft.header_shrink ?? false}
            onChange={(e) => update("header_shrink", e.target.checked)}
          />
          Hacer la cabecera más pequeña al hacer scroll
        </label>
        <p>
          Reduce la altura y el logo al bajar por la página. Recupera su tamaño
          original al volver arriba. Se conserva un tamaño mínimo para facilitar
          el uso del menú.
        </p>
        {(draft.header_shrink ?? false) && (
          <label>
            Tamaño reducido{" "}
            <strong>{draft.header_shrink_percent ?? 75} % del original</strong>
            <input
              type="range"
              min={65}
              max={90}
              step={5}
              value={draft.header_shrink_percent ?? 75}
              onChange={(e) =>
                update("header_shrink_percent", Number(e.target.value))
              }
            />
          </label>
        )}
      </fieldset>
      {!draft.header_sticky && (
        <p className="muted">
          Activa primero la cabecera visible al hacer scroll para utilizar la
          reducción.
        </p>
      )}
      {!shrinkReady && (
        <p className="notice">
          La reducción estará disponible al terminar la actualización. Recarga
          en unos minutos.
        </p>
      )}
      <fieldset
        disabled={!overlayReady || !draft.header_sticky}
        className="header-sticky-editor"
      >
        <label className="design-checkbox">
          <input
            type="checkbox"
            checked={overlay.enabled}
            onChange={(e) =>
              update("header_overlay", {
                ...overlay,
                enabled: e.target.checked,
              })
            }
          />
          Cabecera transparente sobre la portada
        </label>
        <p>
          Al bajar por la página cambia a un fondo sólido; al volver arriba
          recupera la transparencia. Se aplica cuando Portada es la primera
          sección visible.
        </p>
        {overlay.enabled &&
          (
            [
              ["cover_text_color", "Texto sobre la portada"],
              ["scroll_background_color", "Fondo después de hacer scroll"],
              ["scroll_text_color", "Texto después de hacer scroll"],
            ] as const
          ).map(([key, label]) => (
            <div className="header-color-row" key={key}>
              <label>
                {label}
                <span className="header-color-value">
                  <input
                    type="color"
                    aria-label={label}
                    value={
                      /^#[0-9a-f]{6}$/i.test(overlay[key])
                        ? overlay[key]
                        : "#ffffff"
                    }
                    onChange={(e) =>
                      update("header_overlay", {
                        ...overlay,
                        [key]: e.target.value,
                      })
                    }
                  />
                  <input
                    type="text"
                    aria-label={`${label} hexadecimal`}
                    required
                    pattern="#[0-9a-fA-F]{6}"
                    maxLength={7}
                    value={overlay[key]}
                    onChange={(e) =>
                      update("header_overlay", {
                        ...overlay,
                        [key]: e.target.value,
                      })
                    }
                  />
                </span>
              </label>
            </div>
          ))}
        {overlay.enabled && (
          <p className="muted">
            Elige texto que contraste con tu portada. El menú móvil usa siempre
            el fondo sólido para que los enlaces sean legibles.
          </p>
        )}
      </fieldset>
      {!draft.header_sticky && (
        <p className="muted">
          Activa primero la cabecera fija para utilizar la transparencia y el
          cambio de color al hacer scroll.
        </p>
      )}
      {!overlayReady && (
        <p className="notice">
          La transparencia estará disponible al terminar la actualización.
          Recarga en unos minutos.
        </p>
      )}
      <h2>Tamaño y colores de la cabecera</h2>
      {!styleReady && (
        <p className="notice">
          Los tamaños y colores estarán disponibles al terminar la
          actualización. Recarga la página en unos minutos.
        </p>
      )}
      <fieldset disabled={!styleReady} className="header-style-editor">
        <label>
          Tamaño del logo <strong>{style.logo_height} px</strong>
          <input
            type="range"
            min={24}
            max={80}
            step={1}
            value={style.logo_height}
            onChange={(e) => changeStyle("logo_height", Number(e.target.value))}
          />
        </label>
        <p className="muted">
          Controla la altura del logo; su proporción se conserva. Puedes subirlo
          en Identidad. Sin imagen, cambia el tamaño del icono.
        </p>
        <label>
          Altura de la cabecera <strong>{style.height} px</strong>
          <input
            type="range"
            min={64}
            max={144}
            step={1}
            value={style.height}
            onChange={(e) => changeStyle("height", Number(e.target.value))}
          />
        </label>
        <p className="muted">
          La altura crece si el logo necesita más espacio. En móvil, el logo se
          adapta al ancho disponible.
        </p>
        <h3>Colores del menú</h3>
        <p>
          Deja Automático para seguir los colores del tema o elige un color
          propio. Comprueba que los textos sean fáciles de leer.
        </p>
        {colors.map(([key, label, fallback]) => (
          <div className="header-color-row" key={key}>
            <label>
              {label}
              <span className="header-color-value">
                <input
                  type="color"
                  aria-label={label}
                  value={
                    /^#[0-9a-f]{6}$/i.test(style[key] ?? fallback)
                      ? (style[key] ?? fallback)
                      : fallback
                  }
                  onChange={(e) => changeStyle(key, e.target.value)}
                />
                <input
                  type="text"
                  aria-label={`${label} hexadecimal`}
                  required
                  pattern="#[0-9a-fA-F]{6}"
                  maxLength={7}
                  value={style[key] ?? fallback}
                  onChange={(e) => changeStyle(key, e.target.value)}
                />
              </span>
            </label>
            <label className="design-checkbox">
              <input
                type="checkbox"
                checked={style[key] == null}
                onChange={(e) =>
                  changeStyle(key, e.target.checked ? null : fallback)
                }
              />{" "}
              Automático
            </label>
          </div>
        ))}
        <button
          type="button"
          className="button outline small"
          onClick={() => update("header_style", null)}
        >
          Restaurar tamaños y colores automáticos
        </button>
      </fieldset>
      <h2>Menú y botón principal</h2>
      {!ready && (
        <p className="notice">
          Estas opciones estarán disponibles al terminar la actualización del
          backend. Recarga la página en unos minutos.
        </p>
      )}
      <fieldset disabled={!ready}>
        <label className="design-checkbox">
          <input
            type="checkbox"
            checked={draft.header_links != null}
            onChange={(e) =>
              update(
                "header_links",
                e.target.checked
                  ? headerLinks(draft, broker).map((item) => ({ ...item }))
                  : null,
              )
            }
          />{" "}
          Personalizar enlaces del menú
        </label>
        {draft.header_links == null ? (
          <p>
            Usas el menú automático del sitio. Activa la opción para cambiar sus
            textos, destinos y orden.
          </p>
        ) : (
          <>
            <p>
              Hasta seis enlaces. Ordénalos con las flechas.{" "}
              {broker &&
                "Los enlaces a secciones ocultas no se muestran en el sitio."}
            </p>
            {links.map((item, index) => (
              <div className="header-link-editor" key={index}>
                <div className="header-link-editor-title">
                  <strong>Enlace {index + 1}</strong>
                  <div className="design-actions">
                    <button
                      type="button"
                      aria-label={`Subir enlace ${index + 1}`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Bajar enlace ${index + 1}`}
                      disabled={index === links.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Quitar enlace ${index + 1}`}
                      onClick={() =>
                        update(
                          "header_links",
                          links.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <label>
                  Texto del enlace {index + 1}
                  <input
                    required
                    maxLength={40}
                    value={item.label}
                    onChange={(e) => change(index, "label", e.target.value)}
                  />
                </label>
                <label>
                  Destino sugerido del enlace {index + 1}
                  <select
                    value={
                      presets.some((p) => p.href === item.href) ? item.href : ""
                    }
                    onChange={(e) => change(index, "href", e.target.value)}
                  >
                    <option value="">Otro enlace</option>
                    {presets.map((p) => (
                      <option key={p.href} value={p.href}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Dirección del enlace {index + 1}
                  <input
                    required
                    maxLength={500}
                    value={item.href}
                    placeholder="/propiedades o https://ejemplo.cl"
                    onChange={(e) => change(index, "href", e.target.value)}
                    onBlur={(e) =>
                      change(index, "href", normalize(e.target.value))
                    }
                  />
                </label>
                <label className="design-checkbox">
                  <input
                    type="checkbox"
                    checked={item.new_tab}
                    onChange={(e) => change(index, "new_tab", e.target.checked)}
                  />{" "}
                  Abrir enlace {index + 1} en otra pestaña
                </label>
              </div>
            ))}
            {!links.length && (
              <p className="notice">
                El menú no tiene enlaces. Los accesos de cuenta se mantienen
                disponibles.
              </p>
            )}
            <button
              type="button"
              className="button outline small"
              disabled={links.length >= 6}
              onClick={() =>
                update("header_links", [
                  ...links,
                  {
                    label: "Nuevo enlace",
                    href: broker ? "#sitio-inmobiliaria" : "/",
                    new_tab: false,
                  },
                ])
              }
            >
              <Plus size={16} /> Agregar enlace
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => update("header_links", null)}
            >
              Volver al menú automático
            </button>
          </>
        )}
        <h3>Botón principal</h3>
        <label>
          Modo del botón
          <select
            value={mode}
            onChange={(e) =>
              update(
                "header_button",
                e.target.value === "default"
                  ? null
                  : { ...button, visible: e.target.value === "custom" },
              )
            }
          >
            <option value="default">Usar botón predeterminado</option>
            <option value="custom">Personalizar botón</option>
            <option value="hidden">Ocultar botón principal</option>
          </select>
        </label>
        {mode === "custom" && (
          <>
            <label>
              Texto del botón principal
              <input
                required
                maxLength={40}
                value={button.label}
                onChange={(e) =>
                  update("header_button", { ...button, label: e.target.value })
                }
              />
            </label>
            <label>
              Destino sugerido del botón
              <select
                value={
                  presets.some((p) => p.href === button.href) ? button.href : ""
                }
                onChange={(e) =>
                  update("header_button", { ...button, href: e.target.value })
                }
              >
                <option value="">Otro enlace</option>
                {presets.map((p) => (
                  <option key={p.href} value={p.href}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dirección del botón principal
              <input
                required
                maxLength={500}
                value={button.href}
                placeholder="/propiedades o https://wa.me/56912345678"
                onChange={(e) =>
                  update("header_button", { ...button, href: e.target.value })
                }
                onBlur={(e) =>
                  update("header_button", {
                    ...button,
                    href: normalize(e.target.value),
                  })
                }
              />
            </label>
            <label className="design-checkbox">
              <input
                type="checkbox"
                checked={button.new_tab}
                onChange={(e) =>
                  update("header_button", {
                    ...button,
                    new_tab: e.target.checked,
                  })
                }
              />{" "}
              Abrir botón en otra pestaña
            </label>
          </>
        )}
        <p className="muted">
          Usa destinos sugeridos, rutas que comiencen con /, secciones con # o
          enlaces HTTPS. Los accesos de cuenta y edición se mantienen. Publica
          los cambios con el botón de guardar.
        </p>
      </fieldset>
    </section>
  );
}
