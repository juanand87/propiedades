"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { applyThemeToDocument } from "@/lib/colorThemes";
import { getReturnsPolicySettings } from "@/lib/returnsPolicy";
import ReturnsPolicyContent from "@/components/policies/ReturnsPolicyContent";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";

export default function StoreReturnsPolicyPage({ vendorSlug }: { vendorSlug: string }) {
  const [vendor, setVendor] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const vendorData = await api.getVendorBySlug(vendorSlug);
        const vendorSettings = await api.getVendorSettings(vendorData.id, false);
        if (!active) return;
        setVendor(vendorData);
        setSettings(vendorSettings);
        if (vendorSettings?.colorTheme) {
          applyThemeToDocument(vendorSettings.colorTheme, vendorSettings.customColors);
        }
      } catch (requestError: any) {
        if (active) setError(requestError?.message || "No se pudo cargar esta política");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [vendorSlug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-600">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-sky-600" />
        Cargando política...
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Política no disponible</h1>
          <p className="mt-2 text-sm text-slate-600">{error || "No encontramos esta tienda."}</p>
        </div>
      </div>
    );
  }

  const storeName = vendor.storeName || vendor.name || vendorSlug;
  const policy = getReturnsPolicySettings(settings?.policies);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      <StoreHeader vendor={vendor} settings={settings} slug={vendorSlug} />

      <main>
        <section className="relative min-h-[330px] overflow-hidden border-b border-slate-200 bg-white sm:min-h-[390px]">
          <img
            src="/images/returns-policy-hero.webp"
            alt="Producto y paquete preparados para una devolución"
            className="absolute inset-0 h-full w-full object-cover object-[62%_center]"
          />
          <div className="absolute inset-0 bg-white/20" />
          <div className="relative mx-auto flex min-h-[330px] max-w-7xl items-center px-5 py-12 sm:min-h-[390px] sm:px-8">
            <div className="max-w-xl">
              <a href="/" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-sky-700">
                <ArrowLeft className="h-4 w-4" /> Volver a la tienda
              </a>
              <p className="mb-3 text-sm font-bold uppercase text-sky-700">Compra con información clara</p>
              <h1 className="max-w-lg text-3xl font-bold leading-tight text-slate-950 sm:text-5xl">
                Cambios, devoluciones y garantía legal
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-700 sm:text-lg">
                Revisa tus derechos y el proceso aplicable a las compras realizadas en {storeName}.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <ReturnsPolicyContent
            storeName={storeName}
            additionalConditions={policy.additionalConditions}
          />

          <aside className="mt-10 border-t border-slate-200 pt-6 text-xs leading-5 text-slate-500">
            Información general basada en los criterios publicados por el Servicio Nacional del Consumidor.
            Consulta las fuentes oficiales sobre{" "}
            <a className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline" href="https://www.sernac.cl/portal/618/w3-propertyvalue-8062.html" target="_blank" rel="noopener noreferrer">
              garantía legal <ExternalLink className="h-3 w-3" />
            </a>{" "}
            y{" "}
            <a className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline" href="https://www.sernac.cl/portal/604/w3-article-11727.html" target="_blank" rel="noopener noreferrer">
              comercio electrónico <ExternalLink className="h-3 w-3" />
            </a>.
          </aside>
        </div>
      </main>

      <StoreFooter footerConfig={settings?.footerConfig} vendorSlug={vendorSlug} />
    </div>
  );
}

function StoreHeader({ vendor, settings, slug }: { vendor: any; settings: any; slug: string }) {
  const rawHeaderType = settings?.headerType ?? "type1";
  const headerType = String(rawHeaderType).startsWith("type")
    ? String(rawHeaderType)
    : `type${rawHeaderType}`;
  const config = {
    ...settings?.headerConfig,
    menus: settings?.menus,
    customMenus: settings?.customMenus,
    headerConfig: settings?.headerConfig || {},
  };

  if (headerType === "type2") return <HeaderType2 vendor={vendor} config={config} slug={slug} />;
  if (headerType === "type3") return <HeaderType3 vendor={vendor} config={config} slug={slug} />;
  return <HeaderType1 vendor={vendor} config={config} slug={slug} />;
}
