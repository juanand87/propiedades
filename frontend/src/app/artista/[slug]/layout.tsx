import type { Metadata } from "next";
import { ReactNode } from "react";

const BASE_URL = getSiteUrl();

type Props = {
  params: Promise<{ slug: string }>;
  children: ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const artistName = slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const title = `${artistName} — Discografía en MundoBeat`;
  const description = `Encuentra vinilos, CDs y productos de ${artistName} en MundoBeat. Compra música de ${artistName} directo a los vendedores independientes.`;
  const url = `${BASE_URL}/artista/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title}`,
      description,
      url,
      images: [{ url: `${BASE_URL}/og-default.jpg`, width: 1200, height: 630, alt: artistName }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}/og-default.jpg`],
    },
  };
}

export default function ArtistaSlugLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
import { getSiteUrl } from '@/lib/siteUrl';
