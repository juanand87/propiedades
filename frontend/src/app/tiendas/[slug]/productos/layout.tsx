import type { Metadata } from "next";
import { ReactNode } from "react";
import { SEO_API_URL, storeSeoBase } from '@/lib/seoCatalog';

const API_URL = SEO_API_URL;
const BASE_URL = getSiteUrl();

type Props = {
  params: Promise<{ slug: string }>;
  children: ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const res = await fetch(`${API_URL}/vendors/slug/${slug}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error("vendor not found");

    const vendor = await res.json();
    const storeName = vendor.storeName || slug;
    const description = vendor.bio
      ? vendor.bio.slice(0, 155)
      : `Explora el catálogo completo de ${storeName} en MundoBeat. Vinilos, CDs y más.`;

    const imageUrl = vendor.logo
      ? vendor.logo.startsWith("http")
        ? vendor.logo
        : `http://localhost:3001/${vendor.logo}`
      : `${BASE_URL}/og-default.jpg`;

    const url = `${storeSeoBase(vendor, slug)}/productos`;

    return {
      title: `Catálogo de ${storeName}`,
      description,
      alternates: { canonical: url },
      openGraph: {
        title: `Catálogo de ${storeName} | MundoBeat`,
        description,
        url,
        images: [{ url: imageUrl, width: 400, height: 400, alt: storeName }],
        type: "website",
      },
      twitter: {
        card: "summary",
        title: `Catálogo de ${storeName} | MundoBeat`,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return {
      title: `Catálogo de tienda`,
      description: "Explora el catálogo de esta tienda en MundoBeat.",
    };
  }
}

export default function ProductosLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
import { getSiteUrl } from '@/lib/siteUrl';
