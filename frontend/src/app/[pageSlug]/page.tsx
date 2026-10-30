"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import GridDisplay from "@/components/GridDisplay";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import LateralMenu, { shouldShowLateralMenu } from "@/components/LateralMenu";
import { Card, CardContent } from "@/components/ui/card";
import { applyThemeToDocument } from "@/lib/colorThemes";
import { usePathname } from "next/navigation";

export default function PublicPagePage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const pageSlug = params.pageSlug as string;

  const [page, setPage] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (pageSlug) {
      loadPage();
    }
  }, [pageSlug]);

  const loadPage = async () => {
    try {
      setLoading(true);

      // Load marketplace settings
      const marketplaceSettings = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/marketplace/settings`);
      const settingsData = await marketplaceSettings.json();
      const settingsObj = settingsData.reduce((acc: any, setting: any) => {
        acc[setting.settingKey] = setting.settingValue;
        return acc;
      }, {});
      setSettings(settingsObj);

      // Apply color theme
      if (settingsObj?.colorTheme) {
        applyThemeToDocument(settingsObj.colorTheme);
      }

      setError("Esta página no está disponible en el contexto actual");
    } catch (error) {
      console.error("Error loading page:", error);
      setError("Página no encontrada");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error || !page || !vendor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">{error || "Página no encontrada"}</h1>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const renderHeader = () => {
    return null;
  };

  const renderBlock = (block: any, index: number) => {
    return null;
  };

  const extractYoutubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : "";
  };

  const extractVimeoId = (url: string) => {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : "";
  };

  // Determinar si mostrar menú lateral
  const showLateralMenu = false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">{error || "Página no disponible"}</h1>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
