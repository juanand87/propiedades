"use client";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { headerLinks, type SiteDesign } from "@/lib/site-design";
export function HeaderPreview({
  design,
  broker,
  children,
}: {
  design: SiteDesign;
  broker: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const links = headerLinks(design, broker);
  const button = design.header_button;
  const buttonLabel =
    button == null
      ? broker
        ? "Contactar"
        : "Publicar propiedad"
      : button.visible
        ? button.label
        : "";
  return (
    <div className="design-preview-header">
      <div className="preview-header-brand">{children}</div>
      <div className={`preview-header-menu${open ? " open" : ""}`}>
        <div className="preview-header-links">
          {links.map((item, index) => (
            <span key={index}>{item.label}</span>
          ))}
        </div>
        {buttonLabel && (
          <span className="preview-header-button">{buttonLabel}</span>
        )}
      </div>
      <button
        type="button"
        className="preview-header-toggle"
        aria-label={
          open
            ? "Cerrar menú de la vista previa"
            : "Abrir menú de la vista previa"
        }
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>
    </div>
  );
}
