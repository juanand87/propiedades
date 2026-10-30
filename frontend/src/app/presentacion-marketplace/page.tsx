"use client";

import { useEffect, useState } from "react";
import MarketplacePresentation from "@/components/predefined/MarketplacePresentation";
import { api } from "@/lib/api";
import {
  defaultMarketplacePresentation,
  MarketplacePresentationConfig,
  PRESENTATION_SLUG,
  parseMarketplacePresentation,
} from "@/lib/marketplacePresentation";

export default function MarketplacePresentationPage() {
  const [config, setConfig] = useState<MarketplacePresentationConfig>(defaultMarketplacePresentation);
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    const loadSavedPresentation = async () => {
      try {
        const settings = await api.getVendorSettings("00000000-0000-0000-0000-000000000001", false);
        setLogoUrl(settings?.headerConfig?.logo || "");
      } catch {
        // The presentation remains available if marketplace settings are unavailable.
      }

      try {
        const page = await api.getPageBySlug("marketplace", PRESENTATION_SLUG);
        const block = page.blocks?.find((item: any) => item.componentName === "marketplace-presentation");
        setConfig(parseMarketplacePresentation(block?.text));
      } catch {
        // The initial presentation remains available before its first admin save.
      }
    };

    loadSavedPresentation();
  }, []);

  return <MarketplacePresentation config={config} logoUrl={logoUrl} />;
}
