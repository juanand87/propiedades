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
export class EstateApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function saveBrowserSession(session: {
  access_token: string;
  refresh_token?: string;
  user: unknown;
}) {
  localStorage.setItem("propiedades:token", session.access_token);
  if (session.refresh_token)
    localStorage.setItem("propiedades:refresh", session.refresh_token);
  else localStorage.removeItem("propiedades:refresh");
  localStorage.setItem("propiedades:user", JSON.stringify(session.user));
}
export function clearBrowserSession() {
  localStorage.removeItem("propiedades:token");
  localStorage.removeItem("propiedades:refresh");
  localStorage.removeItem("propiedades:user");
}
let renewing: Promise<void> | undefined;
async function renewBrowserSession() {
  if (!renewing)
    renewing = (async () => {
      const refresh = localStorage.getItem("propiedades:refresh");
      if (!refresh) throw new EstateApiError("Inicia sesión nuevamente.", 401);
      const r = await fetch(API_URL + "/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ refresh_token: refresh }),
        cache: "no-store",
      });
      if (!r.ok)
        throw new EstateApiError("No se pudo renovar la sesión.", r.status);
      const session = await r.json();
      if (localStorage.getItem("propiedades:refresh") !== refresh)
        throw new EstateApiError("La sesión cambió.", 401);
      saveBrowserSession(session);
    })().finally(() => {
      renewing = undefined;
    });
  return renewing;
}
export async function restoreBrowserSession() {
  if (!localStorage.getItem("propiedades:token")) return null;
  try {
    if (localStorage.getItem("propiedades:refresh")) {
      await renewBrowserSession();
      return await request("/auth/profile");
    }
    const session = await request("/auth/session", {
      method: "POST",
      body: "{}",
    });
    saveBrowserSession(session);
    return session.user;
  } catch (e) {
    if (e instanceof EstateApiError && e.status === 401) {
      clearBrowserSession();
      return null;
    }
    try {
      return JSON.parse(localStorage.getItem("propiedades:user") || "null");
    } catch {
      return null;
    }
  }
}
export async function request(
  path: string,
  options: RequestInit = {},
  retried = false,
) {
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
  if (
    response.status === 401 &&
    token &&
    !retried &&
    typeof window !== "undefined" &&
    localStorage.getItem("propiedades:refresh")
  ) {
    await renewBrowserSession();
    return request(path, options, true);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new EstateApiError(
      Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || "No pudimos completar la solicitud.",
      response.status,
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
