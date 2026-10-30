import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EstateApp from "@/components/EstateApp";
import { getSiteUrl } from "@/lib/siteUrl";
import { getServerProperty, getServerSettings } from "@/lib/server-property";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ path?: string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path = [] } = await params;
  if (path[0] === "propiedades" && path[1]) {
    try {
      const p = await getServerProperty(path[1]);
      if (p) {
        return {
          title: `${p.title} en ${p.commune_name}`,
          description: (p.summary || p.description).slice(0, 180),
          alternates: { canonical: `${getSiteUrl()}/propiedades/${p.slug}` },
          openGraph: {
            title: p.title,
            description: p.summary || p.description.slice(0, 180),
            images: p.media?.[0]?.url
              ? [
                  {
                    url: new URL(p.media[0].url, getSiteUrl()).toString(),
                    alt: p.title,
                  },
                ]
              : undefined,
          },
        };
      }
    } catch {}
  }
  return {
    robots:
      path[0] === "panel" ||
      path[0] === "dashboard" ||
      path[0] === "cuenta" ||
      path[0] === "favoritos"
        ? { index: false, follow: false }
        : undefined,
  };
}
export default async function Page({ params }: Props) {
  const { path = [] } = await params;
  if (
    ![
      "",
      "propiedades",
      "anunciantes",
      "login",
      "register",
      "panel",
      "dashboard",
      "favoritos",
      "cuenta",
      "informacion",
      "privacidad",
    ].includes(path[0] || "")
  )
    notFound();
  const [initialProperty, initialSettings] = await Promise.all([
    path[0] === "propiedades" && path[1]
      ? getServerProperty(path[1])
      : undefined,
    getServerSettings(),
  ]);
  if (initialProperty === null) notFound();
  return (
    <EstateApp
      path={path}
      initialProperty={initialProperty}
      initialSettings={initialSettings}
    />
  );
}
