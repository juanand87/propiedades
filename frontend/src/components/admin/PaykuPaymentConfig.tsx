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
import { Loader2, ExternalLink, DollarSign, Wallet, Info, CheckCircle2 } from "lucide-react";

export default function PaykuPaymentConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<any>(null);
  const [config, setConfig] = useState({
    publicToken: "",
    privateToken: "",
    environment: "sandbox",
    apiUrl: "https://app.payku.cl/api",
    notifyUrl: "",
    returnUrl: "",
  });
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadPaykuConfig();
  }, []);

  const loadPaykuConfig = async () => {
    try {
      setLoading(true);
      const method = await api.getMarketplacePaymentMethodByCode("payku");
      setPaymentMethod(method);
      setEnabled(method.enabled || false);
      setConfig(method.config || config);
    } catch (error) {
      console.error("Error loading Payku config:", error);
      setError("Error al cargar la configuración de Payku");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Validate tokens
      if (!config.publicToken || !config.privateToken) {
        setError("Los tokens público y privado son obligatorios");
        return;
      }

      // Update payment method
      await api.updateMarketplacePaymentMethod(paymentMethod.id, {
        enabled,
        config: {
          ...config,
          notifyUrl: config.notifyUrl || `${window.location.origin}/api/payment/payku/webhook`,
          returnUrl: config.returnUrl || `${window.location.origin}/payment/success`,
        },
      });

      setSuccess("Configuración de Payku guardada correctamente");
      await loadPaykuConfig();
    } catch (error: any) {
      console.error("Error saving Payku config:", error);
      setError(error.message || "Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Configuración de Payku
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Configuración de Payku Marketplace
        </CardTitle>
        <CardDescription>
          Configura Payku como método de pago con división automática de comisiones.
          <a 
            href="https://docs.payku.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 ml-2 text-purple-600 hover:underline"
          >
            Ver documentación <ExternalLink className="w-3 h-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 text-green-900 border-green-200">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label htmlFor="enabled" className="text-base font-semibold">
              Habilitar Payku
            </Label>
            <p className="text-sm text-gray-500">
              Activa Payku como método de pago disponible
            </p>
          </div>
          <Switch
            id="enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* Environment Selection */}
        <div className="space-y-2">
          <Label htmlFor="environment">Ambiente</Label>
          <Select
            value={config.environment}
            onValueChange={(value) => setConfig({ ...config, environment: value })}
          >
            <SelectTrigger id="environment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">Sandbox (Pruebas)</SelectItem>
              <SelectItem value="production">Producción</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            Usa "Sandbox" para pruebas y "Producción" para pagos reales
          </p>
        </div>

        {/* Public Token */}
        <div className="space-y-2">
          <Label htmlFor="publicToken">Token Público</Label>
          <Input
            id="publicToken"
            type="text"
            placeholder="pk_test_..."
            value={config.publicToken}
            onChange={(e) => setConfig({ ...config, publicToken: e.target.value })}
          />
          <p className="text-xs text-gray-500">
            Tu token público de Payku (puedes verlo en el panel)
          </p>
        </div>

        {/* Private Token */}
        <div className="space-y-2">
          <Label htmlFor="privateToken">Token Privado</Label>
          <Input
            id="privateToken"
            type="password"
            placeholder="sk_test_..."
            value={config.privateToken}
            onChange={(e) => setConfig({ ...config, privateToken: e.target.value })}
          />
          <p className="text-xs text-gray-500">
            Tu token privado de Payku (mantén esto seguro)
          </p>
        </div>

        {/* API URL */}
        <div className="space-y-2">
          <Label htmlFor="apiUrl">URL de API</Label>
          <Input
            id="apiUrl"
            type="url"
            placeholder="https://app.payku.cl/api"
            value={config.apiUrl}
            onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
          />
          <p className="text-xs text-gray-500">
            URL base de la API de Payku (normalmente no es necesario cambiarla)
          </p>
        </div>

        {/* URLs Info Alert */}
        <Alert className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <Info className="w-4 h-4 text-purple-600" />
          <AlertDescription className="text-purple-900">
            <strong className="text-base">🔄 Sistema de URLs Dinámicas</strong>
            <div className="mt-2 text-sm space-y-2">
              <p>
                Las URLs de notificación y retorno se generan <strong>automáticamente</strong> según el contexto:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>URL de Notificación (Webhook):</strong> Siempre usa la URL del backend configurada (BACKEND_URL)</li>
                <li><strong>URL de Retorno:</strong> Se adapta al dominio desde donde se realizó el pago:
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>En <code className="bg-purple-100 px-1 rounded">www.mundobeat.cl</code> → Redirige a mundobeat.cl</li>
                    <li>En dominios personalizados (ej: <code className="bg-purple-100 px-1 rounded">cdmania.cl</code>) → Redirige al mismo dominio</li>
                  </ul>
                </li>
              </ul>
              <p className="text-purple-700 font-semibold mt-2">
                ℹ️ Los valores guardados aquí son solo de referencia. El sistema usa URLs dinámicas en producción.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Notify URL (Webhook) - READ ONLY */}
        <div className="space-y-2">
          <Label htmlFor="notifyUrl" className="flex items-center gap-2">
            URL de Notificación (Webhook)
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </Label>
          <Input
            id="notifyUrl"
            type="url"
            readOnly
            value="http://localhost:3001/api/payment/payku/webhook"
            className="bg-green-50 border-green-200 text-green-900 font-mono text-sm"
          />
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-900 text-xs">
              <strong>✅ URL Activa en Producción</strong>
              <p className="mt-1">
                Esta es la URL real que Payku usa para enviar notificaciones. Se configura automáticamente 
                usando la variable <code className="bg-green-100 px-1 rounded">BACKEND_URL</code> del servidor.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        {/* Return URL - READ ONLY WITH EXPLANATION */}
        <div className="space-y-2">
          <Label htmlFor="returnUrl" className="flex items-center gap-2">
            URL de Retorno
            <Info className="w-4 h-4 text-blue-600" />
          </Label>
          <Input
            id="returnUrl"
            type="url"
            readOnly
            value="http://localhost:3000/payment/success?order={orderId} (dinámica)"
            className="bg-blue-50 border-blue-200 text-blue-900 font-mono text-sm"
          />
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-900 text-xs">
              <strong>🔄 URL Dinámica</strong>
              <p className="mt-1">
                La URL de retorno cambia automáticamente según el dominio:
              </p>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
                <li><strong>www.mundobeat.cl:</strong> Usa variable <code className="bg-blue-100 px-1 rounded">FRONTEND_URL</code></li>
                <li><strong>cdmania.cl u otros:</strong> Detecta y usa el dominio desde donde se pagó</li>
                <li><strong>Viniloteca.mundobeat.cl:</strong> Redirige a mundobeat.cl</li>
              </ul>
              <p className="mt-1 text-blue-700">
                Esto garantiza que el usuario siempre vuelva al sitio correcto después del pago.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        {/* Commission Info */}
        <Alert className="bg-blue-50 border-blue-200">
          <DollarSign className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>Configuración Centralizada:</strong> Esta configuración de Payku se aplica a todo el marketplace 
            y a todas las tiendas individuales. Los vendedores no necesitan configurar credenciales propias.
            <div className="mt-2 text-sm">
              <strong>Funcionamiento:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Todos los pagos se procesan con estas credenciales</li>
                <li>El dinero ingresa a la cuenta del marketplace</li>
                <li>El administrador calcula y transfiere a cada vendedor</li>
                <li>No se realiza split automático de pagos</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        {/* Documentation Links */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">Enlaces Útiles</h4>
          <ul className="space-y-1 text-sm">
            <li>
              <a 
                href="https://app.payku.cl/login" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline inline-flex items-center gap-1"
              >
                Panel de Payku <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              <a 
                href="https://docs.payku.com/index-cl-es-v1.html#tag/Marketplace" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline inline-flex items-center gap-1"
              >
                Documentación Marketplace <ExternalLink className="w-3 h-3" />
              </a>
            </li>
          </ul>
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar Configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
