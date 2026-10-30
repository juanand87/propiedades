import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EstateApp from "@/components/EstateApp";
import { getSiteUrl } from "@/lib/siteUrl";
import {
  getServerProperty,
  getServerSettings,
  getServerAdvertiser,
} from "@/lib/server-property";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ path?: string[] }> };
const propertyIdentifier = (path: string[]) =>
  path[0] === "propiedades"
    ? path[1]
    : path[0] === "anunciantes" && path[2] === "propiedades"
      ? path[3]
      : undefined;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path = [] } = await params;
  const advertiser =
    path[0] === "anunciantes" && path[1]
      ? await getServerAdvertiser(path[1])
      : undefined;
  const identifier = propertyIdentifier(path);
  if (advertiser && !identifier) {
    const title = advertiser.site?.hero_title || advertiser.display_name;
    const image = advertiser.site?.hero_url || advertiser.site?.logo_url;
    const url = `${getSiteUrl()}/anunciantes/${advertiser.slug}`;
    return {
      title: {
        absolute:
          title === advertiser.display_name
            ? title
            : `${title} | ${advertiser.display_name}`,
      },
      description: (
        advertiser.site?.hero_subtitle ||
        advertiser.description ||
        ""
      ).slice(0, 180),
      alternates: { canonical: url },
      openGraph: {
        title,
        url,
        images: image ? [new URL(image, getSiteUrl()).toString()] : undefined,
      },
    };
  }
  if (identifier) {
    try {
      const p = await getServerProperty(identifier);
      if (p && (!advertiser || p.advertiser?.id === advertiser.id)) {
        return {
          title: advertiser
            ? {
                absolute: `${p.title} en ${p.commune_name} | ${advertiser.display_name}`,
              }
            : `${p.title} en ${p.commune_name}`,
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
  const brokerSlug = path[0] === "anunciantes" ? path[1] : undefined;
  if (
    brokerSlug &&
    path.length > 2 &&
    (path[2] !== "propiedades" || !path[3] || path.length !== 4)
  )
    notFound();
  const identifier = propertyIdentifier(path);
  const [initialProperty, initialSettings, initialAdvertiser] =
    await Promise.all([
      identifier ? getServerProperty(identifier) : undefined,
      getServerSettings(),
      brokerSlug ? getServerAdvertiser(brokerSlug) : undefined,
    ]);
  if (initialProperty === null || initialAdvertiser === null) notFound();
  if (
    initialAdvertiser &&
    initialProperty &&
    initialProperty.advertiser?.id !== initialAdvertiser.id
  )
    notFound();
  return (
    <EstateApp
      path={path}
      initialProperty={initialProperty}
      initialSettings={initialSettings}
      initialAdvertiser={initialAdvertiser}
    />
  );
}
