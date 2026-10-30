"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, House, Mail, Menu, Phone, X } from "lucide-react";
import { assetUrl, labels, request } from "@/lib/estate-api";
import { defaultBrokerDesign, designStyle } from "@/lib/site-design";
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
  const base = `/anunciantes/${a.slug}`;
  const visible = d.sections.filter((s: any) => s.visible);
  const shows = (id: string) => visible.some((s: any) => s.id === id);
  const contactHref = shows("contact")
    ? `${base}#contacto`
    : a.phone
      ? `tel:${a.phone.replace(/[^+\d]/g, "")}`
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
        </div>
        <div className="broker-contact-links">
          {a.phone && (
            <a
              className="button outline"
              href={`tel:${a.phone.replace(/[^+\d]/g, "")}`}
            >
              <Phone size={18} />
              {a.phone}
            </a>
          )}
          {a.whatsapp && (
            <a
              className="button"
              href={`https://wa.me/${a.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              Conversar por WhatsApp
              <ArrowUpRight size={18} />
            </a>
          )}
          {a.public_email && (
            <a className="button outline" href={`mailto:${a.public_email}`}>
              <Mail size={18} />
              {a.public_email}
            </a>
          )}
          {!a.phone && !a.whatsapp && !a.public_email && (
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
      className={`estate-site broker-site${!propertyIdentifier && visible[0]?.id === "hero" ? " has-cover-hero" : ""}`}
      style={designStyle(d)}
    >
      <header className="site-header broker-header">
        <Link
          className="brand"
          href={base}
          aria-label={`${a.display_name}, inicio`}
        >
          {brand}
        </Link>
        <nav
          className={`main-nav${menu ? " open" : ""}`}
          aria-label="Navegación del sitio del anunciante"
        >
          {visible.map((s: any) => (
            <Link
              key={s.id}
              href={`${base}#${anchors[s.id]}`}
              onClick={() => setMenu(false)}
            >
              {navNames[s.id]}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          {user?.advertiser_id === a.id ? (
            <Link
              className="button small"
              href={user.role === "admin" ? "/panel/sitio" : "/dashboard/sitio"}
            >
              Editar mi sitio
            </Link>
          ) : (
            (shows("contact") || a.phone) && (
              <Link className="button small" href={contactHref}>
                Contactar
                <ArrowUpRight size={16} />
              </Link>
            )
          )}
          <button
            className="mobile-toggle"
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
      <footer className="site-footer broker-footer">
        <div>
          <Link className="brand" href={base}>
            {brand}
          </Link>
          <p>
            © {new Date().getFullYear()} {a.display_name}
          </p>
        </div>
        <div>
          <Link href="/">
            Explorar el marketplace Propiedades
            <ArrowUpRight size={16} />
          </Link>
          <Link href="/privacidad">Privacidad y contacto</Link>
        </div>
      </footer>
    </div>
  );
}
