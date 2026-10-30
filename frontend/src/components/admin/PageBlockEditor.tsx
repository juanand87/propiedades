"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface PageBlockEditorProps {
  block: any;
  categories: any[];
  onUpdate: (updated: any) => void;
  onDelete: () => void;
}

const blockTypeLabels = {
  text: "Cuadro de Texto",
  grid: "Grid Personalizado",
  slides: "Slides",
  image: "Imagen",
  video: "Video",
};

const gridDisplayModes = {
  latest: "Últimos Productos",
  featured: "Productos Destacados",
  "best-sellers": "Más Vendidos",
  "specific-category": "Categoría Específica",
};

export default function PageBlockEditor({
  block,
  categories,
  onUpdate,
  onDelete,
}: PageBlockEditorProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="border-l-4 border-l-purple-600">
      <CardContent className="p-4">
        {/* Block Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <div>
              <p className="font-semibold text-gray-900">
                {blockTypeLabels[block.type as keyof typeof blockTypeLabels]}
              </p>
              <p className="text-sm text-gray-600">
                {block.columns === 1 ? "Ancho completo" : `${block.columns} columnas`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {expanded && (
          <div className="space-y-4 pt-4 border-t">
            {/* Columns Setting */}
            <div>
              <Label htmlFor={`columns-${block.id}`}>Ancho del Bloque</Label>
              <select
                id={`columns-${block.id}`}
                value={block.columns}
                onChange={(e) => onUpdate({ columns: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="1">Ancho completo (1 columna)</option>
                <option value="2">Medio ancho (2 columnas)</option>
                <option value="3">1/3 ancho (3 columnas)</option>
                <option value="4">1/4 ancho (4 columnas)</option>
              </select>
            </div>

            {/* Block Type Specific Fields */}
            {block.type === "text" && (
              <div>
                <Label htmlFor={`text-${block.id}`}>Contenido de Texto</Label>
                <Textarea
                  id={`text-${block.id}`}
                  value={block.text || ""}
                  onChange={(e) => onUpdate({ text: e.target.value })}
                  placeholder="Escribe el contenido aquí..."
                  rows={4}
                />
              </div>
            )}

            {block.type === "grid" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor={`grid-mode-${block.id}`}>Tipo de Productos</Label>
                  <select
                    id={`grid-mode-${block.id}`}
                    value={block.gridConfig?.displayMode || "latest"}
                    onChange={(e) =>
                      onUpdate({
                        gridConfig: {
                          ...block.gridConfig,
                          displayMode: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {Object.entries(gridDisplayModes).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {block.gridConfig?.displayMode === "specific-category" && (
                  <div>
                    <Label htmlFor={`grid-category-${block.id}`}>Categoría</Label>
                    <select
                      id={`grid-category-${block.id}`}
                      value={block.gridConfig?.categoryId || ""}
                      onChange={(e) =>
                        onUpdate({
                          gridConfig: {
                            ...block.gridConfig,
                            categoryId: e.target.value,
                          },
                        })
                      }
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`grid-cols-${block.id}`}>Columnas</Label>
                    <Input
                      id={`grid-cols-${block.id}`}
                      type="number"
                      min="1"
                      max="5"
                      value={block.gridConfig?.columns || 4}
                      onChange={(e) =>
                        onUpdate({
                          gridConfig: {
                            ...block.gridConfig,
                            columns: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`grid-rows-${block.id}`}>Filas (vacío = ilimitado)</Label>
                    <Input
                      id={`grid-rows-${block.id}`}
                      type="number"
                      min="1"
                      value={block.gridConfig?.rows || ""}
                      onChange={(e) =>
                        onUpdate({
                          gridConfig: {
                            ...block.gridConfig,
                            rows: e.target.value ? parseInt(e.target.value) : null,
                          },
                        })
                      }
                      placeholder="Vacío para ilimitado"
                    />
                  </div>
                </div>
              </div>
            )}

            {block.type === "image" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor={`image-url-${block.id}`}>URL de la Imagen</Label>
                  <Input
                    id={`image-url-${block.id}`}
                    value={block.imageUrl || ""}
                    onChange={(e) => onUpdate({ imageUrl: e.target.value })}
                    placeholder="https://ejemplo.com/imagen.jpg"
                  />
                </div>
                <div>
                  <Label htmlFor={`image-alt-${block.id}`}>Texto Alternativo</Label>
                  <Input
                    id={`image-alt-${block.id}`}
                    value={block.imageAlt || ""}
                    onChange={(e) => onUpdate({ imageAlt: e.target.value })}
                    placeholder="Descripción de la imagen"
                  />
                </div>
                <div>
                  <Label htmlFor={`image-link-${block.id}`}>Link (opcional)</Label>
                  <Input
                    id={`image-link-${block.id}`}
                    value={block.imageLink || ""}
                    onChange={(e) => onUpdate({ imageLink: e.target.value })}
                    placeholder="https://ejemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor={`image-target-${block.id}`}>Abrir enlace</Label>
                  <select
                    id={`image-target-${block.id}`}
                    value={block.imageLinkTarget || "_self"}
                    onChange={(e) => onUpdate({ imageLinkTarget: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="_self">Misma pestana</option>
                    <option value="_blank">Nueva pestana</option>
                  </select>
                </div>
              </div>
            )}

            {block.type === "video" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor={`video-type-${block.id}`}>Tipo de Video</Label>
                  <select
                    id={`video-type-${block.id}`}
                    value={block.videoType || "youtube"}
                    onChange={(e) => onUpdate({ videoType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="vimeo">Vimeo</option>
                    <option value="custom">URL personalizada</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor={`video-url-${block.id}`}>URL del Video</Label>
                  <Input
                    id={`video-url-${block.id}`}
                    value={block.videoUrl || ""}
                    onChange={(e) => onUpdate({ videoUrl: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>
                <div>
                  <Label htmlFor={`video-thumb-${block.id}`}>Thumbnail (opcional)</Label>
                  <Input
                    id={`video-thumb-${block.id}`}
                    value={block.videoThumbnail || ""}
                    onChange={(e) => onUpdate({ videoThumbnail: e.target.value })}
                    placeholder="URL de la imagen de portada"
                  />
                </div>
              </div>
            )}

            {block.type === "slides" && (
              <div>
                <Label htmlFor={`slides-${block.id}`}>Slides (ID separados por comas)</Label>
                <Textarea
                  id={`slides-${block.id}`}
                  value={(block.slideIds || []).join(", ")}
                  onChange={(e) =>
                    onUpdate({
                      slideIds: e.target.value.split(",").map((s) => s.trim()),
                    })
                  }
                  placeholder="slide-1, slide-2, slide-3"
                  rows={2}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Selecciona los slides que configuraste en Diseño → Slides
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
