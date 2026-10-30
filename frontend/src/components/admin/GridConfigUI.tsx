"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface GridConfig {
  id?: string;
  type: 'homepage' | 'category';
  columns: number;
  rows: number | null;
  displayMode: 'specific-category' | 'latest' | 'featured' | 'best-sellers';
  categoryId?: string;
  sortBy?: 'newest' | 'most-sold' | 'featured';
  gridStyle?: 'spaced' | 'compact';
  isActive: boolean;
  order: number;
}

interface GridConfigUIProps {
  vendorId: string;
  categories?: any[];
}

const displayModeLabels = {
  'specific-category': 'Categoría Específica',
  'latest': 'Últimos Productos Agregados',
  'featured': 'Productos Destacados',
  'best-sellers': 'Productos Más Vendidos',
};

const sortByLabels = {
  'newest': 'Más Recientes',
  'most-sold': 'Más Vendidos',
  'featured': 'Destacados',
};

export default function GridConfigUI({ vendorId, categories = [] }: GridConfigUIProps) {
  const [homepageGrids, setHomepageGrids] = useState<GridConfig[]>([]);
  const [categoryGrids, setCategoryGrids] = useState<GridConfig[]>([]);
  const [expandedGrids, setExpandedGrids] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadGridConfig();
  }, [vendorId]);

  const toggleGrid = (gridId: string) => {
    setExpandedGrids(prev => ({
      ...prev,
      [gridId]: !prev[gridId]
    }));
  };

  const handleDragEnd = (event: DragEndEvent, type: 'homepage' | 'category') => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      if (type === 'homepage') {
        setHomepageGrids((items) => {
          const oldIndex = items.findIndex((item) => item.id === active.id);
          const newIndex = items.findIndex((item) => item.id === over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
      } else {
        setCategoryGrids((items) => {
          const oldIndex = items.findIndex((item) => item.id === active.id);
          const newIndex = items.findIndex((item) => item.id === over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
  };

  const loadGridConfig = async () => {
    try {
      const data = await api.getVendorGridConfig(vendorId);
      const grids = data.gridConfig || [];
      
      setHomepageGrids(grids.filter((g: GridConfig) => g.type === 'homepage').sort((a: GridConfig, b: GridConfig) => a.order - b.order));
      setCategoryGrids(grids.filter((g: GridConfig) => g.type === 'category').sort((a: GridConfig, b: GridConfig) => a.order - b.order));
    } catch (error) {
      console.error("Error loading grid config:", error);
    } finally {
      setLoading(false);
    }
  };

  const addGrid = (type: 'homepage' | 'category') => {
    const newGrid: GridConfig = {
      id: Math.random().toString(),
      type,
      columns: 4,
      rows: null,
      displayMode: 'latest',
      gridStyle: 'spaced',
      isActive: true,
      order: type === 'homepage' ? homepageGrids.length : categoryGrids.length,
    };

    if (type === 'homepage') {
      setHomepageGrids([...homepageGrids, newGrid]);
    } else {
      setCategoryGrids([...categoryGrids, newGrid]);
    }
  };

  const removeGrid = (type: 'homepage' | 'category', index: number) => {
    if (type === 'homepage') {
      setHomepageGrids(homepageGrids.filter((_, i) => i !== index));
    } else {
      setCategoryGrids(categoryGrids.filter((_, i) => i !== index));
    }
  };

  const updateGrid = (type: 'homepage' | 'category', index: number, field: string, value: any) => {
    if (type === 'homepage') {
      const updated = [...homepageGrids];
      updated[index] = { ...updated[index], [field]: value };
      setHomepageGrids(updated);
    } else {
      const updated = [...categoryGrids];
      updated[index] = { ...updated[index], [field]: value };
      setCategoryGrids(updated);
    }
  };

  const saveGridConfig = async () => {
    setSaving(true);
    try {
      const allGrids = [
        ...homepageGrids.map((g, i) => ({ ...g, order: i })),
        ...categoryGrids.map((g, i) => ({ ...g, order: i })),
      ];

      await api.updateVendorGridConfig(vendorId, allGrids);
      alert('Grid configuration saved successfully');
    } catch (error) {
      console.error("Error saving grid config:", error);
      alert('Error saving grid configuration');
    } finally {
      setSaving(false);
    }
  };

  // Componente Sortable para cada Grid
  const SortableGridItem = ({ 
    grid, 
    index, 
    gridType, 
    isExpanded, 
    onToggle 
  }: { 
    grid: GridConfig; 
    index: number; 
    gridType: 'homepage' | 'category';
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: grid.id! });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div ref={setNodeRef} style={style}>
        <Card className="relative">
          {/* Header con drag handle */}
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
            onClick={onToggle}
          >
            <div className="flex items-center gap-3">
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                <GripVertical className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Grid #{index + 1}
                  {!grid.isActive && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Inactivo</span>}
                </h3>
                <p className="text-sm text-gray-500">
                  {grid.columns} columnas × {grid.rows || '∞'} filas
                  {gridType === 'homepage' && grid.displayMode && ` • ${displayModeLabels[grid.displayMode]}`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {/* Contenido expandible */}
          {isExpanded && (
            <CardContent className="space-y-4 border-t pt-4">
              {/* Columns and Rows */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`columns-${grid.id}`}>Columnas *</Label>
                  <Input
                    id={`columns-${grid.id}`}
                    type="number"
                    min="1"
                    max="5"
                    value={grid.columns}
                    onChange={(e) => updateGrid(gridType, index, 'columns', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor={`rows-${grid.id}`}>Filas (vacío = Ilimitado)</Label>
                  <Input
                    id={`rows-${grid.id}`}
                    type="number"
                    min="1"
                    value={grid.rows || ''}
                    onChange={(e) =>
                      updateGrid(gridType, index, 'rows', e.target.value ? parseInt(e.target.value) : null)
                    }
                    placeholder="Vacío para Infinite Scroll"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {grid.rows ? `Mostrará ${grid.rows} × ${grid.columns} = ${grid.rows * grid.columns} productos` : 'Scroll infinito habilitado'}
                  </p>
                </div>
              </div>

              {/* Grid Style */}
              <div>
                <Label htmlFor={`gridStyle-${grid.id}`}>Estilo de Grid</Label>
                <select
                  id={`gridStyle-${grid.id}`}
                  value={grid.gridStyle || 'spaced'}
                  onChange={(e) => updateGrid(gridType, index, 'gridStyle', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="spaced">Con espacios</option>
                  <option value="compact">Compacto (sin espacios)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {grid.gridStyle === 'compact' 
                    ? 'Los productos estarán pegados sin separación' 
                    : 'Los productos tendrán espacios entre ellos'}
                </p>
              </div>

              {/* Display Mode - Only for Homepage */}
              {gridType === 'homepage' && (
                <div>
                  <Label htmlFor={`display-${grid.id}`}>Tipo de Productos *</Label>
                  <select
                    id={`display-${grid.id}`}
                    value={grid.displayMode}
                    onChange={(e) => updateGrid(gridType, index, 'displayMode', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {Object.entries(displayModeLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category Selection - Only for Homepage (if specific-category) */}
              {gridType === 'homepage' && grid.displayMode === 'specific-category' && (
                <div>
                  <Label htmlFor={`category-${grid.id}`}>Selecciona Categoría *</Label>
                  <select
                    id={`category-${grid.id}`}
                    value={grid.categoryId || ''}
                    onChange={(e) => updateGrid(gridType, index, 'categoryId', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Selecciona una categoría --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sort By */}
              <div>
                <Label htmlFor={`sort-${grid.id}`}>Ordenar Por</Label>
                <select
                  id={`sort-${grid.id}`}
                  value={grid.sortBy || 'newest'}
                  onChange={(e) => updateGrid(gridType, index, 'sortBy', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Object.entries(sortByLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`active-${grid.id}`}
                  checked={grid.isActive}
                  onChange={(e) => updateGrid(gridType, index, 'isActive', e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor={`active-${grid.id}`} className="cursor-pointer">
                  Mostrar este grid
                </Label>
              </div>

              {/* Remove Button */}
              <div className="flex justify-end pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeGrid(gridType, index)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar Grid
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  };

  const renderGridEditor = (grids: GridConfig[], gridType: 'homepage' | 'category') => (
    <div className="space-y-4">
      {grids.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No grids configured yet</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleDragEnd(event, gridType)}
        >
          <SortableContext
            items={grids.map(g => g.id!)}
            strategy={verticalListSortingStrategy}
          >
            {grids.map((grid, index) => (
              <SortableGridItem
                key={grid.id}
                grid={grid}
                index={index}
                gridType={gridType}
                isExpanded={expandedGrids[grid.id!] ?? false}
                onToggle={() => toggleGrid(grid.id!)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* Add Grid Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => addGrid(gridType)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Agregar Grid {gridType === 'homepage' ? 'Portada' : 'Categoría'}
      </Button>
    </div>
  );

  if (loading) {
    return <div className="text-center py-4">Cargando configuración...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Grids</CardTitle>
        <CardDescription>
          Configura los grids para la portada y categorías. Usa Infinite Scroll (dejando Filas vacío) para cargar productos al hacer scroll.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="homepage" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="homepage">Grid Portada</TabsTrigger>
            <TabsTrigger value="category">Grid Categoría</TabsTrigger>
          </TabsList>

          <TabsContent value="homepage" className="space-y-4 mt-4">
            {renderGridEditor(homepageGrids, 'homepage')}
            {homepageGrids.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium mb-1">💡 Tip: Infinite Scroll</p>
                <p>Deja el campo "Filas" vacío para cargar productos automáticamente al hacer scroll (Infinite Scroll)</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="category" className="space-y-4 mt-4">
            {renderGridEditor(categoryGrids, 'category')}
            {categoryGrids.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium mb-1">💡 Tip: Infinite Scroll</p>
                <p>Deja el campo "Filas" vacío para cargar productos automáticamente al hacer scroll (Infinite Scroll)</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end mt-6 pt-6 border-t">
          <Button
            onClick={saveGridConfig}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
