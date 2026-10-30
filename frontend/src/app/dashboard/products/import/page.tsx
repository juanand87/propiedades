"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Upload, Download, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const GOLDMINE_GRADES = [
  { value: 'M', label: 'M (Mint)' },
  { value: 'NM', label: 'NM (Near Mint)' },
  { value: 'VG+', label: 'VG+ (Very Good Plus)' },
  { value: 'VG', label: 'VG (Very Good)' },
  { value: 'Fair', label: 'Fair' },
];

export default function BulkImportPage() {
  const { user } = useAuth();

  // Paso 1: Subir archivo y configurar
  const [file, setFile] = useState<File | null>(null);
  const [config, setConfig] = useState({
    condition: 'new' as 'new' | 'used',
    mediaGrade: 'NM',
    sleeveGrade: 'NM',
    includeWholesalePrices: false,
    minimumPrice: 0,
    createIncomplete: true,
  });

  // Paso 2: Resultados de validación
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  // Paso 3: Importación
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Modal de categorías
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [allMarketplaceCategories, setAllMarketplaceCategories] = useState<any[]>([]);
  const [categoriesToActivate, setCategoriesToActivate] = useState<string[]>([]);
  const [activatingCategories, setActivatingCategories] = useState(false);

  // Verificar categorías activas al cargar
  useEffect(() => {
    if (user?.vendorId) {
      checkActiveCategories();
    }
  }, [user?.vendorId]);

  const checkActiveCategories = async () => {
    if (!user?.vendorId) return;
    
    try {
      const vendorCategories = await api.getVendorCategories(user.vendorId);
      const activeCategories = vendorCategories.filter((cat: any) => cat.isActive);
      
      // Si no hay categorías activas, mostrar el modal
      if (activeCategories.length === 0) {
        const allCategories = await api.getCategories();
        setAllMarketplaceCategories(allCategories);
        setShowCategoryModal(true);
      }
    } catch (error) {
      console.error("Error checking active categories:", error);
    }
  };

  const handleActivateCategories = async () => {
    if (!user?.vendorId || categoriesToActivate.length === 0) return;

    setActivatingCategories(true);
    try {
      await api.updateVendorCategories(user.vendorId, categoriesToActivate);
      setShowCategoryModal(false);
      setCategoriesToActivate([]);
    } catch (error: any) {
      console.error("Error activating categories:", error);
      alert(error.message || "Error al activar categorías");
    } finally {
      setActivatingCategories(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setValidationResult(null);
      setImportResult(null);
    }
  };

  const handleValidate = async () => {
    if (!file || !user?.vendorId) {
      alert("Por favor selecciona un archivo");
      return;
    }

    console.log('📤 [BulkImport] Sending validation request');
    console.log('   User:', user);
    console.log('   VendorId:', user.vendorId);
    console.log('   File:', file.name);

    setValidating(true);
    try {
      const result = await api.validateBulkImport(user.vendorId, file, config);
      setValidationResult(result);
    } catch (error: any) {
      console.error('❌ [BulkImport] Validation error:', error);
      alert(error.message || "Error al validar archivo");
    } finally {
      setValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    console.log('🚀 [Execute] Button clicked');
    console.log('   validationResult:', validationResult);
    console.log('   user:', user);
    console.log('   user.vendorId:', user?.vendorId);
    
    if (!validationResult || !user?.vendorId) {
      console.log('❌ [Execute] Missing validationResult or vendorId');
      return;
    }

    // Filtrar solo productos válidos (ok y warning)
    const productsToImport = validationResult.products.filter(
      (p: any) => p.status === 'ok' || p.status === 'warning'
    );

    console.log('📦 [Execute] Products to import:', productsToImport.length);

    if (productsToImport.length === 0) {
      alert("No hay productos válidos para importar");
      return;
    }

    console.log('📤 [Execute] Starting import...');

    setImporting(true);
    setImportProgress({ current: 0, total: productsToImport.length });

    try {
      const allImported: any[] = [];
      const allFailed: any[] = [];

      // Importar producto por producto para actualizar progreso en tiempo real
      for (let i = 0; i < productsToImport.length; i++) {
        const product = productsToImport[i];
        console.log(`📤 [Execute] Processing product ${i + 1}/${productsToImport.length}: ${product.barcode}`);
        
        try {
          // Importar un producto a la vez
          const result = await api.executeBulkImport(user.vendorId, [product], config);
          
          if (result.details?.imported) {
            allImported.push(...result.details.imported);
          }
          if (result.details?.failed) {
            allFailed.push(...result.details.failed);
          }
        } catch (error: any) {
          console.error(`❌ Error importing product ${product.barcode}:`, error);
          allFailed.push({
            rowNumber: product.rowNumber,
            barcode: product.barcode,
            error: error?.message || 'Error desconocido'
          });
        }
        
        // Actualizar progreso después de cada producto
        setImportProgress({
          current: i + 1,
          total: productsToImport.length
        });
        
        // Pequeña pausa para no saturar el servidor
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalResult = {
        imported: allImported.length,
        failed: allFailed.length,
        details: {
          imported: allImported,
          failed: allFailed
        }
      };

      console.log('✅ [Execute] Import completed:', finalResult);
      setImportResult(finalResult);
    } catch (error: any) {
      console.error('❌ [Execute] Import failed:', error);
      alert(error.message || "Error al importar productos");
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const handleDownloadTemplate = async () => {
    if (!user?.vendorId) return;
    try {
      await api.downloadImportTemplate(user.vendorId, config.includeWholesalePrices);
    } catch (error: any) {
      alert(error.message || "Error al descargar plantilla");
    }
  };

  if (importResult) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Importación Completa</h1>
          <Link href="/dashboard/products">
            <Button>
              Ver Productos
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Resumen de Importación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{importResult.imported}</div>
                <div className="text-sm text-gray-600">Productos Procesados</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{importResult.failed}</div>
                <div className="text-sm text-gray-600">Fallidos</div>
              </div>
            </div>

            {importResult.details.imported.length > 0 && (
              <div>
                <h3 className="font-semibold text-green-600 mb-2">Productos procesados:</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {importResult.details.imported.map((item: any) => (
                    <div key={item.rowNumber} className="text-sm p-2 bg-green-50 rounded">
                      <span className="font-medium">Fila {item.rowNumber}:</span> {item.title}
                      {item.updated && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                          ACTUALIZADO - Stock anterior: {item.oldStock} → Nuevo: {item.newStock}
                        </span>
                      )}
                      {!item.updated && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                          NUEVO
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.details.failed.length > 0 && (
              <div>
                <h3 className="font-semibold text-red-600 mb-2">Productos que fallaron:</h3>
                <div className="space-y-2">
                  {importResult.details.failed.map((item: any) => (
                    <div key={item.rowNumber} className="text-sm p-2 bg-red-50 rounded">
                      <span className="font-medium">Fila {item.rowNumber}:</span> {item.barcode} - {item.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => {
                setValidationResult(null);
                setImportResult(null);
                setFile(null);
              }}>
                Nueva Importación
              </Button>
              <Link href="/dashboard/products">
                <Button variant="outline">
                  Ver Todos los Productos
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/products">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Importación Masiva de Productos</h1>
            <p className="text-gray-600 mt-2">Importa múltiples productos desde un archivo CSV/Excel</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Descargar Plantilla
        </Button>
      </div>

      {/* PASO 1: CONFIGURACIÓN */}
      <Card>
        <CardHeader>
          <CardTitle>1. Configuración y Archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Condición */}
          <div>
            <Label>Condición de productos</Label>
            <select
              value={config.condition}
              onChange={(e) => setConfig({ ...config, condition: e.target.value as any })}
              className="w-full mt-2 px-3 py-2 border rounded-lg"
              disabled={!!validationResult}
            >
              <option value="new">Nuevo</option>
              <option value="used">Usado</option>
            </select>
          </div>

          {/* Escalas Goldmine si es usado */}
          {config.condition === 'used' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Escala Goldmine - Disco</Label>
                <select
                  value={config.mediaGrade}
                  onChange={(e) => setConfig({ ...config, mediaGrade: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border rounded-lg"
                  disabled={!!validationResult}
                >
                  {GOLDMINE_GRADES.map((grade) => (
                    <option key={grade.value} value={grade.value}>
                      {grade.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Escala Goldmine - Portada</Label>
                <select
                  value={config.sleeveGrade}
                  onChange={(e) => setConfig({ ...config, sleeveGrade: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border rounded-lg"
                  disabled={!!validationResult}
                >
                  {GOLDMINE_GRADES.map((grade) => (
                    <option key={grade.value} value={grade.value}>
                      {grade.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Precios mayoristas */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.includeWholesalePrices}
              onChange={(e) => setConfig({ ...config, includeWholesalePrices: e.target.checked })}
              className="h-4 w-4"
              disabled={!!validationResult}
            />
            <Label>Incluir validación de precios mayoristas</Label>
          </div>

          {/* Precio mínimo */}
          <div>
            <Label>Precio mínimo (CLP)</Label>
            <Input
              type="number"
              value={config.minimumPrice}
              onChange={(e) => setConfig({ ...config, minimumPrice: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              disabled={!!validationResult}
            />
          </div>

          {/* Productos sin Discogs */}
          <div>
            <Label>Si el producto no está en Discogs:</Label>
            <select
              value={config.createIncomplete ? 'create' : 'skip'}
              onChange={(e) => setConfig({ ...config, createIncomplete: e.target.value === 'create' })}
              className="w-full mt-2 px-3 py-2 border rounded-lg"
              disabled={!!validationResult}
            >
              <option value="create">Crearlo con observaciones (deberá completar datos manualmente)</option>
              <option value="skip">No crearlo</option>
            </select>
          </div>

          {/* Selección de archivo */}
          <div>
            <Label htmlFor="file">Archivo CSV o Excel</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={validating || !!validationResult}
              />
              <Button
                onClick={handleValidate}
                disabled={!file || validating || !!validationResult}
              >
                {validating ? "Validando..." : "Validar"}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Formato esperado: codigo_barras; precio_detalle; {config.includeWholesalePrices && 'precio_mayorista; '}categoria; cantidad
            </p>
            <p className="text-xs text-gray-500">
              Separador: punto y coma (;)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PASO 2: PREVIEW DE VALIDACIÓN */}
      {validationResult && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>2. Resultado de Validación</CardTitle>
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    {validationResult.summary.ok} OK
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    {validationResult.summary.warnings} Advertencias
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                    {validationResult.summary.errors} Errores
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {validationResult.products.map((product: any) => (
                  <div
                    key={product.rowNumber}
                    className={`p-3 rounded-lg border-l-4 ${
                      product.status === 'ok'
                        ? 'bg-green-50 border-green-500'
                        : product.status === 'warning'
                        ? 'bg-yellow-50 border-yellow-500'
                        : 'bg-red-50 border-red-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          Fila {product.rowNumber}: {product.barcode}
                          {product.existingProduct && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                              ACTUALIZACIÓN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {product.category} | ${product.priceRetail.toLocaleString()} | Stock: {product.quantity}
                          {product.discogsMatch && (
                            <span className="ml-2 text-blue-600">
                              ✓ {product.discogsMatch.title}
                            </span>
                          )}
                        </div>
                        {product.errors.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {product.errors.map((error: string, idx: number) => (
                              <div key={idx} className="text-xs text-red-600">• {error}</div>
                            ))}
                          </div>
                        )}
                        {product.warnings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {product.warnings.map((warning: string, idx: number) => (
                              <div key={idx} className="text-xs text-yellow-600">⚠ {warning}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        {product.status === 'ok' && <CheckCircle className="h-5 w-5 text-green-600" />}
                        {product.status === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-600" />}
                        {product.status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* PASO 3: CONFIRMAR IMPORTACIÓN */}
          <Card>
            <CardHeader>
              <CardTitle>3. Confirmar Importación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Se importarán <strong>{validationResult.summary.ok + validationResult.summary.warnings}</strong> productos
                  ({validationResult.summary.ok} OK + {validationResult.summary.warnings} con advertencias).
                </p>
                {validationResult.summary.errors > 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    {validationResult.summary.errors} productos con errores se omitirán.
                  </p>
                )}
              </div>

              {/* Barra de progreso */}
              {importing && importProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Importando productos...</span>
                    <span>{importProgress.current} / {importProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    >
                      {Math.round((importProgress.current / importProgress.total) * 100)}%
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Por favor espera, esto puede tomar varios minutos...
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleExecuteImport}
                  disabled={importing || validationResult.summary.ok + validationResult.summary.warnings === 0}
                  size="lg"
                >
                  {importing ? "Importando..." : "Importar Productos"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setValidationResult(null);
                    setFile(null);
                  }}
                  disabled={importing}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal para activar categorías */}
      <Dialog open={showCategoryModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Activar Categorías
            </DialogTitle>
            <DialogDescription className="space-y-2 text-base">
              <p>
                No tienes categorías activas. Para importar productos, necesitas seleccionar las categorías 
                relacionadas con los productos que vas a vender.
              </p>
              <p className="font-medium text-foreground">
                Selecciona las categorías que correspondan a tu catálogo:
              </p>
              <p className="text-sm italic">
                Puedes modificar esta selección más adelante desde la configuración de tu portal.
              </p>
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[400px] overflow-y-auto space-y-2 py-4">
            {allMarketplaceCategories.map((category) => (
              <div key={category.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  id={`activate-${category.id}`}
                  checked={categoriesToActivate.includes(category.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCategoriesToActivate([...categoriesToActivate, category.id]);
                    } else {
                      setCategoriesToActivate(categoriesToActivate.filter(id => id !== category.id));
                    }
                  }}
                  className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <Label 
                  htmlFor={`activate-${category.id}`}
                  className="text-base font-normal cursor-pointer flex items-center flex-1"
                >
                  {category.icon && (
                    <span className="mr-2 text-xl">
                      {category.icon.startsWith('/icons/') || 
                       category.icon.startsWith('icons/') || 
                       category.icon.startsWith('http') || 
                       category.icon.includes('digitaloceanspaces.com') ? (
                        <img 
                          src={getImageUrl(category.icon)} 
                          alt={category.name} 
                          className="w-8 h-8 object-contain" 
                        />
                      ) : (
                        category.icon
                      )}
                    </span>
                  )}
                  <div>
                    <div className="font-medium">{category.name}</div>
                    {category.description && (
                      <div className="text-sm text-gray-500">{category.description}</div>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleActivateCategories}
              disabled={activatingCategories || categoriesToActivate.length === 0}
              className="w-full"
            >
              {activatingCategories ? "Activando..." : `Activar ${categoriesToActivate.length > 0 ? `(${categoriesToActivate.length})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
       