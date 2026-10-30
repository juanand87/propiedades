import { api, API_URL } from "./api";

export async function inventoryRequest(
  path: string,
  method = "GET",
  data?: unknown,
) {
  const form = typeof FormData !== "undefined" && data instanceof FormData;
  const token = api.getToken();
  if (!token)
    throw Object.assign(
      new Error("Tu sesión no está disponible. Vuelve a iniciar sesión."),
      { status: 401 },
    );
  let response: Response;
  try {
    response = await fetch(`${API_URL}/inventory/${path}`, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(!form ? { "Content-Type": "application/json" } : {}),
      },
      ...(data !== undefined
        ? { body: form ? (data as FormData) : JSON.stringify(data) }
        : {}),
    });
  } catch {
    throw Object.assign(
      new Error(
        "No se pudo conectar con el inventario. Revisa tu conexión y reintenta.",
      ),
      { status: 0 },
    );
  }
  const body = await response.text();
  let result: any;
  try {
    result = JSON.parse(body);
  } catch {
    /* A proxy may return HTML rather than the API error. */
  }
  const statusMessages: Record<number, string> = {
    401: "Tu sesión venció o no es válida. Vuelve a iniciar sesión.",
    403: "Esta cuenta no tiene permisos para realizar esta operación de inventario.",
    404: "El servidor no reconoce esta ruta de inventario. Revisa el despliegue del backend.",
    412: "Inventario pendiente de preparación. La administración debe activarlo desde Panel → Inventario físico → Preparar módulo.",
    500: "El backend tuvo un error interno. Revisa los registros del servidor.",
    502: "No se pudo comunicar con el backend. Revisa el estado del despliegue.",
    503: "El servidor de inventario no está disponible. Revisa el backend o reintenta en unos instantes.",
    504: "El servidor tardó demasiado en responder. Comprueba el resultado antes de repetir la operación.",
  };
  const message = Array.isArray(result?.message)
    ? result.message
        .filter((value: unknown) => typeof value === "string")
        .join(", ")
    : typeof result?.message === "string"
      ? result.message
      : "";
  if (!response.ok)
    throw Object.assign(
      new Error(
        `${[401, 403].includes(response.status) ? statusMessages[response.status] : message || statusMessages[response.status] || "La solicitud de inventario fue rechazada."} (HTTP ${response.status})`,
      ),
      { status: response.status },
    );
  if (response.status === 204) return null;
  if (result === undefined)
    throw Object.assign(
      new Error(
        `El servidor devolvió una respuesta inválida para el inventario (HTTP ${response.status}).`,
      ),
      { status: response.status },
    );
  return result;
}

export const inventoryStatuses: Record<string, string> = {
  counting: "En conteo",
  review: "En revisión",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

export function inventoryWouldExceedStock(
  stock: number,
  counted: number,
): boolean {
  return (
    Math.max(0, Number(counted) || 0) + 1 > Math.max(0, Number(stock) || 0)
  );
}
export const inventoryButton =
  "inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50";
export const inventoryCaptureButton =
  "flex h-28 w-full min-w-0 flex-col items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-3 text-center text-base font-semibold leading-tight text-cyan-900 hover:bg-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 disabled:opacity-50";
export const inventoryPrimary =
  "inline-flex items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50";
export const inventoryInput =
  "w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
