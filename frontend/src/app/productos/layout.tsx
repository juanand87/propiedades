import type { Metadata } from "next";
import { ReactNode } from "react";

const BASE_URL = getSiteUrl();

export const metadata: Metadata = {
  title: "Vinilos, CDs, cassettes y musica fisica en Chile",
  description: "Explora vinilos, CDs, cassettes y musica fisica en el marketplace MundoBeat. Encuentra discos nuevos, usados y coleccionables en tiendas de Chile.",
  alternates: { canonical: `${BASE_URL}/productos` },
  openGraph: {
    title: "Vinilos, CDs, cassettes y musica fisica en Chile | MundoBeat",
    description: "Explora vinilos, CDs, cassettes y musica fisica en tiendas de musica de Chile.",
    url: `${BASE_URL}/productos`,
    images: [{ url: `${BASE_URL}/og-default.jpg`, width: 1200, height: 630, alt: "MundoBeat Productos" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vinilos, CDs, cassettes y musica fisica en Chile | MundoBeat",
    description: "Explora vinilos, CDs, cassettes y musica fisica en tiendas de musica de Chile.",
    images: [`${BASE_URL}/og-default.jpg`],
  },
};

export default function ProductosLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
import { getSiteUrl } from '@/lib/siteUrl';
