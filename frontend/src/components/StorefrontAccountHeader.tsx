"use client";

import { useEffect, useState } from "react";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import { api } from "@/lib/api";
import { applyThemeToDocument } from "@/lib/colorThemes";

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

export default function StorefrontAccountHeader() {
  const [vendor, setVendor] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const loadHeader = async () => {
      try {
        const hostname = window.location.hostname.replace(/^www\./, "");
        const isMarketplace = ["localhost", "127.0.0.1", "mundobeat.cl"].includes(hostname);
        let currentVendor: any;

        if (isMarketplace) {
          currentVendor = await api.getVendor(MARKETPLACE_VENDOR_ID);
        } else if (hostname.endsWith(".mundobeat.cl")) {
          currentVendor = await api.getVendorBySlug(hostname.replace(".mundobeat.cl", ""));
        } else {
          currentVendor = await api.getVendorByDomain(hostname);
        }

        const currentSettings = await api.getVendorSettings(currentVendor.id, false);
        if (currentSettings?.colorTheme) {
          applyThemeToDocument(currentSettings.colorTheme, currentSettings.customColors);
        }

        setVendor(currentVendor);
        setSettings(currentSettings);
      } catch (error) {
        console.error("No se pudo cargar la cabecera pública para la cuenta:", error);
      }
    };

    loadHeader();
  }, []);

  if (!vendor || !settings) return null;

  const slug = vendor.id === MARKETPLACE_VENDOR_ID ? "marketplace" : vendor.slug;
  const headerType = typeof settings.headerType === "number"
    ? `type${settings.headerType}`
    : settings.headerType || "type1";
  const headerVendor = {
    ...vendor,
    storeName: settings.storeName || vendor.storeName || vendor.name,
    phone: settings.phone || vendor.phone || "",
    email: settings.email || vendor.email || "",
  };

  switch (headerType) {
    case "type2":
      return <HeaderType2 vendor={headerVendor} config={settings} slug={slug} />;
    case "type3":
      return <HeaderType3 vendor={headerVendor} config={settings} slug={slug} />;
    default:
      return <HeaderType1 vendor={headerVendor} config={settings} slug={slug} />;
  }
}
