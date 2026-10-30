"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, API_URL } from "@/lib/api";
import { ArrowLeft, Loader2, Save } from "lucide-react";

interface MundoBeatCategory {
  id: string;
  name: string;
}

interface WooCategory {
  id: number;
  name: string;
}

interface CategoryMapping {
  [mundobeatCategoryId: string]: string; // woocommerce category id as string
}

export default function CategoryMappingPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [mundobeatCategories, setMundobeatCategories] = useState<MundoBeatCategory[]>([]);
  const [wooCategories, setWooCategories] = useState<WooCategory[]>([]);
  const [categoryMapping, setCategoryMapping] = useState<CategoryMapping>({});
  
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  useEffect(() => {
    loadVendorProfile();
  }, []);

  const loadVendorProfile = async () => {
    try {
      const response = await api.getMyVendor();
      
      if (response.hasVendor && response.id) {
        setVendorId(response.id);
        await Promise.all([
          loadMundobeatCategories(response.id),
          loadWooCategories(response.id),
          loadCategoryMapping(response.id),
        ]);
      } else {
        alert("No se encontró vendor");
        router.push('/dashboard/settings?section=integraciones&subsection=woocommerce');
      }
    } catch (error: any) {
      console.error("Error loading vendor profile:", error);
      
      if (error.message?.includes('401')) {
        api.removeToken();
        router.push('/login');
        return;
      }
      
      alert("Error al cargar perfil");
      router.push('/dashboard/settings?section=integraciones&subsection=woocommerce');
    } finally {
      setLoading(false);
    }
  };

  const loadMundobeatCategories = async (vId: string) => {
    try {
      const response = await fetch(
        `${API_URL}/vendors/${vId}/categories`,
        {
          headers: {
            Authorization: `Bearer ${api.getToken()}`,
          },
        }
      );
      const data = await response.json();
      setMundobeatCategories(data);
    } catch (error) {
      console.error("Error loading MundoBeat categories:", error);
    }
  };

  const loadWooCategories = async (vId: string) => {
    try {
      const response = await fetch(
        `${API_URL}/woocommerce/categories/${vId}`,
        {
          headers: {
            Authorization: `Bearer ${api.getToken()}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Error al cargar categorías de WooCommerce');
      }
      
      const data = await response.json();
      setWooCategories(data.categories || []);
      setConnectionStatus('connected');
    } catch (error) {
      console.error("Error loading WooCommerce categories:", error);
      setConnectionStatus('error');
    }
  };

  const loadCategoryMapping = async (vId: string) => {
    try {
      const settings = await api.getVendorSettings(vId);
      setCategoryMapping(settings.wooCategoryMapping || {});
    } catch (error) {
      console.error("Error loading category mapping:", error);
    }
  };

  const handleMappingChange = (mundobeatCategoryId: string, wooCategoryId: string) => {
    setCategoryMapping(prev => ({
      ...prev,
      [mundobeatCategoryId]: wooCategoryId,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateVendorSettings(vendorId, {
        wooCategoryMapping: categoryMapping,
      });
      
      alert("✅ Mapeo de categorías guardado exitosamente");
    } catch (error: any) {
      alert(error.message || "Error al guardar mapeo");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.push('/dashboard/settings?section=integraciones&subsection=woocommerce');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (connectionStatus === 'error') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-6">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Configuración
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>Error de Conexión</CardTitle>
            <CardDescription>
              No se pudo conectar con WooCommerce
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Verifica que tus credenciales de WooCommerce estén configuradas correctamente
              y que la conexión sea exitosa.
            </p>
            <Button onClick={handleBack}>
              Ir a Configuración de WooCommerce
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mappedCount = Object.keys(categoryMapping).filter(k => categoryMapping[k]).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">Mapeo de Categorías</h1>
          </div>
          <p className="text-gray-600">
            Configura cómo las categorías de MundoBeat se sincronizan con WooCommerce
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar Mapeo
            </>
          )}
        </Button>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <Badge variant={mappedCount > 0 ? "default" : "secondary"}>
          {mappedCount} de {mundobeatCategories.length} categorías mapeadas
        </Badge>
      </div>

      {/* Mapping Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Mapeo</CardTitle>
          <CardDescription>
            Selecciona la categoría de WooCommerce correspondiente para cada categoría de MundoBeat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mundobeatCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay categorías en MundoBeat. Crea categorías primero.
              </p>
            ) : (
              mundobeatCategories.map((mbCategory) => (
                <div
                  key={mbCategory.id}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <Label className="text-base font-medium">
                      {mbCategory.name}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Categoría de MundoBeat
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">→</span>
                  </div>
                  
                  <div className="flex-1">
                    <select
                      value={categoryMapping[mbCategory.id] || ""}
                      onChange={(e) => handleMappingChange(mbCategory.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Sin mapear</option>
                      {wooCategories.map((wooCategory) => (
                        <option key={wooCategory.id} value={wooCategory.id.toString()}>
                          {wooCategory.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-muted-foreground mt-1">
                      Categoría de WooCommerce
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h4 className="font-semibold text-blue-900">💡 Información</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>
                Solo los productos con categorías mapeadas se sincronizarán a WooCommerce
              </li>
              <li>
                Si un producto tiene múltiples categorías, se sincronizarán todas las que estén mapeadas
              </li>
              <li>
                Puedes dejar categorías sin mapear si no quieres sincronizar productos de esas categorías
              </li>
              <li>
                Recuerda guardar los cambios haciendo click en "Guardar Mapeo"
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
