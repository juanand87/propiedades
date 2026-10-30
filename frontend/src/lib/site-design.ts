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
    primary_color: "#285d50",
    accent_color: "#c9964e",
    background_color: "#f8f8f3",
    text_color: "#203e38",
    logo_media_id: null,
    hero_media_id: null,
    hero_alt: "Propiedad destacada en la portada",
    show_site_name: true,
    sections: Object.keys(sectionNames).map((id) => ({ id, visible: true })),
  };
}
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
