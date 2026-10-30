"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface ExportField {
  key: string;
  label: string;
  category: string;
  defaultChecked?: boolean;
}

const EXPORT_FIELDS: ExportField[] = [
  // Información básica
  { key: 'id', label: 'ID', category: 'Básico' },
  { key: 'title', label: 'Título', category: 'Básico', defaultChecked: true },
  { key: 'artist', label: 'Artista', category: 'Básico', defaultChecked: true },
  { key: 'album', label: 'Álbum', category: 'Básico', defaultChecked: true },
  { key: 'description', label: 'Descripción', category: 'Básico' },
  { key: 'shortDescription', label: 'Descripción Corta', category: 'Básico' },
  
  // Tipo y condición
  { key: 'type', label: 'Tipo', category: 'Clasificación', defaultChecked: true },
  { key: 'condition', label: 'Condición', category: 'Clasificación', defaultChecked: true },
  { key: 'mediaGrade', label: 'Grado Media (Goldmine)', category: 'Clasificación' },
  { key: 'sleeveGrade', label: 'Grado Portada (Goldmine)', category: 'Clasificación' },
  
  // Información musical
  { key: 'label', label: 'Sello', category: 'Musical' },
  { key: 'year', label: 'Año', category: 'Musical', defaultChecked: true },
  { key: 'country', label: 'País', category: 'Musical' },
  { key: 'genre', label: 'Género (legacy)', category: 'Musical' },
  { key: 'format', label: 'Formato (legacy)', category: 'Musical' },
  { key: 'vinylSize', label: 'Tamaño Vinilo', category: 'Musical' },
  { key: 'tracklist', label: 'Lista de Canciones', category: 'Musical' },
  { key: 'technicalSpecs', label: 'Especificaciones Técnicas', category: 'Musical' },
  
  // Precios e inventario
  { key: 'price', label: 'Precio', category: 'Comercial', defaultChecked: true },
  { key: 'salePrice', label: 'Precio Rebajado', category: 'Comercial' },
  { key: 'isOnSale', label: 'En Oferta', category: 'Comercial' },
  { key: 'wholesalePrice', label: 'Precio Mayorista', category: 'Comercial' },
  { key: 'stock', label: 'Stock', category: 'Comercial', defaultChecked: true },
  { key: 'sku', label: 'SKU', category: 'Comercial', defaultChecked: true },
  { key: 'barcode', label: 'Código de Barras', category: 'Comercial', defaultChecked: true },
  
  // Estado
  { key: 'status', label: 'Estado', category: 'Estado', defaultChecked: true },
  { key: 'isFeatured', label: 'Destacado', category: 'Estado' },
  { key: 'rating', label: 'Calificación', category: 'Estado' },
  { key: 'reviewCount', label: 'Cantidad de Reseñas', category: 'Estado' },
  
  // Integraciones
  { key: 'discogsId', label: 'ID Discogs', category: 'Integraciones' },
  { key: 'spotifyAlbumId', label: 'ID Spotify', category: 'Integraciones' },
  { key: 'spotifyEnabled', label: 'Spotify Habilitado', category: 'Integraciones' },
  { key: 'woocommerceId', label: 'ID WooCommerce', category: 'Integraciones' },
  
  // Relaciones
  { key: 'categories', label: 'Categorías', category: 'Relaciones', defaultChecked: true },
  { key: 'genres', label: 'Géneros', category: 'Relaciones' },
  { key: 'formats', label: 'Formatos', category: 'Relaciones' },
  { key: 'editions', label: 'Ediciones', category: 'Relaciones' },
  { key: 'images', label: 'Imágenes (URLs)', category: 'Relaciones' },
  
  // Fechas
  { key: 'createdAt', label: 'Fecha de Creación', category: 'Fechas' },
  { key: 'updatedAt', label: 'Fecha de Actualización', category: 'Fechas' },
];

export default function ExportProductsPage() {
  const { user } = useAuth();
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(EXPORT_FIELDS.filter(f => f.defaultChecked).map(f => f.key))
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  const categories = Array.from(new Set(EXPORT_FIELDS.map(f => f.category)));

  const toggleField = (key: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedFields(newSelected);
  };

  const selectAllInCategory = (category: string) => {
    const categoryFields = EXPORT_FIELDS.filter(f => f.category === category);
    const newSelected = new Set(selectedFields);
    categoryFields.forEach(f => newSelected.add(f.key));
    setSelectedFields(newSelected);
  };

  const deselectAllInCategory = (category: string) => {
    const categoryFields = EXPORT_FIELDS.filter(f => f.category === category);
    const newSelected = new Set(selectedFields);
    categoryFields.forEach(f => newSelected.delete(f.key));
    setSelectedFields(newSelected);
  };

  const selectAll = () => {
    setSelectedFields(new Set(EXPORT_FIELDS.map(f => f.key)));
  };

  const deselectAll = () => {
    setSelectedFields(new Set());
  };

  const handleExport = async () => {
    if (!user?.vendorId) {
      alert("No se pudo identificar el vendedor");
      return;
    }

    if (selectedFields.size === 0) {
      alert("Por favor selecciona al menos un campo para exportar");
      return;
    }

    setExporting(true);
    try {
      const fields = Array.from(selectedFields);
      console.log('Exportando productos con campos:', fields);
      
      const blob = await api.exportProducts(user.vendorId, fields, statusFilter);
      
      console.log('Blob recibido:', blob.size, 'bytes');
      
      // Crear un link de descarga
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('Descarga iniciada correctamente');
    } catch (error: any) {
      console.error("Error al exportar productos:", error);
      alert(`Error al exportar: ${error.message || 'Error desconocido'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Link href="/dashboard/products">
        <Button variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Productos
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Exportar Productos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              📊 Exportación de Productos
            </h3>
            <p className="text-sm text-blue-800">
              Selecciona los campos que deseas incluir en el archivo Excel. 
              Se exportarán todos tus productos con los campos seleccionados.
            </p>
          </div>

          {/* Filtro de estado */}
          <div className="flex items-center gap-3">
            <Label htmlFor="status-filter" className="font-medium whitespace-nowrap">Productos a exportar:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter" className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (activos e inactivos)</SelectItem>
                <SelectItem value="active">Solo activos</SelectItem>
                <SelectItem value="inactive">Solo inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Acciones globales */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={selectAll}
            >
              Seleccionar Todos
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={deselectAll}
            >
              Deseleccionar Todos
            </Button>
          </div>

          {/* Campos por categoría */}
          <div className="space-y-6">
            {categories.map(category => {
              const categoryFields = EXPORT_FIELDS.filter(f => f.category === category);
              const selectedInCategory = categoryFields.filter(f => selectedFields.has(f.key)).length;
              
              return (
                <div key={category} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">
                      {category} ({selectedInCategory}/{categoryFields.length})
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => selectAllInCategory(category)}
                      >
                        Todos
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deselectAllInCategory(category)}
                      >
                        Ninguno
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {categoryFields.map(field => (
                      <div key={field.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={field.key}
                          checked={selectedFields.has(field.key)}
                          onCheckedChange={() => toggleField(field.key)}
                        />
                        <Label
                          htmlFor={field.key}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {field.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botón de exportar */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleExport}
              disabled={exporting || selectedFields.size === 0}
              className="min-w-[200px]"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar a Excel ({selectedFields.size} campos)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
