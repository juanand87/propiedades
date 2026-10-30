"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { Loader2, CreditCard, DollarSign, Banknote, Wallet } from "lucide-react";
import PaykuPaymentConfig from "./PaykuPaymentConfig";
import FlowPaymentConfig from "./FlowPaymentConfig";

interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  config: any;
  commissionPercentage: number;
}

export default function MarketplacePaymentMethods() {
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const methods = await api.getMarketplacePaymentMethods();
      setPaymentMethods(methods);
    } catch (error) {
      console.error("Error loading payment methods:", error);
      setError("Error al cargar los métodos de pago");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (methodId: string, enabled: boolean) => {
    try {
      await api.updateMarketplacePaymentMethod(methodId, { enabled });
      await loadPaymentMethods();
    } catch (error) {
      console.error("Error updating payment method:", error);
      setError("Error al actualizar el método de pago");
    }
  };

  const getIcon = (code: string) => {
    switch (code) {
      case "payku":
        return <Wallet className="h-5 w-5" />;
      case "flow":
        return <DollarSign className="h-5 w-5" />;
      case "transfer":
        return <Banknote className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Si hay un método seleccionado para configurar
  if (selectedMethod === "payku") {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setSelectedMethod(null)}>
          ← Volver a métodos de pago
        </Button>
        <PaykuPaymentConfig />
      </div>
    );
  }

  if (selectedMethod === "flow") {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setSelectedMethod(null)}>
          ← Volver a métodos de pago
        </Button>
        <FlowPaymentConfig />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Métodos de Pago del Marketplace</h2>
        <p className="text-gray-600 mt-2">
          Configura los métodos de pago disponibles para todas las tiendas
        </p>
      </div>

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {paymentMethods.map((method) => (
          <Card key={method.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getIcon(method.code)}
                  <div>
                    <CardTitle>{method.name}</CardTitle>
                    <CardDescription>{method.description}</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={method.enabled}
                  onCheckedChange={(checked) => handleToggleEnabled(method.id, checked)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <p>Comisión: {method.commissionPercentage}%</p>
                  {method.enabled && (
                    <p className="text-green-600 mt-1">✓ Activo para todas las tiendas</p>
                  )}
                </div>
                {(method.code === "payku" || method.code === "flow") && (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedMethod(method.code)}
                  >
                    Configurar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert>
        <AlertDescription>
          Los métodos de pago habilitados estarán disponibles para todas las tiendas del marketplace.
          Las comisiones se aplican automáticamente en cada transacción.
        </AlertDescription>
      </Alert>
    </div>
  );
}
