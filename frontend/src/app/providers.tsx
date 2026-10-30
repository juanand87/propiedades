"use client";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import CartDrawer from "@/components/CartDrawer";
import FloatingCartButton from "@/components/FloatingCartButton";
import WelcomeLocationModal from "@/components/WelcomeLocationModal";
import GlobalBottomNav from "@/components/GlobalBottomNav";
import StoreAdminBar from "@/components/StoreAdminBar";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RadioProvider } from "@/contexts/RadioContext";
import { Analytics } from "@vercel/analytics/next";

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  const [isCustomDomain, setIsCustomDomain] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STORE_DOMAINS_ENABLED === 'true' && typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const customDomain =
        hostname !== "localhost" &&
        hostname !== "127.0.0.1" &&
        hostname !== "mundobeat.cl" &&
        hostname !== "www.mundobeat.cl" &&
        !hostname.includes("vercel.app");

      const subdomain = hostname.endsWith(".mundobeat.cl") && hostname !== "mundobeat.cl" && hostname !== "www.mundobeat.cl";

      setIsCustomDomain(customDomain || subdomain);
    }
  }, []);

  // Cargar Eruda (consola móvil) en desarrollo
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.onload = () => {
        // @ts-ignore
        window.eruda?.init();
      };
      document.body.appendChild(script);
    }
  }, []);

  const isVendorStore = pathname?.startsWith('/tiendas/');
  const isDashboard = pathname?.startsWith('/dashboard');
  const isPanel = pathname?.startsWith('/panel');
  const isHomepage = pathname === '/';
  const isCategoria = pathname?.startsWith('/categoria');
  const isProducto = pathname?.startsWith('/productos/');
  const isPagina = pathname?.startsWith('/pagina/');
  const isLogin = pathname?.startsWith('/login');
  const isRegister = pathname?.startsWith('/register');
  const isProducts = pathname === '/products' || pathname?.startsWith('/products');
  const isVendors = pathname === '/vendors' || pathname?.startsWith('/vendors');
  const isEscalaGoldmine = pathname === '/escala-goldmine';
  const isCart = pathname === '/cart';
  const isMarketplacePresentation = pathname === '/presentacion-marketplace';
  const isVendorPortal = pathname === '/vendedores' || pathname?.startsWith('/vendedores/') || pathname?.startsWith('/compensacion/');

  const showMarketplaceRoutes = isLogin || isRegister || isProducts || isVendors || isEscalaGoldmine;

  const shouldHideMarketplaceHeader = isVendorStore || isDashboard || isPanel || isHomepage || isCart || isCustomDomain || isCategoria || isProducto || isPagina || !showMarketplaceRoutes;

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <RadioProvider>
              <StoreAdminBar />
              {!shouldHideMarketplaceHeader && <Header />}
              <main className="min-h-screen">
                {children}
              </main>
              {!shouldHideMarketplaceHeader && <Footer />}
              {!isDashboard && !isPanel && !isMarketplacePresentation && !isVendorPortal && <CartDrawer />}
              {!isCart && !isDashboard && !isPanel && !isMarketplacePresentation && !isVendorPortal && <FloatingCartButton />}
              {!isDashboard && !isPanel && !isMarketplacePresentation && !isVendorPortal && <WelcomeLocationModal />}
              {!isDashboard && !isPanel && !isMarketplacePresentation && !isVendorPortal && <GlobalBottomNav />}
            </RadioProvider>
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
      {process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true' && <Analytics />}
    </>
  );
}
