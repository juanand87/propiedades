"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowUp,
  CalendarDays,
  House,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  UsersRound,
  X,
} from "lucide-react";
import { assetUrl, labels, request } from "@/lib/estate-api";
import {
  defaultBrokerDesign,
  designStyle,
  brokerContact,
  brokerFooterText,
  socialNetworks,
  headerLinks,
  headerHref,
} from "@/lib/site-design";
import { Notice, useEstate } from "./EstateApp";
import { Detail, SearchView } from "./PublicView";
import { HeroMedia } from "./HeroMedia";

const anchors: Record<string, string> = {
  hero: "inicio",
  about: "nosotros",
  listings: "propiedades",
  contact: "contacto",
};
const navNames: Record<string, string> = {
  hero: "Inicio",
  about: "Nosotros",
  listings: "Propiedades",
  contact: "Contacto",
};
export function BrokerSite({
  slug,
  advertiser,
  property,
  propertyIdentifier,
}: {
  slug: string;
  advertiser?: any;
  property?: any;
  propertyIdentifier?: string;
}) {
  const { user } = useEstate();
  const [loaded, setLoaded] = useState<any>(null),
    [error, setError] = useState(""),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    if (advertiser) return;
    let live = true;
    request("/advertisers/" + encodeURIComponent(slug))
      .then((a) => {
        if (live) setLoaded(a);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [slug, advertiser]);
  const a = advertiser || (loaded?.slug === slug ? loaded : null);
  if (!a)
    return (
      <main className="section">
        <Notice error={error} />
        {!error && <p>Cargando sitio…</p>}
        <Link className="text-link" href="/anunciantes">
          Volver a los anunciantes
        </Link>
      </main>
    );
  const d = a.site || {
    ...defaultBrokerDesign(a),
    logo_url: a.logo_media_id ? `/api/media/${a.logo_media_id}` : null,
  };
  const contact = brokerContact(d, a);
  const base = `/anunciantes/${a.slug}`;
  const menuLinks = headerLinks(d, true);
  const customHeader = d.header_links != null || d.header_button != null;
  const primary = d.header_button;
  const isOwner = user?.advertiser_id === a.id;
  const visible = d.sections.filter((s: any) => s.visible);
  const shows = (id: string) => visible.some((s: any) => s.id === id);
  const contactHref = shows("contact")
    ? `${base}#contacto`
    : contact.phone
      ? `tel:${contact.phone.replace(/[^+\d]/g, "")}`
      : base;
  const brand = (
    <>
      {d.logo_url ? (
        <img
          className="site-logo"
          src={assetUrl(d.logo_url)}
          alt={a.display_name}
        />
      ) : (
        <span className="brand-icon">
          <House size={24} />
        </span>
      )}
      {(!d.logo_url || d.show_site_name) && <span>{a.display_name}</span>}
    </>
  );
  const sections: Record<string, React.ReactNode> = {
    hero: (
      <section className="portal-hero broker-hero" id="inicio">
        <HeroMedia design={d} />
        <div className="hero-copy">
          <span className="eyebrow">
            {labels[a.kind]} · {a.display_name}
          </span>
          <h1>{d.hero_title}</h1>
          <p className="preserve-lines">{d.hero_subtitle}</p>
          {(shows("listings") || shows("contact")) && (
            <Link
              className="button"
              href={shows("listings") ? `${base}#propiedades` : contactHref}
            >
              {shows("listings") ? "Explorar propiedades" : "Contactar"}
              <ArrowUpRight size={18} />
            </Link>
          )}
        </div>
      </section>
    ),
    about: (
      <section className="section broker-about" id="nosotros">
        <span className="eyebrow">PERSONAS DETRÁS DE CADA LUGAR</span>
        <h2>{d.about_title}</h2>
        <p className="preserve-lines">
          {d.about_text ||
            a.description ||
            "Te acompañamos a encontrar tu próxima propiedad con una atención cercana y personalizada."}
        </p>
      </section>
    ),
    listings: (
      <section id="propiedades">
        <SearchView
          key={a.id}
          embedded
          advertiserId={a.id}
          heading={d.listings_title}
          propertyBase={`${base}/propiedades`}
          homeHref={base}
        />
      </section>
    ),
    contact: (
      <section className="section broker-contact" id="contacto">
        <div>
          <span className="eyebrow">HABLEMOS DE TU PRÓXIMO LUGAR</span>
          <h2>{d.contact_title}</h2>
          <p>
            Consulta por una propiedad o coordina una visita con{" "}
            {a.display_name}.
          </p>
          <div className="broker-contact-benefits">
            <span>
              <UsersRound size={23} aria-hidden="true" /> Contacto directo
            </span>
            <span>
              <House size={23} aria-hidden="true" /> Consulta por propiedades
            </span>
            <span>
              <CalendarDays size={23} aria-hidden="true" /> Coordina tu visita
            </span>
          </div>
        </div>
        <div className="broker-contact-links" aria-label="Canales de contacto">
          {contact.phone && (
            <a
              className="button outline"
              href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
            >
              <Phone size={18} />
              {contact.phone}
            </a>
          )}
          {contact.whatsapp && (
            <a
              className="button"
              href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={21} aria-hidden="true" />
              Conversar por WhatsApp
              <ArrowUpRight size={18} />
            </a>
          )}
          {contact.email && (
            <a className="button outline" href={`mailto:${contact.email}`}>
              <Mail size={18} />
              {contact.email}
            </a>
          )}
          {!contact.phone && !contact.whatsapp && !contact.email && (
            <p>
              Puedes enviar tu consulta desde la ficha de cualquiera de nuestras
              propiedades.
            </p>
          )}
        </div>
      </section>
    ),
  };
  return (
    <div
      id="sitio-inmobiliaria"
      className={`estate-site broker-site${!propertyIdentifier && visible[0]?.id === "hero" ? " has-cover-hero" : ""}`}
      style={designStyle(d)}
    >
      <header
        className={`site-header broker-header${customHeader ? " custom-header" : ""}`}
      >
        <Link
          className="brand"
          href={base}
          aria-label={`${a.display_name}, inicio`}
        >
          {brand}
        </Link>
        <nav
          className={`main-nav${menu ? " open" : ""}`}
          id="broker-site-menu"
          aria-label="Navegación del sitio del anunciante"
        >
          {menuLinks.map((item, index) => (
            <Link
              key={index}
              href={headerHref(item.href, base)}
              target={item.new_tab ? "_blank" : undefined}
              rel={item.new_tab ? "noopener noreferrer" : undefined}
              onClick={() => setMenu(false)}
            >
              {item.label}
            </Link>
          ))}
          {customHeader &&
            (primary
              ? primary.visible
              : shows("contact") || !!contact.phone) && (
              <Link
                className="button small header-mobile-cta"
                href={primary ? headerHref(primary.href, base) : contactHref}
                target={primary?.new_tab ? "_blank" : undefined}
                rel={primary?.new_tab ? "noopener noreferrer" : undefined}
                onClick={() => setMenu(false)}
              >
                {primary?.label || "Contactar"}
                <ArrowUpRight size={16} />
              </Link>
            )}
        </nav>
        <div className="header-actions">
          {isOwner && (
            <Link
              className={customHeader ? "account-link" : "button small"}
              href={user.role === "admin" ? "/panel/sitio" : "/dashboard/sitio"}
            >
              Editar mi sitio
            </Link>
          )}
          {primary != null
            ? primary.visible && (
                <Link
                  className="button small"
                  href={headerHref(primary.href, base)}
                  target={primary.new_tab ? "_blank" : undefined}
                  rel={primary.new_tab ? "noopener noreferrer" : undefined}
                >
                  {primary.label}
                  <ArrowUpRight size={16} />
                </Link>
              )
            : !isOwner &&
              (shows("contact") || contact.phone) && (
                <Link className="button small" href={contactHref}>
                  Contactar
                  <ArrowUpRight size={16} />
                </Link>
              )}
          <button
            className="mobile-toggle"
            aria-controls="broker-site-menu"
            aria-label="Abrir menú del anunciante"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {propertyIdentifier ? (
        <Detail
          key={`${a.id}-${propertyIdentifier}`}
          identifier={propertyIdentifier}
          initialProperty={property}
          advertiserId={a.id}
          listHref={`${base}#propiedades`}
        />
      ) : (
        <main className="broker-home">
          {!shows("hero") && <h1 className="sr-only">{a.display_name}</h1>}
          {visible.map((s: any) => (
            <div key={s.id}>{sections[s.id]}</div>
          ))}
        </main>
      )}
      <footer className="site-footer broker-footer broker-footer-modern">
        <div className="broker-footer-main">
          <div className="broker-footer-brand">
            <Link
              className="brand"
              href={base}
              aria-label={`${a.display_name}, inicio`}
            >
              {brand}
            </Link>
            {brokerFooterText(d, a.display_name) && (
              <p className="preserve-lines">
                {brokerFooterText(d, a.display_name)}
              </p>
            )}
            {!!d.footer_socials?.length && (
              <div
                className="broker-footer-socials"
                aria-label="Redes sociales"
              >
                {d.footer_socials.map((social: any) => (
                  <a
                    key={social.network}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {socialNetworks.find(
                      (network) => network.id === social.network,
                    )?.name || social.network}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
            <span className="broker-footer-kind">
              {labels[a.kind] || "Anunciante inmobiliario"}
            </span>
          </div>
          <nav
            className="broker-footer-navigation"
            aria-label="Enlaces del pie de página"
          >
            <h2>Explora nuestro sitio</h2>
            {visible.map((section: any) => (
              <Link key={section.id} href={`${base}#${anchors[section.id]}`}>
                {navNames[section.id]}
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <div className="broker-footer-contact">
            {(d.footer_contact_title ?? "Hablemos de tu próximo lugar") && (
              <h2>
                {d.footer_contact_title ?? "Hablemos de tu próximo lugar"}
              </h2>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>
                <Phone size={18} aria-hidden="true" />
                <span>{contact.phone}</span>
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`}>
                <Mail size={18} aria-hidden="true" />
                <span>{contact.email}</span>
              </a>
            )}
            {contact.whatsapp && (
              <a
                className="broker-footer-whatsapp"
                href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={19} aria-hidden="true" />
                <span>Conversemos por WhatsApp</span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            )}
            {!contact.phone && !contact.whatsapp && !contact.email && (
              <p>
                Puedes consultar desde la ficha de una de nuestras propiedades.
              </p>
            )}
          </div>
        </div>
        {d.footer_note && (
          <p className="broker-footer-note preserve-lines">{d.footer_note}</p>
        )}
        <div className="broker-footer-bottom">
          <span>
            © {new Date().getFullYear()} {a.display_name}
          </span>
          <div>
            <Link href="/privacidad">Privacidad y contacto</Link>
            <Link href="/">
              En Propiedades <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <Link className="broker-back-top" href="#sitio-inmobiliaria">
            Volver arriba <ArrowUp size={16} aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
