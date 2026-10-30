"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import OnboardingWizard from "@/components/admin/OnboardingWizard";
import { ClipboardList, LayoutDashboard, Menu, MessageCircle, PackagePlus, ScanBarcode, Settings, ShoppingCart, Star, X } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [storeName, setStoreName] = useState("Mi Tienda");
  const [storeSlug, setStoreSlug] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isNavigationActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    // Si estamos en login o cambiar-password, no verificar autenticación
    if (pathname === "/dashboard/login" || pathname === "/dashboard/cambiar-password") {
      setLoading(false);
      return;
    }

    checkAuth();
  }, [pathname]);

  const checkAuth = async () => {
    // Verificar si hay token
    const token = api.getToken();
    if (!token) {
      router.push("/dashboard/login");
      return;
    }

    // Verificar si necesita cambiar contraseña (sin el wizard)
    try {
      const profile = await api.getProfile();
      // Si necesita cambiar contraseña, el wizard se encargará
      // Solo redirigir al cambiar-password si NO hay onboarding pendiente
      if (profile.requirePasswordChange) {
        // Check if the vendor needs onboarding (new store flow)
        try {
          const settings = await api.getMyVendorSettings();
          if (settings.onboardingCompleted === false) {
            // Let the wizard handle the password change
            await loadVendorInfo();
            setShowOnboarding(true);
            setLoading(false);
            return;
          }
        } catch {
          // If settings check fails, fall through to legacy password change
        }
        router.push("/dashboard/cambiar-password");
        return;
      }
    } catch (error) {
      console.error("Error checking password change requirement:", error);
    }

    // Cargar información del vendor
    await loadVendorInfo();

    // Check if onboarding is completed
    try {
      const settings = await api.getMyVendorSettings();
      if (settings.onboardingCompleted === false) {
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error("Error checking onboarding status:", error);
    }

    setLoading(false);
  };

  const loadVendorInfo = async () => {
    try {
      const vendor = await api.getMyVendor();
      if (vendor.storeName) {
        setStoreName(vendor.storeName);
      }
      if (vendor.slug) {
        setStoreSlug(vendor.slug);
      }
      if (vendor.id) {
        setVendorId(vendor.id);
      }
    } catch (error) {
      console.error("Error loading vendor info:", error);
      // Si falla, redirigir a login
      router.push("/dashboard/login");
    }
  };

  // Si estamos en login o cambiar-password, renderizar solo el contenido sin layout
  if (pathname === "/dashboard/login" || pathname === "/dashboard/cambiar-password") {
    return <>{children}</>;
  }

  // Mostrar loading mientras verifica autenticación
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  // Show onboarding wizard for new vendors
  if (showOnboarding && vendorId) {
    return (
      <OnboardingWizard
        vendorId={vendorId}
        storeName={storeName}
        storeSlug={storeSlug}
        onComplete={() => {
          setShowOnboarding(false);
          router.push("/dashboard");
        }}
      />
    );
  }

  return (
    <div className="dashboard-admin-shell flex min-h-screen bg-[var(--dashboard-bg)]">
      {/* Sidebar */}
      <aside className={`${pathname === "/dashboard/pos" ? "hidden" : "hidden md:flex"} dashboard-sidebar w-64 relative flex-col`}>
        <div className="dashboard-sidebar-brand p-5 border-b">
          <div className="flex items-center gap-3 mb-2">
            <div className="dashboard-store-mark w-10 h-10 rounded-md flex items-center justify-center text-white font-bold text-xl">
              {storeName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-slate-950 font-semibold text-sm">{storeName}</h2>
              <p className="text-slate-500 text-xs">Administrador</p>
            </div>
          </div>
        </div>

        <nav className="dashboard-sidebar-nav p-3 space-y-1">
          <Link href="/dashboard" aria-current={isNavigationActive('/dashboard') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="text-sm">Dashboard</span>
            </div>
          </Link>
          
          <Link href="/dashboard/products" aria-current={isNavigationActive('/dashboard/products') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span className="text-sm">Productos</span>
            </div>
          </Link>
          
          <Link href="/dashboard/inventario" aria-current={isNavigationActive('/dashboard/inventario') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 rounded-md px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white"><ClipboardList className="h-5 w-5" /><span className="text-sm">Revisión de inventario</span></div>
          </Link>
          <Link href="/dashboard/orders" aria-current={isNavigationActive('/dashboard/orders') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="text-sm">Ventas</span>
            </div>
          </Link>

          <Link href="/dashboard/preguntas" aria-current={isNavigationActive('/dashboard/preguntas') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">Preguntas</span>
            </div>
          </Link>

          <Link href="/dashboard/calificaciones" aria-current={isNavigationActive('/dashboard/calificaciones') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <Star className="h-5 w-5" />
              <span className="text-sm">Calificaciones</span>
            </div>
          </Link>

          <Link href="/dashboard/pos" aria-current={isNavigationActive('/dashboard/pos') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3m-8-4h3m-3 4h3m5-9V3m0 0l-3 3m3-3l3 3" />
              </svg>
              <span className="text-sm">Punto de Venta</span>
            </div>
          </Link>

          <Link href="/dashboard/estadisticas" aria-current={isNavigationActive('/dashboard/estadisticas') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm">Estadísticas</span>
            </div>
          </Link>
          
          <Link href="/dashboard/pages" aria-current={isNavigationActive('/dashboard/pages') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm">Páginas</span>
            </div>
          </Link>
          
          <Link href="/dashboard/biblioteca" aria-current={isNavigationActive('/dashboard/biblioteca') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">Biblioteca</span>
            </div>
          </Link>
          
          <Link href="/dashboard/estado-cuenta" aria-current={isNavigationActive('/dashboard/estado-cuenta') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M9 14h.01M12 11h.01M12 14h.01M15 11h.01M15 14h.01M5 20h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">Estado de cuenta</span>
            </div>
          </Link>

          <Link href="/dashboard/settings" aria-current={isNavigationActive('/dashboard/settings') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm">Configuración</span>
            </div>
          </Link>

          <div className="px-4 py-2 mt-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Envíos</p>
          </div>

          <div className="px-4 py-2 mt-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Funciones IA</p>
          </div>

          <Link href="/dashboard/ai/products" aria-current={isNavigationActive('/dashboard/ai/products') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-sm">Productos</span>
            </div>
          </Link>

          <Link href="/dashboard/ai/images" aria-current={isNavigationActive('/dashboard/ai/images') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">Imágenes</span>
            </div>
          </Link>

          <Link href="/dashboard/ai/marketing" aria-current={isNavigationActive('/dashboard/ai/marketing') ? 'page' : undefined} className="cursor-pointer block">
            <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200 group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <span className="text-sm">Marketing</span>
            </div>
          </Link>
        </nav>

        <div className="mt-auto">
          {storeSlug && (
            <div className="p-3 border-t border-slate-200">
              <Link href={`/tiendas/${storeSlug}`} className="cursor-pointer block">
                <div className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:bg-slate-700/50 hover:text-white rounded-lg transition-all duration-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="text-sm">Ver mi tienda</span>
                </div>
              </Link>
            </div>
          )}
          
          <div className="p-3 border-t border-slate-200">
            <button
              onClick={() => {
                api.removeToken();
                router.push("/");
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-slate-700/50 hover:text-red-300 rounded-lg transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-sm">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={pathname === "/dashboard/pos" ? "min-w-0 flex-1 bg-slate-100 pb-20 md:pb-0" : "dashboard-main flex-1 p-4 md:p-7 pb-24 md:pb-8 bg-[var(--dashboard-bg)]"}>
        <div className={pathname === "/dashboard/pos" ? "h-full text-[var(--dashboard-text)]" : "max-w-7xl mx-auto text-[var(--dashboard-text)]"}>
          {children}
        </div>
      </main>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-[55] bg-slate-950/45 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed bottom-[76px] right-3 z-[60] w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl md:hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Menú de la tienda</p>
                <p className="text-xs text-slate-500">{storeName}</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú"
                className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-2">
              {pathname === "/dashboard/pos" && (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  <LayoutDashboard className="h-5 w-5 text-cyan-600" />
                  Volver al dashboard
                </Link>
              )}
              {pathname !== "/dashboard/pos" && (
                <Link
                  href="/dashboard/pos"
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  <ShoppingCart className="h-5 w-5 text-cyan-600" />
                  Punto de venta
                </Link>
              )}
              {pathname.startsWith("/dashboard/products") && (
                <Link
                  href="/dashboard/products/new"
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  <PackagePlus className="h-5 w-5 text-cyan-600" />
                  Agregar producto
                </Link>
              )}
              <Link href="/dashboard/inventario" className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"><ClipboardList className="h-5 w-5 text-cyan-600" />Revisión de inventario</Link>
              <Link
                href="/dashboard/preguntas"
                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                <MessageCircle className="h-5 w-5 text-cyan-600" />
                Preguntas
              </Link>
              <Link
                href="/dashboard/calificaciones"
                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                <Star className="h-5 w-5 text-cyan-600" />
                Calificaciones
              </Link>
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                <Settings className="h-5 w-5 text-cyan-600" />
                Configuración
              </Link>
            </nav>
          </div>
        </>
      )}

      {/* Mobile bottom nav */}
      <nav className="dashboard-mobile-nav fixed bottom-0 left-0 right-0 z-50 md:hidden border-t flex items-center justify-around px-2 py-2 shadow-lg">
        <Link href="/dashboard" className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          <span className="text-[10px]">Inicio</span>
        </Link>
        <Link href="/dashboard/products" className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          <span className="text-[10px]">Productos</span>
        </Link>
        {pathname === "/dashboard/pos" ? (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-pos-scanner"))}
            className="flex min-w-[60px] -mt-4 flex-col items-center gap-0.5 rounded-xl bg-gray-100 px-3 py-2 text-gray-700 shadow-md"
          >
            <ScanBarcode className="h-6 w-6" />
            <span className="text-[10px] font-bold">Escanear</span>
          </button>
        ) : (
          <Link href="/dashboard/escanear" className="flex min-w-[60px] -mt-4 flex-col items-center gap-0.5 rounded-xl bg-gray-100 px-3 py-2 text-gray-700 shadow-md">
            <ScanBarcode className="h-6 w-6" />
            <span className="text-[10px] font-bold">Escanear</span>
          </Link>
        )}
        <Link href="/dashboard/orders" className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          <span className="text-[10px]">Pedidos</span>
        </Link>
        <button
          type="button"
          aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 ${mobileMenuOpen ? "text-cyan-400" : "text-slate-400 hover:text-white"}`}
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px]">Menú</span>
        </button>
      </nav>
    </div>
  );
}
