import { NextRequest, NextResponse } from "next/server";
import { fetchSeoProducts, SEO_API_URL as API_URL, SEO_SITE_URL, storeSeoBase } from '@/lib/seoCatalog';
import { getProductPrice, getProductGtin, getProductBrandName } from '@/lib/productSeo';

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

function normalizeHost(host: string) {
  return host.split(":")[0].replace(/^www\./, "").toLowerCase();
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function toList(data: any) {
  return Array.isArray(data) ? data : data?.products || data?.data || [];
}

async function fetchAllProducts(vendorId: string, marketplace = false) {
  return fetchSeoProducts(marketplace ? { marketplaceOnly: 'true' } : { vendorId });
}


function normalizeArray(value: any) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(",").map((item: string) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function productImages(product: any) {
  const rawImages = normalizeArray(product?.images)
    .map((image: any) => typeof image === "string" ? image : image?.url)
    .filter(Boolean);
  const metaImages = normalizeArray(product?.imagesMeta);

  // La galería es la fuente de verdad del orden. imagesMeta puede conservar un
  // orden antiguo después de arrastrar imágenes, por lo que se empareja por URL.
  return rawImages
    .map((url: string) => {
      const matchingMeta = metaImages.find((meta: any) =>
        meta?.large700Url === url || meta?.originalUrl === url,
      );
      return matchingMeta?.large700Url || url;
    })
    .filter((url: string, index: number, images: string[]) => images.indexOf(url) === index);
}

function versionedPrimaryImage(url: string, product: any) {
  const version = product?.updatedAt
    ? new Date(product.updatedAt).getTime()
    : "merchant-primary-v2";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}mb_primary=${encodeURIComponent(String(version))}`;
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

async function resolveVendor(hostname: string) {
  if (["localhost", "127.0.0.1", "mundobeat.cl"].includes(hostname) || hostname.includes("vercel.app")) {
    return fetchJson(`${API_URL}/vendors/${MARKETPLACE_VENDOR_ID}`);
  }
  if (hostname.endsWith(".mundobeat.cl")) {
    const slug = hostname.replace(".mundobeat.cl", "");
    return fetchJson(`${API_URL}/vendors/slug/${encodeURIComponent(slug)}`);
  }
  return fetchJson(`${API_URL}/vendors/domain/${encodeURIComponent(hostname)}`);
}

export async function GET(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const hostname = normalizeHost(forwardedHost);
  const marketplace = ["localhost", "127.0.0.1", "mundobeat.cl"].includes(hostname) || hostname.includes('vercel.app');
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const vendor = await resolveVendor(hostname);

  if (!vendor?.id) {
    return new NextResponse("Tienda no encontrada", { status: 404 });
  }
  const baseUrl = marketplace ? SEO_SITE_URL : storeSeoBase(vendor, vendor.slug);

  const [settings, productsResponse] = await Promise.all([
    fetchJson(`${API_URL}/vendors/${vendor.id}/settings`),
    fetchAllProducts(vendor.id, marketplace),
  ]);
  const merchantConfig = settings?.headerConfig?.marketing?.googleMerchant || {};
  if (merchantConfig.enabled === false) {
    return new NextResponse("Feed de Google Merchant desactivado", { status: 404 });
  }

  const configuredCondition = merchantConfig.condition || "all";
  const products = productsResponse.filter((product: any) => {
    if (product.status !== 'active') return false;
    return configuredCondition === "all" || product.condition === configuredCondition;
  });

  const items = products.map((product: any) => {
    const images = productImages(product);
    const image = images[0] ? versionedPrimaryImage(images[0], product) : "";
    if (!image || !Number(product.price)) return "";
    const title = product.title || [product.artist, product.album].filter(Boolean).join(" - ");
    const description = stripHtml(product.shortDescription || product.description || title).slice(0, 5000);
    const productUrl = `${baseUrl}/productos/${encodeURIComponent(product.slug || product.id)}`;
    const condition = product.condition === "used" ? "used" : "new";
    const format = product.format || product.formats?.[0]?.name || product.type || "Música física";
    const gtin = getProductGtin(product);
    const identifier = gtin ? `<g:gtin>${gtin}</g:gtin>` : product.catalogNumber ? `<g:mpn>${escapeXml(product.catalogNumber)}</g:mpn>` : '';
    const additionalImages = images.slice(1, 11)
      .map((url: string) => `<g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`)
      .join("\n      ");

    return `
    <item>
      <g:id>${escapeXml(marketplace && product.vendorId !== vendor.id ? product.id : product.sku || product.id)}</g:id>
      <title>${escapeXml(title)}</title>
      <description>${escapeXml(description)}</description>
      <link>${escapeXml(productUrl)}</link>
      <g:image_link>${escapeXml(image)}</g:image_link>
      ${additionalImages}
      <g:availability>${Number(product.stock) > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:price>${getProductPrice(product).toFixed(2)} CLP</g:price>
      <g:condition>${condition}</g:condition>
      ${getProductBrandName(product) ? `<g:brand>${escapeXml(getProductBrandName(product))}</g:brand>` : ''}
      <g:product_type>${escapeXml(format)}</g:product_type>
      <g:google_product_category>Media &gt; Music &amp; Sound Recordings</g:google_product_category>
      ${identifier}
    </item>`;
  }).filter(Boolean).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(vendor.storeName || vendor.name || "Tienda MundoBeat")}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Catálogo de productos para Google Merchant Center</description>${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
