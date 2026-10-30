import { PRODUCTION_SITE_URL } from "./deployment";

export function getSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL) {
  const url = new URL(
    value ||
      (process.env.NODE_ENV === "production"
        ? PRODUCTION_SITE_URL
        : "http://localhost:3000"),
  );
  if (/mundobeat|clownfish-app-x3a5k|tiendas-chi/i.test(url.hostname))
    throw new Error("Configura el dominio propio de Propiedades.");
  return url.origin;
}
