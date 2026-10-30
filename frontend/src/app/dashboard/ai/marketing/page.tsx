"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AIMarketingPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">📣 Funciones IA - Marketing</h1>
        <p className="text-gray-500 mt-1">Genera contenido de marketing con inteligencia artificial</p>
      </div>

      {/* Coming Soon */}
      <Card className="border-dashed border-2">
        <CardContent className="py-16">
          <div className="text-center">
            <div className="text-6xl mb-4">🚧</div>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">Próximamente</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Esta sección permitirá generar contenido para redes sociales, 
              emails promocionales y más usando inteligencia artificial.
            </p>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl mb-2">📱</div>
                <h3 className="font-medium">Redes Sociales</h3>
                <p className="text-xs text-gray-500">Posts para Instagram, Facebook, X</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl mb-2">📧</div>
                <h3 className="font-medium">Email Marketing</h3>
                <p className="text-xs text-gray-500">Newsletters y promociones</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl mb-2">🏷️</div>
                <h3 className="font-medium">SEO y Tags</h3>
                <p className="text-xs text-gray-500">Palabras clave optimizadas</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
