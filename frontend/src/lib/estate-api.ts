const configured = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(
  /\/$/,
  "",
);
export const API_URL = configured.endsWith("/api")
  ? configured
  : `${configured}/api`;
export function assetUrl(path?: string) {
  if (!path) return "/architecture.svg";
  if (path.startsWith("/api/")) return `${API_URL}${path.slice(4)}`;
  return path;
}
export async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("propiedades:token")
      : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || "No pudimos completar la solicitud.",
    );
  return data;
}
export const send = (path: string, body: unknown, method = "POST") =>
  request(path, { method, body: JSON.stringify(body) });
export const labels: Record<string, string> = {
  house: "Casa",
  apartment: "Departamento",
  plot: "Parcela",
  land: "Terreno",
  commercial: "Local comercial",
  office: "Oficina",
  draft: "Borrador",
  pending_review: "En revisión",
  published: "Publicada",
  paused: "Pausada",
  rejected: "Rechazada",
  archived: "Archivada",
  available: "Disponible",
  reserved: "Reservada",
  sold: "Vendida",
  owner: "Propietario",
  broker: "Corredor",
  agency: "Inmobiliaria",
  pending: "Pendiente",
  approved: "Aprobado",
  suspended: "Suspendido",
  new: "Nuevo",
  contacted: "Contactado",
  closed: "Cerrado",
  requested: "Solicitada",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Realizada",
  admin: "Administrador",
  vendor: "Anunciante",
  customer: "Interesado",
};
export function price(value: unknown, unit = "CLP") {
  if (value === null || value === undefined || value === "")
    return "Precio por definir";
  const raw = String(value);
  if (!/^\d+(\.\d{1,4})?$/.test(raw)) return "Precio por definir";
  const [whole, fraction = ""] = raw.split(".");
  const grouped = new Intl.NumberFormat("es-CL").format(BigInt(whole));
  const decimals = fraction.replace(/0+$/, "");
  return unit === "UF"
    ? `UF ${grouped}${decimals ? "," + decimals : ""}`
    : `$${grouped}`;
}
export function date(value: string) {
  return value
    ? new Intl.DateTimeFormat("es-CL", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Santiago",
      }).format(
        new Date(
          /Z$|[+-]\d\d:\d\d$/.test(value)
            ? value
            : value.replace(" ", "T") + "Z",
        ),
      )
    : "";
}
