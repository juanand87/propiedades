"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Loader2, ExternalLink } from "lucide-react";

export default function FlowPaymentConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<any>(null);
  const [config, setConfig] = useState({
    apiKey: "",
    secretKey: "",
    environment: "sandbox",
    apiUrl: "https://sandbox.flow.cl/api"
  });
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadFlowConfig();
  }, []);

  const loadFlowConfig = async () => {
    try {
      setLoading(true);
      const method = await api.getMarketplacePaymentMethodByCode("flow");
      setPaymentMethod(method);
      setEnabled(method.enabled || false);
      setConfig(method.config || config);
    } catch (error) {
      console.error("Error loading Flow config:", error);
      setError("Error al cargar la configuración de Flow");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.updateMarketplacePaymentMethod(paymentMethod.id, {
        enabled,
        config
      });

      setSuccess("Configuración de Flow guardada exitosamente");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error saving Flow config:", error);
      setError("Error al guardar la configuración de Flow");
    } finally {
      setSaving(false);
    }
  };

  const handleEnvironmentChange = (env: string) => {
    setConfig({
      ...config,
      environment: env,
      apiUrl: env === "production" 
        ? "https://www.flow.cl/api" 
        : "https://sandbox.flow.cl/api"
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configuración de Flow</CardTitle>
              <CardDescription>
                Configure las credenciales de Flow para procesar pagos en el marketplace
              </CardDescription>
            </div>
            <a 
              href="https://developers.flow.cl" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Documentación <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Estado del método de pago */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="enabled" className="text-base font-medium">
                Activar Flow como método de pago
              </Label>
              <p className="text-sm text-gray-500">
                Cuando esté activo, Flow estará disponible en todas las tiendas del marketplace
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Ambiente */}
          <div className="space-y-2">
            <Label htmlFor="environment">Ambiente</Label>
            <Select
              value={config.environment}
              onValueChange={handleEnvironmentChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (Pruebas)</SelectItem>
                <SelectItem value="production">Producción</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              Use Sandbox para pruebas y Producción para pagos reales
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="text"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="Ingrese su API Key de Flow"
            />
            <p className="text-sm text-gray-500">
              Obtenga su API Key desde el panel de Flow
            </p>
          </div>

          {/* Secret Key */}
          <div className="space-y-2">
            <Label htmlFor="secretKey">Secret Key</Label>
            <Input
              id="secretKey"
              type="password"
              value={config.secretKey}
              onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
              placeholder="Ingrese su Secret Key de Flow"
            />
            <p className="text-sm text-gray-500">
              Su Secret Key se mantiene segura y encriptada
            </p>
          </div>

          {/* URL de API (solo lectura) */}
          <div className="space-y-2">
            <Label htmlFor="apiUrl">URL de API</Label>
            <Input
              id="apiUrl"
              type="text"
              value={config.apiUrl}
              readOnly
              className="bg-gray-100"
            />
          </div>

          {/* Mensajes */}
          {error && (
            <Alert className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Botón guardar */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar configuración
            </Button>
          </div>

          {/* Información adicional */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Información importante</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Flow se aplicará automáticamente a todas las tiendas del marketplace</li>
              <li>Los vendedores no podrán desactivar este método de pago</li>
              <li>Todos los pagos se procesarán a través de la cuenta principal del marketplace</li>
              <li>Asegúrese de configurar correctamente el ambiente antes de activar</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
