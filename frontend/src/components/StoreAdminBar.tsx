"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, Edit3, ExternalLink, LayoutDashboard, PackagePlus, Settings, Store } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const DASHBOARD_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type VendorContext = {
  id: string;
  slug: string;
  storeName?: string;
};

type EditableContext = {
  productId?: string;
  pageId?: string;
};

function isMainMarketplaceHost(hostname: string) {
  return hostname === "mundobeat.cl" || hostname === "www.mundobeat.cl";
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getStoreSlugFromPath(pathname: string) {
  const match = pathname.match(/^\/tiendas\/([^/]+)/);
  return match?.[1] || null;
}

function getProductRefFromPath(pathname: string) {
  const storeProductMatch = pathname.match(/^\/tiendas\/[^/]+\/productos\/([^/?#]+)/);
  if (storeProductMatch?.[1]) return storeProductMatch[1];

  const cleanProductMatch = pathname.match(/^\/productos\/([^/?#]+)/);
  if (cleanProductMatch?.[1]) return cleanProductMatch[1];

  return null;
}

function getPageRefFromPath(pathname: string) {
  const storePageByIdMatch = pathname.match(/^\/tiendas\/[^/]+\/pagina\/id\/([^/?#]+)/);
  if (storePageByIdMatch?.[1]) return { type: "id", value: storePageByIdMatch[1] };

  const cleanPageByIdMatch = pathname.match(/^\/pagina\/id\/([^/?#]+)/);
  if (cleanPageByIdMatch?.[1]) return { type: "id", value: cleanPageByIdMatch[1] };

  const storePageMatch = pathname.match(/^\/tiendas\/[^/]+\/pagina\/([^/?#]+)/);
  if (storePageMatch?.[1]) return { type: "slug", value: storePageMatch[1] };

  const cleanPageMatch = pathname.match(/^\/pagina\/([^/?#]+)/);
  if (cleanPageMatch?.[1]) return { type: "slug", value: cleanPageMatch[1] };

  return null;
}

function dashboardUrl(path: string) {
  return `${DASHBOARD_ORIGIN}${path}`;
}

export default function StoreAdminBar() {
  const pathname = usePathname() || "/";
  const { user, loading, isAuthenticated } = useAuth();
  const [vendor, setVendor] = useState<VendorContext | null>(null);
  const [editable, setEditable] = useState<EditableContext>({});
  const [checking, setChecking] = useState(true);

  const isPossibleStoreRoute = useMemo(() => {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/panel") || pathname.startsWith("/admin")) return false;
    if (pathname.startsWith("/login") || pathname.startsWith("/register")) return false;
    return true;
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const loadContext = async () => {
      setChecking(true);
      setVendor(null);
      setEditable({});

      try {
        if (!isPossibleStoreRoute || typeof window === "undefined") return;

        const hostname = window.location.hostname;
        const storeSlug = getStoreSlugFromPath(pathname);
        let foundVendor: VendorContext | null = null;

        if (storeSlug) {
          foundVendor = await api.getVendorBySlug(storeSlug);
        } else if (hostname.endsWith(".mundobeat.cl") && !isMainMarketplaceHost(hostname)) {
          const slug = hostname.replace(".mundobeat.cl", "");
          foundVendor = await api.getVendorBySlug(slug);
        } else if (!isLocalHost(hostname) && !isMainMarketplaceHost(hostname) && !hostname.includes("vercel.app")) {
          foundVendor = await api.getVendorByDomain(hostname.replace(/^www\./, ""));
        }

        if (!foundVendor || cancelled) return;

        const canSeeBar = user?.role === "admin" || user?.vendorId === foundVendor.id;
        if (!canSeeBar) return;

        const nextEditable: EditableContext = {};
        const productRef = getProductRefFromPath(pathname);
        if (productRef) {
          try {
            const product = await api.getProduct(productRef);
            const productVendorId = product?.vendor?.id || product?.vendorId;
            if (product?.id && (user?.role === "admin" || productVendorId === foundVendor.id)) {
              nextEditable.productId = product.id;
            }
          } catch (error) {
            console.warn("No se pudo resolver el producto para la barra admin:", error);
          }
        }

        const pageRef = getPageRefFromPath(pathname);
        if (pageRef?.type === "id") {
          nextEditable.pageId = pageRef.value;
        } else if (pageRef?.type === "slug") {
          try {
            const page = await api.getPageBySlug(foundVendor.slug, pageRef.value);
            if (page?.id) nextEditable.pageId = page.id;
          } catch (error) {
            console.warn("No se pudo resolver la pagina para la barra admin:", error);
          }
        }

        if (!cancelled) {
          setVendor(foundVendor);
          setEditable(nextEditable);
        }
      } catch (error) {
        console.warn("No se pudo cargar la barra admin de tienda:", error);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    if (!loading && isAuthenticated && (user?.role === "vendor" || user?.role === "admin")) {
      loadContext();
    } else {
      setChecking(false);
      setVendor(null);
      setEditable({});
    }

    return () => {
      cancelled = true;
    };
  }, [pathname, loading, isAuthenticated, user?.role, user?.vendorId, isPossibleStoreRoute]);

  useEffect(() => {
    if (!vendor || typeof document === "undefined") return;

    const previousPaddingTop = document.body.style.paddingTop;
    document.body.style.paddingTop = "36px";

    return () => {
      document.body.style.paddingTop = previousPaddingTop;
    };
  }, [vendor]);

  if (loading || checking || !vendor) return null;
  const links = [
    { label: "Dashboard", href: dashboardUrl("/dashboard"), icon: LayoutDashboard },
    { label: "Personalizar", href: dashboardUrl("/dashboard/settings"), icon: Settings },
    { label: "Nuevo producto", href: dashboardUrl("/dashboard/products/new"), icon: PackagePlus },
    { label: "Productos", href: dashboardUrl("/dashboard/products"), icon: Boxes },
    { label: "Pedidos", href: dashboardUrl("/dashboard/orders"), icon: Store },
    { label: "Estadisticas", href: dashboardUrl("/dashboard/estadisticas"), icon: BarChart3 },
  ];

  return (
    <div className="fixed left-0 right-0 top-0 z-[9999] h-9 bg-gray-950 text-white shadow-lg print:hidden">
      <div className="mx-auto flex h-full max-w-[1300px] items-center gap-2 px-3 text-xs md:text-sm">
        <Link
          href={dashboardUrl("/dashboard")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-2 font-semibold hover:text-white/90"
        >
          <Store className="h-4 w-4 flex-shrink-0" />
          <span className="hidden sm:inline truncate">{vendor.storeName || vendor.slug}</span>
          <span className="sm:hidden">Admin</span>
        </Link>

        <div className="h-4 w-px bg-white/20" />

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {editable.productId && (
            <Link
              href={dashboardUrl(`/dashboard/products/${editable.productId}/edit`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded bg-white/10 px-2 py-1 font-semibold text-white transition-colors hover:bg-white/20"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Editar producto</span>
            </Link>
          )}

          {editable.pageId && (
            <Link
              href={dashboardUrl(`/dashboard/pages/${editable.pageId}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded bg-white/10 px-2 py-1 font-semibold text-white transition-colors hover:bg-white/20"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Editar pagina</span>
            </Link>
          )}
        </nav>

        <Link
          href={dashboardUrl(`/tiendas/${vendor.slug}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden shrink-0 items-center gap-1 rounded px-2 py-1 text-white/75 hover:bg-white/10 hover:text-white md:flex"
          title="Abrir tienda desde MundoBeat"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Ver tienda</span>
        </Link>
      </div>
    </div>
  );
}