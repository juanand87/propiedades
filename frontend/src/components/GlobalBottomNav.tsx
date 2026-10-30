"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BottomNavBar from "./BottomNavBar";
import StoreBottomNavBar from "./StoreBottomNavBar";
import { api } from "@/lib/api";

export default function GlobalBottomNav() {
  const pathname = usePathname();
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [vendorSlug, setVendorSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectVendorSlug = async () => {
      setLoading(true);
      
      // Detectar si es custom domain
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const customDomain = 
          hostname !== "localhost" &&
          hostname !== "127.0.0.1" &&
          hostname !== "mundobeat.cl" &&
          hostname !== "www.mundobeat.cl" &&
          !hostname.includes("vercel.app");
        
        setIsCustomDomain(customDomain);

        // Si es custom domain, obtener el vendorSlug
        if (customDomain) {
          try {
            // Para subdominios
            if (hostname.endsWith(".mundobeat.cl")) {
              const slug = hostname.split('.')[0];
              setVendorSlug(slug);
            } else {
              // Para dominios personalizados, buscar en settings
              // Por ahora, intentamos obtener del middleware que ya procesó la request
              // Como alternativa, podríamos tener un endpoint para resolver por hostname
              const response = await api.getVendors();
              const vendor = response.find((v: any) => v.customDomain === hostname);
              if (vendor) {
                setVendorSlug(vendor.slug);
              }
            }
          } catch (error) {
            console.error('Error detecting vendor from custom domain:', error);
          }
        }
      }
      
      // Si estamos en /tiendas/[slug], extraer el slug
      const match = pathname?.match(/^\/tiendas\/([^\/]+)/);
      if (match) {
        setVendorSlug(match[1]);
      }

      setLoading(false);
    };

    detectVendorSlug();
  }, [pathname]);

  if (loading) return null;

  // Si estamos en una tienda o custom domain, mostrar StoreBottomNavBar
  const isVendorStore = pathname?.startsWith('/tiendas/');
  if ((isVendorStore || isCustomDomain) && vendorSlug) {
    return <StoreBottomNavBar vendorSlug={vendorSlug} />;
  }

  // Mostrar BottomNavBar del marketplace
  return <BottomNavBar />;
}
