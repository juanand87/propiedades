"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Package, Truck, Check, X, RefreshCw, Eye, EyeOff, Globe, Settings, Zap, Upload, Loader2 } from "lucide-react";

interface EnviaConfig {
  apiToken: string | null;
  sandboxToken: string | null;
  environment: 'sandbox' | 'production';
  enabled: boolean;
  webhookUrl: string | null;
  webhookSecret: string | null;
  apiUrl: string;
  apiTestUrl: string;
}

interface Carrier {
  code: string;
  name: string;
  logo?: string;
}

export default function EnviaConfigPage() {
  const [config, setConfig] = useState<EnviaConfig | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; environment?: string } | null>(null);
  const [showTokens, setShowTokens] = useState(false);
  const [uploadingCarrier, setUploadingCarrier] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCarrierCode, setSelectedCarrierCode] = useState<string>("");

  // Form data
  const [formData, setFormData] = useState({
    apiToken: "",
    sandboxToken: "",
    environment: "sandbox" as 'sandbox' | 'production',
    enabled: false,
    webhookUrl: "",
    webhookSecret: "",
  });

  useEffect(() => {
    loadConfig();
    loadCarriers();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await api.getEnviaMarketplaceConfig();
      setConfig(data);
      setFormData({
        apiToken: "", // No mostramos tokens existentes
        sandboxToken: "",
        environment: data.environment || "sandbox",
        enabled: data.enabled || false,
        webhookUrl: data.webhookUrl || "",
        webhookSecret: "",
      });
    } catch (error) {
      console.error("Error loading Envia.com config:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCarriers = async () => {
    try {
      const data = await api.getEnviaCarriers();
      setCarriers(data);
    } catch (error) {
      console.error("Error loading carriers:", error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updateData: any = {
        environment: formData.environment,
        enabled: formData.enabled,
      };

      // Solo actualizar tokens si se ingresaron nuevos
      if (formData.apiToken) {
        updateData.apiToken = formData.apiToken;
      }
      if (formData.sandboxToken) {
        updateData.sandboxToken = formData.sandboxToken;
      }
      if (formData.webhookUrl) {
        updateData.webhookUrl = formData.webhookUrl;
      }
      if (formData.webhookSecret) {
        updateData.webhookSecret = formData.webhookSecret;
      }

      await api.updateEnviaMarketplaceConfig(updateData);
      alert("✅ Configuración guardada correctamente");
      loadConfig();
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await api.testEnviaConnection();
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setTesting(false);
    }
  };

  const handleCarrierLogoClick = (carrierCode: string) => {
    setSelectedCarrierCode(carrierCode);
    fileInputRef.current?.click();
  };

  const handleCarrierLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCarrierCode) return;

    try {
      setUploadingCarrier(selectedCarrierCode);

      const uploadResult = await api.uploadIcon(file);
      const uploadedUrl: string = uploadResult?.url || uploadResult?.path;
      if (!uploadedUrl) {
        throw new Error('No se pudo obtener la URL del icono subido');
      }

      const nextCarriers = carriers.map((carrier) =>
        carrier.code === selectedCarrierCode ? { ...carrier, logo: uploadedUrl } : carrier,
      );

      const carrierLogos = nextCarriers.reduce((acc, carrier) => {
        if (carrier.logo) {
          acc[carrier.code] = carrier.logo;
        }
        return acc;
      }, {} as Record<string, string>);

      await api.updateEnviaMarketplaceConfig({ carrierLogos });
      setCarriers(nextCarriers);
      alert('✅ Icono del carrier actualizado');
    } catch (error: any) {
      alert(`❌ Error al subir icono: ${error.message || 'Error desconocido'}`);
    } finally {
      setUploadingCarrier(null);
      setSelectedCarrierCode("");
      event.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-gray-600">Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Configuración Envia.com</h1>
        <p className="text-gray-600 mt-2">
          Configura la integración con Envia.com para envíos multi-carrier
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Estado de la Conexión
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant={config?.enabled ? "default" : "secondary"} className="text-sm">
                {config?.enabled ? "✓ Activado" : "○ Desactivado"}
              </Badge>
              <Badge variant={config?.environment === 'production' ? "default" : "outline"} className="text-sm">
                {config?.environment === 'production' ? "🔴 Producción" : "🟡 Sandbox"}
              </Badge>
              {config?.apiToken && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Token Producción: ****{config.apiToken}
                </Badge>
              )}
              {config?.sandboxToken && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  Token Sandbox: ****{config.sandboxToken}
                </Badge>
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Probando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Probar Conexión
                </>
              )}
            </Button>
          </div>

          {testResult && (
            <div className={`mt-4 p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <X className="w-5 h-5 text-red-600" />
                )}
                <div className="flex-1">
                  <span className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                    {testResult.message}
                  </span>
                  {testResult.environment && (
                    <div className="mt-1">
                      <Badge 
                        variant="outline" 
                        className={testResult.environment === 'production' ? 'text-green-600 border-green-600' : 'text-yellow-600 border-yellow-600'}
                      >
                        Ambiente: {testResult.environment === 'production' ? 'Producción' : 'Sandbox (Pruebas)'}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuración de API
          </CardTitle>
          <CardDescription>
            Ingresa las credenciales de tu cuenta de Envia.com
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-semibold">Activar Envia.com</Label>
              <p className="text-sm text-gray-500">
                Habilita la integración de envíos con Envia.com en todo el marketplace
              </p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>

          {/* Environment */}
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="environment"
                  value="sandbox"
                  checked={formData.environment === 'sandbox'}
                  onChange={() => setFormData({ ...formData, environment: 'sandbox' })}
                  className="w-4 h-4"
                />
                <span>🟡 Sandbox (Testing)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="environment"
                  value="production"
                  checked={formData.environment === 'production'}
                  onChange={() => setFormData({ ...formData, environment: 'production' })}
                  className="w-4 h-4"
                />
                <span>🔴 Producción</span>
              </label>
            </div>
          </div>

          {/* Tokens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sandboxToken">Token Sandbox</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTokens(!showTokens)}
                >
                  {showTokens ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <Input
                id="sandboxToken"
                type={showTokens ? "text" : "password"}
                value={formData.sandboxToken}
                onChange={(e) => setFormData({ ...formData, sandboxToken: e.target.value })}
                placeholder={config?.sandboxToken ? "****" + config.sandboxToken : "Ingresa token de sandbox"}
              />
              <p className="text-xs text-gray-500">
                Token para pruebas. Obtener en{" "}
                <a href="https://app.envia.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  app.envia.com
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiToken">Token Producción</Label>
              <Input
                id="apiToken"
                type={showTokens ? "text" : "password"}
                value={formData.apiToken}
                onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                placeholder={config?.apiToken ? "****" + config.apiToken : "Ingresa token de producción"}
              />
              <p className="text-xs text-gray-500">
                Token para envíos reales. Solo ingresar cuando esté listo para producción.
              </p>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">URL de Webhook (Tracking Automático)</Label>
            <Input
              id="webhookUrl"
              value={formData.webhookUrl}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
              placeholder="http://localhost:3001/shipping/envia/webhook"
            />
            <p className="text-xs text-gray-500">
              URL donde Envia.com enviará actualizaciones de tracking. Configura esto en tu panel de Envia.com.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Secreto de firma del webhook</Label>
            <Input
              id="webhookSecret"
              type={showTokens ? "text" : "password"}
              value={formData.webhookSecret}
              onChange={(e) => setFormData({ ...formData, webhookSecret: e.target.value })}
              placeholder={config?.webhookSecret ? "Secreto configurado" : "Ingresa el secreto generado por Envia.com"}
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-500">
              Se utiliza para validar la firma HMAC de los webhooks modernos.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-gradient-to-r from-purple-600 to-blue-600"
            >
              {saving ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Carriers Available */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Carriers Disponibles en Chile
          </CardTitle>
          <CardDescription>
            Estos son los carriers que los vendors pueden habilitar para sus envíos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            className="hidden"
            onChange={handleCarrierLogoUpload}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {carriers.map((carrier) => (
              <div
                key={carrier.code}
                className="flex flex-col items-center p-4 border rounded-lg hover:shadow-md transition-shadow"
              >
                <button
                  type="button"
                  onClick={() => handleCarrierLogoClick(carrier.code)}
                  className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-lg mb-2 border border-transparent hover:border-blue-300 transition-colors relative overflow-hidden"
                  title="Haz clic para cambiar el icono"
                >
                  {uploadingCarrier === carrier.code ? (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  ) : carrier.logo ? (
                    <img
                      src={carrier.logo}
                      alt={carrier.name}
                      className="w-full h-full object-contain p-1"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Package className="w-8 h-8 text-gray-400" />
                  )}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-0.5 flex items-center justify-center gap-1">
                    <Upload className="w-3 h-3" />
                    Editar
                  </span>
                </button>
                <span className="text-sm font-medium text-center">{carrier.name}</span>
                <span className="text-xs text-gray-500">{carrier.code}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Haz clic en el icono de un carrier para cargar un nuevo logo. Este logo se mostrará en Mundobeat y en checkout de las tiendas.
          </p>
        </CardContent>
      </Card>

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Guía de Configuración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">1. Crear cuenta en Envia.com</h4>
            <p className="text-sm text-gray-600">
              Ve a{" "}
              <a href="https://envia.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                envia.com
              </a>{" "}
              y crea una cuenta. El marketplace usa una sola cuenta para todos los vendors.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">2. Obtener tokens de API</h4>
            <p className="text-sm text-gray-600">
              En tu panel de Envia.com, genera tokens para sandbox (pruebas) y producción.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">3. Configurar webhook</h4>
            <p className="text-sm text-gray-600">
              Configura la URL del webhook en Envia.com para recibir actualizaciones de tracking automáticamente.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">4. Habilitar para vendors</h4>
            <p className="text-sm text-gray-600">
              Ve a "Vendedores → Listar" y configura Envia.com para cada vendor con su dirección de origen y carriers habilitados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
