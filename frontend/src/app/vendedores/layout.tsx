import type { Metadata } from "next";
import { VendorPortalShell } from "@/components/vendor-portal/VendorPortalShell";

export const metadata: Metadata = {
  title: "Portal de Vendedores",
  description: "Crea tu tienda, administra productos, pedidos, pagos, envíos e integraciones desde MundoBeat.",
};

export default function VendorsPortalLayout({ children }: { children: React.ReactNode }) {
  return <VendorPortalShell>{children}</VendorPortalShell>;
}
