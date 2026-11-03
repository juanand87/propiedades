"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Mail, MessageCircle, Phone } from "lucide-react";
import {
  marketplaceFooterText,
  socialNetworks,
  type SiteDesign,
} from "@/lib/site-design";

export function MarketplaceFooter({
  settings,
  design,
  brand,
}: {
  settings: any;
  design: SiteDesign;
  brand: ReactNode;
}) {
  const contact = design.footer_contact ?? {
    phone: "",
    whatsapp: "",
    email: settings.contact_email || "",
  };
  const hasContact = !!(contact.phone || contact.whatsapp || contact.email);
  const text = marketplaceFooterText(design);
  return (
    <footer
      className={`site-footer marketplace-footer${hasContact ? " has-contact" : ""}`}
    >
      <div>
        <Link href="/" className="brand">
          {brand}
          {(!design.logo_url || design.show_site_name) && (
            <>
              {settings.site_name}
              <span className="brand-dot">.</span>
            </>
          )}
        </Link>
        {text && <p className="preserve-lines">{text}</p>}
        {!!design.footer_socials?.length && (
          <div
            className="marketplace-socials"
            aria-label="Redes sociales del sitio principal"
          >
            {design.footer_socials.map((social) => (
              <a
                key={social.network}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {socialNetworks.find((network) => network.id === social.network)
                  ?.name || social.network}
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
      </div>
      <div>
        <span className="eyebrow">EXPLORA</span>
        <Link href="/propiedades">Propiedades en venta</Link>
        <Link href="/anunciantes">Nuestros anunciantes</Link>
        <Link href="/favoritos">Tus favoritos</Link>
      </div>
      <div>
        <span className="eyebrow">PUBLICA</span>
        <Link href="/dashboard/perfil">Propietarios y corredores</Link>
        <Link href="/informacion">Acerca del marketplace</Link>
        <Link href="/privacidad">Privacidad y contacto</Link>
      </div>
      {hasContact && (
        <div
          className="marketplace-footer-contact"
          aria-label="Contacto del sitio principal"
        >
          {(design.footer_contact_title ?? "Hablemos de tu próximo lugar") && (
            <h2>
              {design.footer_contact_title ?? "Hablemos de tu próximo lugar"}
            </h2>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>
              <Phone size={17} aria-hidden="true" />
              <span>{contact.phone}</span>
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`}>
              <Mail size={17} aria-hidden="true" />
              <span>{contact.email}</span>
            </a>
          )}
          {contact.whatsapp && (
            <a
              href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} aria-hidden="true" />
              <span>Conversar por WhatsApp</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {settings.site_name}. Chile.
        </span>
        {(design.footer_note ??
          "Las consultas y visitas se coordinan directamente con el anunciante.") && (
          <span className="preserve-lines">
            {design.footer_note ??
              "Las consultas y visitas se coordinan directamente con el anunciante."}
          </span>
        )}
      </div>
    </footer>
  );
}
