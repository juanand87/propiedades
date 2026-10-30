import type { Metadata } from "next";
import { ReactNode } from "react";

const BASE_URL = getSiteUrl();

export const metadata: Metadata = {
  title: "Tiendas de música independiente en Chile",
  description: "Descubre todas las tiendas de música independiente en MundoBeat. Vinilos, CDs, cassettes y más de vendedores de toda Chile.",
  alternates: { canonical: `${BASE_URL}/tiendas` },
  openGraph: {
    title: "Tiendas de música independiente en Chile | MundoBeat",
    description: "Descubre todas las tiendas de música independiente en MundoBeat. Vinilos, CDs, cassettes y más de vendedores de toda Chile.",
    url: `${BASE_URL}/tiendas`,
    images: [{ url: `${BASE_URL}/og-default.jpg`, width: 1200, height: 630, alt: "MundoBeat Tiendas" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tiendas de música independiente en Chile | MundoBeat",
    description: "Descubre todas las tiendas de música independiente en MundoBeat.",
    images: [`${BASE_URL}/og-default.jpg`],
  },
};

export default function TiendasLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}
import { getSiteUrl } from '@/lib/siteUrl';
