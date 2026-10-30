import { cache } from "react";

export const getServerProperty = cache(async (identifier: string) => {
  const configured =
    process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "";
  const api = /^https?:\/\//.test(configured)
    ? configured.replace(/\/$/, "")
    : "http://localhost:3001/api";
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
