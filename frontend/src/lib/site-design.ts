import type { CSSProperties } from "react";

export const sectionNames: Record<string, string> = {
  hero: "Portada principal",
  search: "Buscador",
  types: "Tipos de propiedad",
  listings: "Últimas propiedades",
  publish: "Invitación a publicar",
};
export const brokerSectionNames: Record<string, string> = {
  hero: "Portada principal",
  about: "Acerca de nosotros",
  listings: "Mis propiedades",
  contact: "Contacto",
};
export type SiteContact = { phone: string; whatsapp: string; email: string };
export const socialNetworks = [
  {
    id: "instagram",
    name: "Instagram",
    placeholder: "https://www.instagram.com/tuinmobiliaria",
  },
  {
    id: "facebook",
    name: "Facebook",
    placeholder: "https://www.facebook.com/tuinmobiliaria",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    placeholder: "https://www.linkedin.com/company/tuinmobiliaria",
  },
  {
    id: "youtube",
    name: "YouTube",
    placeholder: "https://www.youtube.com/@tuinmobiliaria",
  },
  {
    id: "tiktok",
    name: "TikTok",
    placeholder: "https://www.tiktok.com/@tuinmobiliaria",
  },
  { id: "x", name: "X / Twitter", placeholder: "https://x.com/tuinmobiliaria" },
];
export function marketplaceFooterText(d: SiteDesign) {
  return (
    d.footer_text ??
    "Un lugar para comenzar algo nuevo.\nPropiedades y personas, más cerca."
  );
}
export function brokerFooterText(d: SiteDesign, name: string) {
  return (
    d.footer_text ??
    `Un nuevo lugar comienza con una buena conversación. Encuentra tu próxima propiedad con ${name}.`
  );
}
export function brokerContact(d: SiteDesign, profile: any): SiteContact {
  return (
    d.footer_contact ?? {
      phone: profile.phone || "",
      whatsapp: profile.whatsapp || "",
      email: profile.public_email || "",
    }
  );
}
export type HeaderLink = { label: string; href: string; new_tab: boolean };
export type HeaderStyle = {
  logo_height: number;
  height: number;
  background_color: string | null;
  text_color: string | null;
  hover_color: string | null;
  button_color: string | null;
  button_text_color: string | null;
};
export function defaultHeaderStyle(): HeaderStyle {
  return {
    logo_height: 40,
    height: 80,
    background_color: null,
    text_color: null,
    hover_color: null,
    button_color: null,
    button_text_color: null,
  };
}
export type SiteDesign = {
  header_style?: HeaderStyle | null;
  header_links?: HeaderLink[] | null;
  header_button?: (HeaderLink & { visible: boolean }) | null;
  footer_text?: string | null;
  footer_contact_title?: string;
  footer_note?: string;
  footer_contact?: SiteContact | null;
  footer_socials?: { network: string; url: string }[];
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  logo_media_id: string | null;
  hero_media_id: string | null;
  hero_alt: string;
  hero_mode?: "image" | "slider";
  hero_slides?: { media_id: string; alt_text: string; url?: string }[];
  hero_autoplay?: boolean;
  hero_interval?: number;
  show_site_name: boolean;
  sections: { id: string; visible: boolean }[];
  logo_url?: string | null;
  hero_url?: string | null;
  hero_title?: string;
  hero_subtitle?: string;
  about_title?: string;
  about_text?: string;
  listings_title?: string;
  contact_title?: string;
};
export function defaultDesign(): SiteDesign {
  return {
    header_style: null,
    header_links: null,
    header_button: null,
    footer_text: null,
    footer_contact_title: "Hablemos de tu próximo lugar",
    footer_note:
      "Las consultas y visitas se coordinan directamente con el anunciante.",
    footer_contact: null,
    footer_socials: [],
    primary_color: "#075ce5",
    accent_color: "#d9a553",
    background_color: "#f6f8fc",
    text_color: "#102b50",
    logo_media_id: null,
    hero_media_id: null,
    hero_alt: "Propiedad destacada en la portada",
    hero_mode: "image",
    hero_slides: [],
    hero_autoplay: true,
    hero_interval: 6,
    show_site_name: true,
    sections: Object.keys(sectionNames).map((id) => ({ id, visible: true })),
  };
}
export const colorThemes = [
  {
    id: "marino",
    name: "Marino",
    description: "Clásico y confiable",
    primary_color: "#173b6c",
    accent_color: "#caa66a",
    background_color: "#f4f7fc",
    text_color: "#182c47",
  },
  {
    id: "esmeralda",
    name: "Esmeralda",
    description: "Luminoso y natural",
    primary_color: "#08734f",
    accent_color: "#cda750",
    background_color: "#f1faf6",
    text_color: "#163d30",
  },
  {
    id: "rubi",
    name: "Rubí",
    description: "Cálido y con carácter",
    primary_color: "#a32c49",
    accent_color: "#cfaa6b",
    background_color: "#fff6f7",
    text_color: "#452330",
  },
  {
    id: "indigo",
    name: "Índigo",
    description: "Creativo y moderno",
    primary_color: "#5145a0",
    accent_color: "#d5ad62",
    background_color: "#f6f5ff",
    text_color: "#292547",
  },
  {
    id: "oliva",
    name: "Oliva",
    description: "Tierra y tranquilidad",
    primary_color: "#58652b",
    accent_color: "#c2a06c",
    background_color: "#f9faf1",
    text_color: "#30391f",
  },
  {
    id: "chocolate",
    name: "Chocolate",
    description: "Elegante y acogedor",
    primary_color: "#754b35",
    accent_color: "#c8a06c",
    background_color: "#fcf7f2",
    text_color: "#392b24",
  },
  {
    id: "azul",
    name: "Azul portal",
    description: "Claro y contemporáneo",
    primary_color: "#075ce5",
    accent_color: "#d9a553",
    background_color: "#f6f8fc",
    text_color: "#102b50",
  },
  {
    id: "bosque",
    name: "Bosque",
    description: "Natural y cercano",
    primary_color: "#285d50",
    accent_color: "#c9964e",
    background_color: "#f8f8f3",
    text_color: "#203e38",
  },
  {
    id: "oceano",
    name: "Océano",
    description: "Fresco y sereno",
    primary_color: "#00677b",
    accent_color: "#d1ab62",
    background_color: "#f2fafb",
    text_color: "#12363f",
  },
  {
    id: "grafito",
    name: "Grafito",
    description: "Sobrio y elegante",
    primary_color: "#253449",
    accent_color: "#c79a5e",
    background_color: "#f5f6f8",
    text_color: "#152235",
  },
  {
    id: "terracota",
    name: "Terracota",
    description: "Cálido y acogedor",
    primary_color: "#9a472f",
    accent_color: "#c49b60",
    background_color: "#fbf6f2",
    text_color: "#3c2924",
  },
  {
    id: "ciruela",
    name: "Ciruela",
    description: "Distinto y sofisticado",
    primary_color: "#703861",
    accent_color: "#d5aa6c",
    background_color: "#faf5f9",
    text_color: "#342138",
  },
];
export function defaultBrokerDesign(profile: any = {}): SiteDesign {
  return {
    ...defaultDesign(),
    footer_note: "",
    logo_media_id: profile.logo_media_id || null,
    hero_title: profile.display_name || "Tu próximo lugar comienza aquí.",
    hero_subtitle: "Propiedades, asesoría y atención personalizada.",
    about_title: "Conócenos",
    about_text: profile.description || "",
    listings_title: "Nuestras propiedades",
    contact_title: "Conversemos",
    sections: Object.keys(brokerSectionNames).map((id) => ({
      id,
      visible: true,
    })),
  };
}
export function siteDesign(settings: { design?: SiteDesign }): SiteDesign {
  return settings.design || defaultDesign();
}
export function designStyle(d: SiteDesign): CSSProperties {
  const h = d.header_style;
  return {
    ...(h
      ? {
          "--header-logo-height": `${h.logo_height}px`,
          "--header-height": `${Math.max(h.height, h.logo_height + 24)}px`,
          "--header-background": h.background_color ?? "#ffffff",
          "--header-text": h.text_color ?? d.text_color,
          "--header-hover": h.hover_color ?? d.primary_color,
          "--header-button": h.button_color ?? d.primary_color,
          "--header-button-text": h.button_text_color ?? "#ffffff",
        }
      : {}),
    "--green": d.primary_color,
    "--accent": d.accent_color,
    "--paper": d.background_color,
    "--ink": d.text_color,
    "--muted": `color-mix(in srgb, ${d.text_color} 80%, ${d.background_color})`,
  } as CSSProperties;
}

