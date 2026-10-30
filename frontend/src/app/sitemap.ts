import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { getServerApiUrl } from "@/lib/deployment";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl(),
    result: MetadataRoute.Sitemap = [
      { url: site },
      { url: `${site}/propiedades` },
      { url: `${site}/anunciantes` },
    ];
  const base = getServerApiUrl();
  try {
    for (let page = 1; page <= 1000; page++) {
      const r = await fetch(`${base}/properties?limit=48&page=${page}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) break;
      const data = await r.json();
      for (const p of data.items)
        result.push({
          url: `${site}/propiedades/${p.slug}`,
          lastModified: p.updated_at,
        });
      if (page >= data.pages) break;
    }
  } catch {}
  return result;
}
