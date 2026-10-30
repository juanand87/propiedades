import { cache } from "react";
import { getServerApiUrl } from "./deployment";

export const getServerProperty = cache(async (identifier: string) => {
  const api = getServerApiUrl();
  try {
    const response = await fetch(
      `${api}/properties/${encodeURIComponent(identifier)}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (response.status === 404) return null;
    return response.ok ? await response.json() : undefined;
  } catch {
    return undefined;
  }
});