export const brokerAnchors: Record<string, string> = {
  hero: "inicio",
  about: "nosotros",
  listings: "propiedades",
  contact: "contacto",
};
export function headerPresets(broker: boolean, d: SiteDesign): HeaderLink[] {
  if (broker)
    return d.sections
      .filter((section) => section.visible)
      .map((section) => ({
        label: (
          {
            hero: "Inicio",
            about: "Nosotros",
            listings: "Propiedades",
            contact: "Contacto",
          } as Record<string, string>
        )[section.id],
        href: "#" + brokerAnchors[section.id],
        new_tab: false,
      }));
  return [
    { label: "Inicio", href: "/", new_tab: false },
    { label: "Buscar propiedades", href: "/propiedades", new_tab: false },
    { label: "Anunciantes", href: "/anunciantes", new_tab: false },
    { label: "Nosotros", href: "/informacion", new_tab: false },
    { label: "Publicar propiedad", href: "/register", new_tab: false },
    { label: "Ingresar", href: "/login", new_tab: false },
  ];
}
export function headerLinks(d: SiteDesign, broker = false): HeaderLink[] {
  const defaults = broker
    ? headerPresets(true, d)
    : headerPresets(false, d).slice(1, 4);
  const links = d.header_links ?? defaults;
  return broker
    ? links.filter((item) => {
        const section = Object.entries(brokerAnchors).find(
          ([, anchor]) => item.href === "#" + anchor,
        )?.[0];
        return (
          !section || d.sections.some((s) => s.id === section && s.visible)
        );
      })
    : links;
}
export function headerHref(href: string, base = "/") {
  return href.startsWith("#") ? base + href : href;
}
