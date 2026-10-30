import { cache } from "react";
import { getServerApiUrl } from "./deployment";

export const getServerAdvertiser = cache(async (slug: string) => {
  try {
    const response = await fetch(
      `${getServerApiUrl()}/advertisers/${encodeURIComponent(slug)}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (response.status === 404) return null;
    return response.ok ? await response.json() : undefined;
  } catch {
    return undefined;
  }
});

export const getServerSettings = cache(async () => {
  try {
    const response = await fetch(`${getServerApiUrl()}/settings`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? await response.json() : undefined;
  } catch {
    return undefined;
  }
});

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
