"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { Loader2, Wallet, CheckCircle2, Info } from "lucide-react";

interface VendorPaykuConfigProps {
  vendorId: string;
}

export default function VendorPaykuConfig({ vendorId }: VendorPaykuConfigProps) {
  const [loading, setLoading] = useState(true);
  const [paykuEnabled, setPaykuEnabled] = useState(false);

  useEffect(() => {
    checkPaykuStatus();
  }, [vendorId]);

  const checkPaykuStatus = async () => {
    try {
      setLoading(true);
      // Verificar si Payku está habilitado a nivel marketplace
      const paykuMethod = await api.getMarketplacePaymentMethodByCode("payku");
      setPaykuEnabled(paykuMethod?.enabled || false);
    } catch (error) {
      console.error("Error checking Payku status:", error);
      setPaykuEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Método de Pago: Payku
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
          Método de Pago: Payku
        </CardTitle>
        <CardDescription>
          Payku está configurado centralmente por el administrador del marketplace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estado de Payku */}
        {paykuEnabled ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Payku está activo para tu tienda</strong>
              <p className="mt-2 text-sm">
                Los clientes pueden pagar con Payku en tu tienda. Todos los pagos son procesados 
                de forma centralizada y el administrador del marketplace se encargará de las transferencias.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-yellow-50 border-yellow-200">
            <Info className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Payku no está habilitado actualmente</strong>
              <p className="mt-2 text-sm">
                El administrador del marketplace debe habilitar Payku desde el panel de configuración.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Información sobre el funcionamiento */}
        <div className="p-4 bg-blue-50 rounded-lg space-y-3 border border-blue-200">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-semibold text-blue-900">¿Cómo funciona Payku en tu tienda?</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">1.</span>
                  <span>Los clientes pagan con Payku directamente en tu tienda</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">2.</span>
                  <span>El dinero ingresa a la cuenta del marketplace (configuración centralizada)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">3.</span>
                  <span>El administrador calcula y transfiere tu parte de las ventas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">4.</span>
                  <span>Recibes reportes detallados de todas tus ventas en el panel</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Información sobre transferencias */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-2 border">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Gestión de Pagos
          </h4>
          <p className="text-sm text-gray-700">
            No necesitas configurar credenciales de Payku. El sistema está completamente centralizado 
            para simplificar la gestión de pagos y transferencias.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            <strong>Importante:</strong> El administrador del marketplace se encarga de:
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside ml-2 space-y-1">
            <li>Configurar las credenciales de Payku</li>
            <li>Procesar todos los pagos</li>
            <li>Calcular comisiones y montos</li>
            <li>Realizar transferencias a tu cuenta bancaria</li>
          </ul>
        </div>

        {/* Contacto */}
        <Alert className="bg-purple-50 border-purple-200">
          <AlertDescription className="text-purple-900 text-sm">
            <strong>¿Tienes dudas sobre tus pagos?</strong>
            <p className="mt-1">
              Contacta al administrador del marketplace para consultas sobre transferencias, 
              comisiones o configuración de tus datos bancarios.
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
