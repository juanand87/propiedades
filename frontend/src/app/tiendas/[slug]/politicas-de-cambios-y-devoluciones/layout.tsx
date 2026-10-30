import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchVendor(slug: string) {
  try {
    const response = await fetch(`${API_URL}/vendors/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await fetchVendor(slug);
  const storeName = vendor?.storeName || slug;
  const host = vendor?.customDomain
    ? `https://${String(vendor.customDomain).replace(/^https?:\/\//, "").replace(/\/$/, "")}`
    : `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/tiendas/${slug}`;
  const url = `${host}/politicas-de-cambios-y-devoluciones`;
  const title = `Políticas de cambios y devoluciones | ${storeName}`;
  const description = `Conoce los plazos de retracto, garantía legal, costos y proceso de devolución de ${storeName}.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: storeName,
      images: [{ url: `${host}/images/returns-policy-hero.webp`, width: 1672, height: 941 }],
    },
  };
}

export default function ReturnsPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
