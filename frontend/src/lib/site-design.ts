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
export type SiteDesign = {
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
  return {
    "--green": d.primary_color,
    "--accent": d.accent_color,
    "--paper": d.background_color,
    "--ink": d.text_color,
    "--muted": `color-mix(in srgb, ${d.text_color} 80%, ${d.background_color})`,
  } as CSSProperties;
}
