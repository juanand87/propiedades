// Public endpoints belonging exclusively to Propiedades. Environment variables
// can override them when moving this project to another backend or domain.
export const PRODUCTION_API_URL =
  "https://clownfish-app-2-bgbzm.ondigitalocean.app/api";
export const PRODUCTION_SITE_URL = "https://propiedades-eta.vercel.app";

export function getServerApiUrl() {
  const configured = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  const base =
    configured && /^https?:\/\//.test(configured)
      ? configured.replace(/\/$/, "")
      : process.env.VERCEL === "1"
        ? PRODUCTION_API_URL
        : "http://localhost:3001/api";
  return base.endsWith("/api") ? base : `${base}/api`;
}
