"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowRight, Home, Info } from "lucide-react";

interface HomePageConfig {
  type: "grid" | "blocks";
  pageId?: string;
}

interface Page {
  id: string;
  title: string;
  isHomepage?: boolean;
}

export default function StoreDesignConfig({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [config, setConfig] = useState<HomePageConfig>({ type: "grid" });
  const [pages, setPages] = useState<Page[]>([]);
  const [homePageExists, setHomePageExists] = useState(false);
  const [homePage, setHomePage] = useState<Page | null>(null);
  const [hasHomepageGrids, setHasHomepageGrids] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadConfig();
    loadPages();
    loadGrids();
  }, [vendorId]);

  const loadConfig = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/vendors/${vendorId}/home-page-config`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.error("Error loading config:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPages = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/vendors/${vendorId}/pages`,
        { cache: 'no-store' }
      );
      if (response.ok) {
        const data = await response.json();
        // Filtrar solo páginas publicadas
        const publishedPages = (Array.isArray(data) ? data : data.data || []).filter(
          (p: any) => p.isPublished
        );
        setPages(publishedPages);
        
        // Verificar si existe una página marcada como inicio
        const homePageData = publishedPages.find((p: any) => p.isHomepage);
        setHomePageExists(!!homePageData);
        setHomePage(homePageData || null);
        
        // Si el tipo es "blocks" y no hay pageId configurado pero sí hay página de inicio, auto-seleccionarla
        if (config.type === "blocks" && !config.pageId && homePageData) {
          setConfig(prev => ({
            ...prev,
            pageId: homePageData.id
          }));
        }
      }
    } catch (err) {
      console.error("Error loading pages:", err);
    }
  };

  const loadGrids = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/vendors/${vendorId}/settings`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const grids = data.gridConfig || [];
        const homepageGrids = grids.filter((g: any) => g.type === 'homepage' && g.isActive);
        setHasHomepageGrids(homepageGrids.length > 0);
      }
    } catch (err) {
      console.error("Error loading grids:", err);
    }
  };

  const handleTypeChange = (type: "grid" | "blocks") => {
    // Si cambia a "blocks" y hay una página de inicio, auto-seleccionarla
    if (type === "blocks" && homePage) {
      setConfig({
        type,
        pageId: homePage.id,
      });
    } else {
      setConfig({
        type,
        pageId: type === "blocks" ? config.pageId : undefined,
      });
    }
  };

  const handlePageSelect = (pageId: string) => {
    setConfig({
      ...config,
      pageId,
    });
  };

  const handleSave = async () => {
    if (config.type === "blocks" && !config.pageId) {
      setError("Por favor selecciona una página");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/vendors/${vendorId}/home-page-config`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }
      );

      if (response.ok) {
        alert("Configuración guardada exitosamente");
      } else {
        setError("Error al guardar la configuración");
      }
    } catch (err) {
      setError("Error al guardar la configuración");
      console.error("Error saving config:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePage = () => {
    router.push("/dashboard/pages");
  };

  if (loading) {
    return <div className="p-4">Cargando configuración...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configuración de Portada</h2>
        <p className="text-gray-600 mt-1">
          Elige cómo deseas mostrar tu portada
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Opción 1: Grid de Productos */}
      <Card
        className={`cursor-pointer transition-all ${
          config.type === "grid"
            ? "border-purple-500 bg-purple-50"
            : "border-gray-200"
        }`}
        onClick={() => handleTypeChange("grid")}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Grid de Productos</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Muestra un grid con tus productos destacados
              </p>
            </div>
            <input
              type="radio"
              checked={config.type === "grid"}
              onChange={() => handleTypeChange("grid")}
              className="w-5 h-5 text-purple-600 cursor-pointer mt-1"
            />
          </div>
        </CardHeader>
        
        {/* Alert cuando no hay grids */}
        {config.type === "grid" && !hasHomepageGrids && (
          <CardContent>
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                <p className="font-semibold mb-2">⚠️ No hay grids de portada configurados</p>
                <p className="text-sm mb-2">
                  Debes crear al menos un grid para la portada para que tus productos se muestren correctamente.
                </p>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/dashboard/settings?section=diseno&subsection=grids');
                  }}
                  size="sm"
                  className="mt-2 flex items-center gap-2"
                >
                  Crear Grid de Portada
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Opción 2: Página en Bloques */}
      <Card
        className={`cursor-pointer transition-all ${
          config.type === "blocks"
            ? "border-purple-500 bg-purple-50"
            : "border-gray-200"
        }`}
        onClick={() => handleTypeChange("blocks")}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Página en Bloques</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Utiliza una página personalizada con bloques (texto, imágenes, videos, etc)
              </p>
            </div>
            <input
              type="radio"
              checked={config.type === "blocks"}
              onChange={() => handleTypeChange("blocks")}
              className="w-5 h-5 text-purple-600 cursor-pointer mt-1"
            />
          </div>
        </CardHeader>

        {/* Selector de Página */}
        {config.type === "blocks" && (
          <CardContent className="space-y-4">
            {!homePageExists && (
              <Alert className="bg-amber-50 border-amber-200">
                <Info className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-900">
                  <p className="font-semibold mb-2">⚠️ No hay una página de inicio seleccionada</p>
                  <p className="text-sm mb-2">
                    Para usar una página en bloques como portada, primero debes marcar una página como "Página de Inicio" en el gestor de páginas.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={() => router.push('/dashboard/pages')}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-2 bg-white"
                    >
                      <Home className="w-4 h-4" />
                      Ir a Páginas
                    </Button>
                    <Button
                      onClick={handleCreatePage}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      Crear Nueva Página
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {pages.length === 0 ? (
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <p className="font-semibold text-blue-900">
                    No hay páginas creadas
                  </p>
                  <p className="text-sm text-blue-800 mt-1">
                    Debes crear una página primero para poder usarla como portada
                  </p>
                </div>
                <Button
                  onClick={handleCreatePage}
                  className="ml-4 flex items-center gap-2"
                >
                  Crear Página
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                {homePageExists && (
                  <Alert className="bg-green-50 border-green-200">
                    <Home className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-green-900 text-sm">
                      <strong>✅ Página de inicio seleccionada automáticamente</strong>
                      <p className="mt-1">
                        La página "{homePage?.title}" está marcada como inicio y se ha seleccionado automáticamente como portada.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Página de portada {homePageExists && <span className="text-green-600">(auto-seleccionada)</span>}
                  </label>
                  <select
                    value={config.pageId || ""}
                    onChange={(e) => handlePageSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Selecciona una página --</option>
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title} {page.isHomepage ? '🏠 (Página de Inicio)' : ''}
                      </option>
                    ))}
                  </select>
                  {homePageExists && config.pageId && (
                    <p className="text-xs text-gray-500">
                      Puedes cambiar la página si lo deseas, pero la página de inicio se usa por defecto.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Botones de acción */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || (config.type === "blocks" && !config.pageId)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {saving ? "Guardando..." : "Guardar Configuración"}
        </Button>
      </div>
    </div>
  );
}
