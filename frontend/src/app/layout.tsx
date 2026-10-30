import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import Providers from "./providers";
import { getSiteUrl } from "@/lib/siteUrl";

const inter = Inter({
  subsets: ["latin"],
});

const BASE_URL = getSiteUrl();

const baseMetadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "MundoBeat, el marketplace de vinilos, CDs y musica fisica en Chile",
    template: "%s | MundoBeat",
  },
  description: "Compra vinilos, CDs, cassettes y musica fisica en tiendas de musica de Chile. Encuentra discos nuevos, usados y coleccionables en MundoBeat.",
  openGraph: {
    siteName: "MundoBeat",
    type: "website",
    locale: "es_CL",
    url: BASE_URL,
    title: "MundoBeat, el marketplace de vinilos, CDs y musica fisica en Chile",
    description: "Compra vinilos, CDs, cassettes y musica fisica en tiendas de musica de Chile.",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "MundoBeat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MundoBeat, el marketplace de vinilos, CDs y musica fisica en Chile",
    description: "Compra vinilos, CDs, cassettes y musica fisica en tiendas de musica de Chile.",
    images: ["/og-default.jpg"],
  },
};

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getGoogleVerificationCode() {
  try {
    const requestHeaders = await headers();
    const rawHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
    const hostname = rawHost.split(":")[0].replace(/^www\./, "").toLowerCase();
    let vendor: any;

    if (!hostname || ["localhost", "127.0.0.1", "mundobeat.cl"].includes(hostname) || hostname.includes("vercel.app")) {
      const response = await fetch(`${API_URL}/vendors/${MARKETPLACE_VENDOR_ID}`, { cache: "no-store" });
      if (response.ok) vendor = await response.json();
    } else if (hostname.endsWith(".mundobeat.cl")) {
      const slug = hostname.replace(".mundobeat.cl", "");
      const response = await fetch(`${API_URL}/vendors/slug/${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (response.ok) vendor = await response.json();
    } else {
      const response = await fetch(`${API_URL}/vendors/domain/${encodeURIComponent(hostname)}`, { cache: "no-store" });
      if (response.ok) vendor = await response.json();
    }

    if (!vendor?.id) return "";
    const settingsResponse = await fetch(`${API_URL}/vendors/${vendor.id}/settings`, { cache: "no-store" });
    if (!settingsResponse.ok) return "";
    const settings = await settingsResponse.json();
    return String(settings?.headerConfig?.marketing?.googleMerchant?.verificationCode || "").trim();
  } catch {
    return "";
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const googleVerification = await getGoogleVerificationCode();
  const requestHeaders = await headers();
  const hostname = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "")
    .split(",")[0].trim().split(":")[0].toLowerCase();
  const codes = [googleVerification];
  if (["mundobeat.cl", "www.mundobeat.cl"].includes(hostname)) {
    codes.push("UALq7L9pCK-ACmaTm_hke4r0yNB2VsPZ7V2Zqy4KWyg");
  }
  const verificationCodes = [...new Set(codes.filter(Boolean))];
  return verificationCodes.length
    ? { ...baseMetadata, verification: { google: verificationCodes } }
    : baseMetadata;
}

const jsonLdWebSite = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MundoBeat',
  url: BASE_URL,
  description: 'Marketplace de vinilos, CDs, cassettes y musica fisica en Chile.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${BASE_URL}/productos?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

const jsonLdOrganization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MundoBeat',
  url: BASE_URL,
  logo: `${BASE_URL}/og-default.jpg`,
  sameAs: [],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebSite) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }}
        />
        {/* Script inline para aplicar tema ANTES de que React renderice (evita FOUC) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('marketplace-theme');
                  if (stored) {
                    var theme = JSON.parse(stored);
                    var styleEl = document.createElement('style');
                    styleEl.id = 'theme-bg-override';
                    styleEl.textContent = 'html, body { background-color: ' + theme.bgSite + ' !important; background-image: none !important; } .min-h-screen { background-color: ' + theme.bgSite + ' !important; background-image: none !important; } .theme-gradient-bg { background: linear-gradient(135deg, ' + theme.primary + ' 0%, ' + theme.secondary + ' 100%) !important; background-image: linear-gradient(135deg, ' + theme.primary + ' 0%, ' + theme.secondary + ' 100%) !important; }';
                    document.head.appendChild(styleEl);
                    document.documentElement.style.setProperty('--color-primary', theme.primary);
                    document.documentElement.style.setProperty('--color-secondary', theme.secondary);
                    document.documentElement.style.setProperty('--color-accent', theme.accent);
                    document.documentElement.style.setProperty('--color-bg-site', theme.bgSite);
                    document.documentElement.style.setProperty('--color-bg-page', theme.bgPage);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
