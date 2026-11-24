import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";
import "./modern.css";
import { BrowserSessionProvider } from "@/components/BrowserSessionProvider";
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Propiedades | Encuentra tu próximo lugar",
    template: "%s | Propiedades",
  },
  description:
    "Casas, departamentos, parcelas y terrenos en Chile. Encuentra una propiedad y contacta directamente al anunciante.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CL">
      <body>
        <BrowserSessionProvider>{children}</BrowserSessionProvider>
      </body>
    </html>
  );
}
