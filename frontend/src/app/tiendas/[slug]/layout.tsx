// Server component layout — provides SSR metadata for vendor store pages
// The page.tsx remains a client component and is NOT modified
import { Metadata } from 'next';
import Script from 'next/script';
import { SEO_API_URL, storeSeoBase } from '@/lib/seoCatalog';

const API_URL = SEO_API_URL;
const BASE_URL = getSiteUrl();

async function fetchVendor(slug: string) {
  try {
    const res = await fetch(`${API_URL}/vendors/slug/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchVendorSettings(vendorId: string) {
  try {
    const res = await fetch(`${API_URL}/vendors/${vendorId}/settings`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await fetchVendor(slug);

  if (!vendor) {
    return { title: 'Tienda no encontrada | MundoBeat' };
  }

  const settings = await fetchVendorSettings(vendor.id);
  const seoConfig = settings?.headerConfig?.seo || {};

  const storeName = vendor.storeName || slug;
  const bio = vendor.bio || vendor.description || '';
  const title = seoConfig.metaTitle?.trim() || `${storeName} | Tienda de música en MundoBeat`;
  const description = seoConfig.metaDescription?.trim()
    ? seoConfig.metaDescription.trim()
    : bio
      ? bio.slice(0, 155) + (bio.length > 155 ? '...' : '')
      : `Descubre el catálogo de ${storeName} en MundoBeat. Vinilos, CDs y más.`;

  const storeUrl = storeSeoBase(vendor, slug);

  const logoImage = seoConfig.ogImage?.trim()
    ? seoConfig.ogImage.trim()
    : vendor.logo
    ? (vendor.logo.startsWith('http')
        ? vendor.logo
        : `http://localhost:3001/${vendor.logo}`)
    : `${BASE_URL}/og-default.jpg`;

  return {
    title,
    description,
    alternates: { canonical: storeUrl },
    openGraph: {
      title,
      description,
      url: storeUrl,
      type: 'website',
      images: [{ url: logoImage, width: 400, height: 400, alt: storeName }],
      siteName: 'MundoBeat',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [logoImage],
    },
  };
}

export default function VendorStoreLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  return <VendorStoreLayoutInner params={params}>{children}</VendorStoreLayoutInner>;
}

async function VendorStoreLayoutInner({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const vendor = await fetchVendor(slug);
  const settings = vendor ? await fetchVendorSettings(vendor.id) : null;
  const marketing = settings?.headerConfig?.marketing || {};

  const gaId = (marketing.googleAnalyticsId || '').trim();
  const fbPixelId = (marketing.facebookPixelId || '').trim();

  return (
    <>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id={`ga4-${gaId}`} strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${gaId}');`}
          </Script>
        </>
      )}

      {fbPixelId && (
        <>
          <Script id={`fb-pixel-${fbPixelId}`} strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod? n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js'); fbq('init', '${fbPixelId}'); fbq('track', 'PageView');`}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${fbPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {children}
    </>
  );
}
import { getSiteUrl } from '@/lib/siteUrl';
