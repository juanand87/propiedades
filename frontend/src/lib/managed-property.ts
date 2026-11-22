export type ManagedProperty = {
  id: string;
  title: string;
  slug: string;
  code: string;
  publication_status: string;
  availability: string;
  revision: number;
  featured: boolean;
  moderation_reason?: string;
  commune_id?: string;
  commune_name?: string;
  region_name?: string;
  type_id: string;
  description?: string;
  price_amount?: string | number | null;
  price_unit: string;
  built_area?: number | string | null;
  land_area?: number | string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  updated_at?: string;
  show_exact_address?: boolean;
  location?: { address?: string } | null;
  advertiser: { name: string };
  media: { id: string; url: string }[];
  insights?: {
    views: number;
    favorites: number;
    inquiries: number;
    new_inquiries: number;
    video_count: number | null;
    published_videos: number | null;
  } | null;
};

// Matches the existing publication requirements; this is guidance, never authorization.
export function propertyMissingFields(p: ManagedProperty): string[] {
  const missing: string[] = [];
  if ((p.title || "").trim().length < 8)
    missing.push("título de al menos 8 caracteres");
  if ((p.description || "").trim().length < 40)
    missing.push("descripción de al menos 40 caracteres");
  if (!(Number(p.price_amount) > 0)) missing.push("precio");
  if (!p.commune_id) missing.push("comuna");
  if (!p.media.length) missing.push("al menos una fotografía");
  if (["house", "apartment"].includes(p.type_id)) {
    if (!(Number(p.built_area) > 0)) missing.push("superficie construida");
    if (p.bedrooms == null) missing.push("dormitorios");
    if (p.bathrooms == null) missing.push("baños");
  }
  if (
    ["house", "plot", "land"].includes(p.type_id) &&
    !(Number(p.land_area) > 0)
  )
    missing.push("superficie del terreno");
  if (p.show_exact_address && !p.location?.address)
    missing.push("dirección autorizada");
  return missing;
}
