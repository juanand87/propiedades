"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function ConfiguracionVendedoresPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Configuración de Vendedores</h1>
        <p className="text-gray-600 mt-2">Configuración global de vendedores del marketplace</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuración Global
          </CardTitle>
          <CardDescription>
            Configuración de comisiones, políticas y reglas para vendedores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <Settings className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">Esta sección está en desarrollo</p>
            <p className="text-sm text-gray-500">
              Próximamente podrás configurar:
            </p>
            <ul className="text-sm text-gray-500 mt-4 space-y-2">
              <li>• Comisiones globales del marketplace</li>
              <li>• Políticas de aprobación de productos</li>
              <li>• Reglas de facturación</li>
              <li>• Configuración de pagos</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
