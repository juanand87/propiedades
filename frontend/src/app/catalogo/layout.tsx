import type { Metadata } from "next";
import { ReactNode } from "react";

const BASE_URL = getSiteUrl();

export const metadata: Metadata = {
  title: "Catalogo general de vinilos, CDs y musica fisica",
  description:
    "Explora el catalogo general de MundoBeat: vinilos, CDs, cassettes y musica fisica disponible en tiendas de musica de Chile.",
  alternates: { canonical: `${BASE_URL}/catalogo` },
  openGraph: {
    title: "Catalogo general de vinilos, CDs y musica fisica | MundoBeat",
    description:
      "Explora vinilos, CDs, cassettes y musica fisica disponible en tiendas de musica de Chile.",
    url: `${BASE_URL}/catalogo`,
    type: "website",
    siteName: "MundoBeat",
    images: [{ url: `${BASE_URL}/og-default.jpg`, width: 1200, height: 630, alt: "Catalogo MundoBeat" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catalogo general de vinilos, CDs y musica fisica | MundoBeat",
    description:
      "Explora vinilos, CDs, cassettes y musica fisica disponible en tiendas de musica de Chile.",
    images: [`${BASE_URL}/og-default.jpg`],
  },
};

export default function CatalogoLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
import { getSiteUrl } from '@/lib/siteUrl';
