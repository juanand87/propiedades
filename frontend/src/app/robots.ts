import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      ...(process.env.SITE_INDEX_ENABLED === "true"
        ? {
            allow: "/",
            disallow: ["/panel", "/dashboard", "/api", "/cuenta", "/favoritos"],
          }
        : { disallow: "/" }),
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
