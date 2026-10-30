"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Download, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function MigrateImagesPage() {
  const [loading, setLoading] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const handleMigrate = async (dryRun: boolean = false) => {
    if (dryRun) {
      setDryRunLoading(true);
    } else {
      setLoading(true);
    }
    setError("");
    setResults(null);

    try {
      const result = await api.migrateDiscogsImages(dryRun);
      setResults(result);
    } catch (err: any) {
      setError(err.message || "Error al migrar imágenes");
    } finally {
      setLoading(false);
      setDryRunLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Migración de Imágenes de Discogs</h1>
        <p className="text-gray-600">
          Esta herramienta descarga todas las imágenes que actualmente apuntan a Discogs
          y las sube a DigitalOcean Spaces para mejorar la disponibilidad y rendimiento.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>¿Qué hace esta migración?</CardTitle>
          <CardDescription>
            Procesa todos los productos con imágenes hospedadas en Discogs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Proceso:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>Busca todos los productos con imágenes de Discogs (i.discogs.com, api-img.discogs.com)</li>
              <li>Descarga cada imagen desde los servidores de Discogs</li>
              <li>Sube las imágenes a DigitalOcean Spaces (mundobeat.nyc3.digitaloceanspaces.com)</li>
              <li>Actualiza el producto con las nuevas URLs</li>
              <li>Mantiene otras imágenes que no sean de Discogs</li>
            </ol>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Recomendación:</strong> Ejecuta primero una "Vista Previa" para ver qué productos
              se migrarán sin realizar cambios reales.
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button
              onClick={() => handleMigrate(true)}
              disabled={loading || dryRunLoading}
              variant="outline"
            >
              {dryRunLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Vista Previa (Dry Run)
                </>
              )}
            </Button>

            <Button
              onClick={() => handleMigrate(false)}
              disabled={loading || dryRunLoading}
              variant="default"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Migrando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Ejecutar Migración
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados de la Migración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-2xl font-bold">{results.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{results.migrated}</div>
                <div className="text-sm text-gray-600">Migrados</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                <div className="text-sm text-gray-600">Fallidos</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{results.skipped}</div>
                <div className="text-sm text-gray-600">Omitidos</div>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              <h3 className="font-semibold mb-2">Detalles:</h3>
              {results.details.map((detail: any, index: number) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    detail.status === 'migrated'
                      ? 'bg-green-50 border-green-200'
                      : detail.status === 'failed'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {detail.status === 'migrated' && (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    )}
                    {detail.status === 'failed' && (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    {detail.status === 'skipped' && (
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{detail.title}</div>
                      <div className="text-xs text-gray-600">{detail.message}</div>
                      {detail.oldImages && detail.oldImages.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {detail.oldImages.length} imagen(es) de Discogs
                        </div>
                      )}
                      {detail.newImages && detail.newImages.length > 0 && (
                        <div className="text-xs text-green-600 mt-1">
                          ✓ {detail.newImages.length} imagen(es) subidas a Spaces
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
