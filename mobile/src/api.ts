import { Platform } from "react-native";
import { fetch } from "expo/fetch";

export type Property = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_amount: string;
  price_unit: string;
  commune_name: string;
  region_name: string;
  bedrooms: number | null;
  bathrooms: number | null;
  built_area: string | null;
  land_area?: string | null;
  type_id?: string;
  operation_type?: string;
  publication_status?: string;
  is_demo: boolean;
  media: { id: string; url: string; alt_text: string }[];
  advertiser: {
    name: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
  };
};
export type Video = {
  hls_url?: string | null;
  id: string;
  thumbnail_url?: string;
  property_id: string | null;
  title: string;
  url: string;
  property: Property | null;
};
export type ManagedVideo = {
  id: string;
  title: string;
  status: "draft" | "published";
  size_bytes: number;
  duration_ms?: number;
  capture_seconds?: number;
};
export type Session = {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    role: string;
    advertiser_id?: string;
    account_type?: "buyer" | "seller" | null;
  };
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pages: number;
};

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:3328/api"
    : "http://127.0.0.1:3328/api");
export const IS_PRODUCTION = process.env.EXPO_PUBLIC_ENV === "production";
const production = IS_PRODUCTION;
const allowed = production
  ? ["https://clownfish-app-2-bgbzm.ondigitalocean.app/api"]
  : [
      "http://10.0.2.2:3328/api",
      "http://127.0.0.1:3328/api",
      "http://localhost:3328/api",
    ];
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
if (!allowed.includes(API_URL))
  throw new Error(
    "La API configurada no corresponde al entorno de Propiedades seleccionado.",
  );
export function mediaUrl(url: string) {
  const hls =
    /^\/api\/videos\/[a-f0-9-]{36}\/hls\/master\.m3u8\?v=[a-f0-9-]{36}(?:&signature=[A-Za-z0-9_.%\-]+)?$/i.test(
      url,
    );
  if (
    !hls &&
    !/^\/api\/(media|videos)\/[a-f0-9-]{36}(\/(content|preview|thumbnail))?(\?signature=[^\s]*)?$/i.test(
      url,
    )
  )
    throw new Error("Archivo local inválido.");
  return API_URL.replace(/\/api$/, "") + url;
}
export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Ruta inválida.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(
    abort,
    options.body instanceof FormData ? 120000 : 20000,
  );
  try {
    const form = options.body instanceof FormData;
    const r = await fetch(API_URL + path, {
      method: options.method || "GET",
      headers: {
        ...(options.body && !form
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body
        ? form
          ? (options.body as FormData)
          : JSON.stringify(options.body)
        : undefined,
      signal: controller.signal,
    });
    const value = await r
      .json()
      .catch(() => ({ message: "Respuesta no válida del servidor local." }));
    if (!r.ok)
      throw new ApiError(
        r.status === 401
          ? "La sesión venció o las credenciales son incorrectas."
          : String(value.message || "No se pudo completar la operación."),
        r.status,
      );
    return value as T;
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error(
        "La conexión se canceló o tardó demasiado. Intenta nuevamente.",
      );
    if (e instanceof TypeError)
      throw new Error(
        "No hay conexión con la API local. Inicia npm run mobile:backend desde la raíz.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
export async function checkEnvironment() {
  const env = await api<{
    project: string;
    environment: string;
    videos: boolean;
    apiVersion: number;
  }>("/mobile/environment");
  if (
    env.project !== "propiedades" ||
    env.environment !== (production ? "production" : "local-mobile") ||
    !env.videos ||
    env.apiVersion !== 2
  )
    throw new Error("El servidor no es el entorno local móvil esperado.");
}
export function price(p: Property) {
  return `${p.price_unit === "CLP" ? "$" : p.price_unit} ${Number(p.price_amount).toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;
}
