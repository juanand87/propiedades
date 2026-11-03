"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  headerLinks,
  headerPresets,
  type HeaderLink,
  type SiteDesign,
} from "@/lib/site-design";

export function HeaderEditor({
  draft,
  update,
  broker,
  ready,
}: {
  draft: SiteDesign;
  update: (key: keyof SiteDesign, value: unknown) => void;
  broker: boolean;
  ready: boolean;
}) {
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
