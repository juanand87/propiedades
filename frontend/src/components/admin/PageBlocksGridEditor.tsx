"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, GripVertical, Plus, Image as ImageIcon, ExternalLink } from "lucide-react";
import MediaLibrary from "./MediaLibrary";
import { api } from "@/lib/api";
import { HTMLEditor } from "@/components/ui/html-editor";

interface BlockRow {
  id: string;
  columns: number;
  blocks: any[];
}

interface PageBlocksGridEditorProps {
  blocks: any[];
  categories: any[];
  rowsConfig?: any[];
  vendorId?: string;
  onBlocksChange: (blocks: any[]) => void;
  onBlockUpdate: (blockId: string, updated: any) => void;
  onBlockDelete: (blockId: string) => void;
  onRowsConfigChange?: (rowsConfig: any[]) => void;
}

const blockTypeLabels = {
  text: "📝 Texto",
  grid: "📊 Grid",
  slides: "🎬 Slides",
  image: "🖼️ Imagen",
  video: "🎥 Video",
  imageText: "🖼️ Texto e Imagen",
  carousel: "🎠 Carrusel",
  imageCarousel: "🎞️ Carrusel de Imágenes",
  component: "🧩 Componente Predefinido",
};

function crearBloqueVacio(type: string): any {
  const id = `block-${Date.now()}-${Math.random()}`;

  switch (type) {
    case "text":
      return {
        id,
        type: "text",
        columns: 1,
        row: 0,
        column: 1,
        text: "",
      };
    case "grid":
      return {
        id,
        type: "grid",
        columns: 1,
        row: 0,
        column: 1,
        gridConfig: {
          displayMode: "latest",
          columns: 4,
          rows: 3,
          sortBy: "newest",
        },
      };
    case "image":
      return {
        id,
        type: "image",
        columns: 1,
        row: 0,
        column: 1,
        imageUrl: "",
        imageAlt: "",
        imageLink: "",
        imageLinkTarget: "_self",
      };
    case "video":
      return {
        id,
        type: "video",
        columns: 1,
        row: 0,
        column: 1,
        videoUrl: "",
        videoType: "youtube",
      };
    case "slides":
      return {
        id,
        type: "slides",
        columns: 1,
        row: 0,
        column: 1,
        sliderId: "",
      };
    case "imageText":
      return {
        id,
        type: "imageText",
        columns: 1,
        row: 0,
        column: 1,
        backgroundImage: "",
        title: "",
        text: "",
        buttonText: "Ver más",
        buttonLink: "",
      };
    case "carousel":
      return {
        id,
        type: "carousel",
        columns: 1,
        row: 0,
        column: 1,
        carouselConfig: {
          displayMode: "latest",
          scope: "marketplace",
          visibleItems: 4,
          limit: 12,
          title: "",
          showTitle: true,
          scrollSpeed: "normal",
          showArrows: true,
          showDots: true,
          categoryId: "",
          genre: "",
        },
      };
    case "imageCarousel":
      return {
        id,
        type: "imageCarousel",
        columns: 1,
        row: 0,
        column: 1,
        imageCarouselConfig: {
          images: [],
          scrollSpeed: "normal",
          imageHeight: 400,
          gap: 8,
        },
      };
    case "component":
      return {
        id,
        type: "component",
        columns: 1,
        row: 0,
        column: 1,
        componentName: "goldmine-scale", // default
      };
    default:
      return {
        id,
        type: "text",
        columns: 1,
        row: 0,
        column: 1,
        text: "",
      };
  }
}

// Componente wrapper para evitar hydration mismatch
function DragDropContent({
  blocks,
  categories,
  rowsConfig,
  vendorId,
  onBlocksChange,
  onBlockUpdate,
  onBlockDelete,
  onRowsConfigChange,
}: PageBlocksGridEditorProps) {
  const migrationExecutedRef = useRef(false);
  const isDeletingRowRef = useRef(false);
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [pendingMigratedBlocks, setPendingMigratedBlocks] = useState<any[] | null>(null);
  const [rows, setRows] = useState<BlockRow[]>([]);
  const initializedRef = useRef(false);
  const [sliders, setSliders] = useState<any[]>([]);

  // Auto-migrate blocks that don't have row/column properties (only once per session)
  const migrateBlocksWithPositions = useCallback((blocks: any[]): any[] => {
    if (migrationExecutedRef.current) {
      return blocks; // Skip migration if already executed
    }

    let needsMigration = false;
    const migratedBlocks = blocks.map((block, index) => {
      if (block.row === undefined || block.column === undefined) {
        needsMigration = true;
        const newRow = Math.floor(index / 4); // 4 blocks per row
        const newColumn = (index % 4) + 1; // 1-based column
        console.log(`[Migration] 🔧 Assigning position to block ${index}: row=${newRow}, column=${newColumn}`);
        return {
          ...block,
          row: newRow,
          column: newColumn
        };
      }
      return block;
    });

    if (needsMigration) {
      console.log(`[Migration] 🚀 Migrated ${blocks.length} blocks with positions (session migration complete)`);
      migrationExecutedRef.current = true; // Mark migration as executed
      // Schedule update via state instead of calling onBlocksChange during render
      setPendingMigratedBlocks(migratedBlocks);
    }

    return migratedBlocks;
  }, []);

  const organizarBlocksEnRowsYColumnas = useCallback((blocks: any[], pageRowsConfig?: any[]): BlockRow[] => {
    console.log(`[organizarBlocksEnRowsYColumnas] 📊 Processing ${blocks?.length || 0} blocks, rowsConfig:`, pageRowsConfig);
    
    // Auto-migrate blocks without positions
    const processedBlocks = blocks.length ? migrateBlocksWithPositions(blocks) : [];
    
    const rows: { [key: number]: any[] } = {};
    
    // First, organize blocks by row
    processedBlocks.forEach((block) => {
      const row = block.row || 0;
      if (!rows[row]) {
        rows[row] = [];
      }
      rows[row].push(block);
    });

    // Then, ensure we include all rows from rowsConfig (including empty ones)
    const allRowIndices = new Set<number>();
    
    // Add rows that have blocks
    Object.keys(rows).forEach(rowNum => {
      allRowIndices.add(parseInt(rowNum));
    });
    
    // Add rows that are in rowsConfig but might not have blocks
    pageRowsConfig?.forEach(config => {
      allRowIndices.add(config.row);
    });

    // If no rows exist at all, create at least one empty row
    if (allRowIndices.size === 0) {
      allRowIndices.add(0);
    }

    const result = Array.from(allRowIndices)
      .sort((a, b) => a - b)
      .map((rowIndex, idx) => {
        // Use saved column configuration if available, otherwise default to 4
        const savedRowConfig = pageRowsConfig?.find(config => config.row === rowIndex);
        const columns = savedRowConfig?.columns || 4;
        
        return {
          id: `row-${idx}`,
          columns: columns,
          blocks: rows[rowIndex] || [],
        };
      });
    
    console.log(`[organizarBlocksEnRowsYColumnas] ✅ Generated ${result.length} rows with ${result.reduce((acc, row) => acc + row.blocks.length, 0)} total blocks`);
    return result;
  }, [migrateBlocksWithPositions]);

  // Initialize rows on mount
  useEffect(() => {
    if (!initializedRef.current) {
      console.log(`[PageBlocksGridEditor] 🎬 Initial organization of blocks`);
      setRows(organizarBlocksEnRowsYColumnas(blocks, rowsConfig));
      initializedRef.current = true;
    }
  }, []);

  // Load sliders when vendorId is available
  useEffect(() => {
    if (vendorId) {
      loadSliders();
    }
  }, [vendorId]);

  const loadSliders = async () => {
    if (!vendorId) return;
    try {
      const data = await api.getVendorSettings(vendorId);
      if (data.slides && Array.isArray(data.slides)) {
        setSliders(data.slides);
        console.log(`[PageBlocksGridEditor] 🎬 Loaded ${data.slides.length} sliders`);
      }
    } catch (error) {
      console.error("Error loading sliders:", error);
    }
  };

  // Handle migration updates in effect
  useEffect(() => {
    if (pendingMigratedBlocks) {
      console.log(`[Migration] 📤 Applying migrated blocks to parent`);
      onBlocksChange(pendingMigratedBlocks);
      setPendingMigratedBlocks(null);
    }
  }, [pendingMigratedBlocks, onBlocksChange]);

  // Sync internal state with props changes
  useEffect(() => {
    // Skip sync if we're in the middle of a row deletion
    if (isDeletingRowRef.current) {
      console.log(`[PageBlocksGridEditor] ⏭️ Skipping sync during row deletion`);
      isDeletingRowRef.current = false;
      return;
    }
    // Skip initial sync since we handle it separately
    if (!initializedRef.current) {
      return;
    }
    console.log(`[PageBlocksGridEditor] 🔄 Syncing ${blocks?.length || 0} blocks to rows`);
    setRows(organizarBlocksEnRowsYColumnas(blocks, rowsConfig));
  }, [blocks, rowsConfig, organizarBlocksEnRowsYColumnas]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.id.toString().startsWith("block-type-")) {
      setDraggedType(event.active.data.current?.type);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedType(null);

    if (!over) return;

    // Si estamos arrastrando una fila (row-to-row reordering)
    if (!active.id.toString().startsWith("block-type-") && !active.id.toString().startsWith("cell-")) {
      // This is a row being dragged
      const activeRowId = active.id.toString();
      const overRowId = over.id.toString();
      
      if (activeRowId !== overRowId) {
        const oldIndex = rows.findIndex((row: any) => row.id === activeRowId);
        const newIndex = rows.findIndex((row: any) => row.id === overRowId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          console.log(`[handleDragEnd] 🔄 Reordering row from ${oldIndex} to ${newIndex}`);
          
          // Reorder rows array
          const reorderedRows = [...rows];
          const [movedRow] = reorderedRows.splice(oldIndex, 1);
          reorderedRows.splice(newIndex, 0, movedRow);
          
          // Update row indices in blocks
          const updatedBlocks = blocks.map((block: any) => {
            const newRowIndex = reorderedRows.findIndex((row: any) => 
              row.blocks.some((b: any) => b.id === block.id)
            );
            if (newRowIndex !== -1 && newRowIndex !== block.row) {
              console.log(`[handleDragEnd] 📦 Updating block ${block.id} from row ${block.row} to ${newRowIndex}`);
              return { ...block, row: newRowIndex };
            }
            return block;
          });
          
          // Update rowsConfig
          const updatedRowsConfig = reorderedRows.map((row: any, index: number) => ({
            row: index,
            columns: row.columns || 4
          }));
          
          setRows(reorderedRows);
          onBlocksChange(updatedBlocks);
          if (onRowsConfigChange) {
            onRowsConfigChange(updatedRowsConfig);
          }
        }
      }
      return;
    }

    // Si estamos arrastrando un tipo de bloque
    if (active.id.toString().startsWith("block-type-")) {
      const blockType = active.data.current?.type;
      const targetCellId = over.id.toString();

      if (targetCellId.startsWith("cell-")) {
        // Parsear el cellId: "cell-rowIndex-columnIndex" (ambos 1-based después de cambios)
        const parts = targetCellId.split("-");
        const rowIndex = parseInt(parts[1]);
        const columnIndex = parseInt(parts[2]); // Ya está en formato 1-based

        // Crear nuevo bloque
        const newBlock = crearBloqueVacio(blockType);
        newBlock.row = rowIndex;
        newBlock.column = columnIndex;

        // Actualizar el estado global de bloques
        const newBlocks = [...blocks, newBlock];
        onBlocksChange(newBlocks);

        // Actualizar el estado local de rows
        const updatedRows = rows.map((row, idx) => {
          if (idx === rowIndex) {
            return {
              ...row,
              blocks: [...row.blocks, newBlock],
            };
          }
          return row;
        });
        setRows(updatedRows);
      }
    }
  };

  const addNewRow = () => {
    const newRowIndex = rows.length;
    console.log(`[addNewRow] Adding new row at index ${newRowIndex}`);
    
    // Add the new row configuration to rowsConfig
    if (onRowsConfigChange) {
      const currentRowsConfig = rowsConfig || [];
      const updatedRowsConfig = [...currentRowsConfig];
      
      // Add configuration for the new row
      updatedRowsConfig.push({ row: newRowIndex, columns: 4 });
      
      console.log(`[addNewRow] Updated rows config:`, updatedRowsConfig);
      onRowsConfigChange(updatedRowsConfig);
    }
  };

  const deleteRow = (rowIndex: number) => {
    console.log(`[deleteRow] 🗑️ Deleting row at index ${rowIndex}`);
    
    // Set flag to prevent useEffect from re-syncing immediately
    isDeletingRowRef.current = true;
    
    // Get IDs of all blocks in this row
    const blocksToDelete = rows[rowIndex]?.blocks?.map((b) => b.id) || [];
    console.log(`[deleteRow] 🗑️ Deleting ${blocksToDelete.length} blocks:`, blocksToDelete);
    console.log(`[deleteRow] 📊 Current blocks in state:`, blocks.map(b => ({ id: b.id, row: b.row, column: b.column })));
    
    // Update local state immediately - remove the row
    const updatedRows = rows
      .filter((_, idx) => idx !== rowIndex)
      .map((row, idx) => ({
        ...row,
        id: `row-${idx}`,
        blocks: row.blocks.map(block => ({
          ...block,
          row: idx
        }))
      }));
    
    setRows(updatedRows);
    
    // Filter out deleted blocks and adjust row indices in one operation
    const updatedBlocks = blocks
      .filter(block => !blocksToDelete.includes(block.id)) // Remove deleted blocks
      .map(block => ({
        ...block,
        row: block.row > rowIndex ? block.row - 1 : block.row // Adjust row indices
      }));
    
    console.log(`[deleteRow] 📦 Blocks before: ${blocks.length}, after: ${updatedBlocks.length}`);
    console.log(`[deleteRow] 📊 Updated blocks:`, updatedBlocks.map(b => ({ id: b.id, row: b.row, column: b.column })));
    
    // Update blocks in parent - THIS IS THE SINGLE SOURCE OF TRUTH
    onBlocksChange(updatedBlocks);
    
    // Update rowsConfig to remove this row and adjust indices of following rows
    if (onRowsConfigChange) {
      const currentRowsConfig = rowsConfig || [];
      const updatedRowsConfig = currentRowsConfig
        .filter(config => config.row !== rowIndex) // Remove the deleted row
        .map(config => ({
          ...config,
          row: config.row > rowIndex ? config.row - 1 : config.row // Adjust indices
        }));
      
      console.log(`[deleteRow] 📐 RowsConfig before: ${currentRowsConfig.length}, after: ${updatedRowsConfig.length}`);
      onRowsConfigChange(updatedRowsConfig);
    }
  };

  const deleteBlockFromGrid = (blockId: string) => {
    console.log(`[deleteBlockFromGrid] 🗑️ Deleting block: ${blockId}`);
    console.log(`[deleteBlockFromGrid] 📊 Blocks before:`, blocks.map(b => ({ id: b.id, row: b.row, column: b.column })));
    
    // Set flag to prevent useEffect from re-syncing
    isDeletingRowRef.current = true;
    
    // Update local rows state - remove block (keep empty rows)
    const updatedRows = rows.map((row) => ({
      ...row,
      blocks: row.blocks.filter((b) => b.id !== blockId),
    }));
    
    setRows(updatedRows);
    
    // Update parent blocks state - simply filter out the deleted block
    const updatedBlocks = blocks.filter(b => b.id !== blockId);
    
    console.log(`[deleteBlockFromGrid] 📊 Blocks after: ${updatedBlocks.length}`, updatedBlocks.map(b => ({ id: b.id, row: b.row, column: b.column })));
    
    // THIS IS THE SINGLE SOURCE OF TRUTH - update parent state
    onBlocksChange(updatedBlocks);
  };

  // Combinar todos los items en un único listado
  const allItemIds = [
    ...Object.keys(blockTypeLabels).map((key) => `block-type-${key}`),
    ...rows.flatMap((row: any, rowIdx: number) =>
      Array.from({ length: 6 }, (_, colIdx) => `cell-${rowIdx}-${colIdx}`)
    ),
  ];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allItemIds}>
        <div className="space-y-6">
          {/* Bloques disponibles */}
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
            <CardHeader>
              <CardTitle className="text-sm">Bloques Disponibles</CardTitle>
              <p className="text-xs text-gray-600 mt-1">Arrastra un bloque a la grilla para agregarlo</p>
            </CardHeader>
            <CardContent>
              <BlockPaletteWithDnd draggedType={draggedType} />
            </CardContent>
          </Card>

          {/* Grilla de edición */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contenido de la Página</CardTitle>
              <Button onClick={addNewRow} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Fila
              </Button>
            </CardHeader>
            <CardContent>
              <EditorGrid
                rows={rows}
                blocks={blocks}
                categories={categories}
                vendorId={vendorId}
                rowsConfig={rowsConfig}
                onDeleteRow={deleteRow}
                onDeleteBlock={deleteBlockFromGrid}
                onBlockUpdate={onBlockUpdate}
                onBlocksChange={onBlocksChange}
                onRowsConfigChange={onRowsConfigChange}
                sliders={sliders}
              />
            </CardContent>
          </Card>
        </div>
      </SortableContext>
    </DndContext>
  );
}

export default function PageBlocksGridEditor(props: PageBlocksGridEditorProps) {
  return <DragDropContent {...props} />;
}

// Componente para la paleta de bloques
function BlockPaletteWithDnd({ draggedType }: any) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Object.entries(blockTypeLabels).map(([key, label]) => (
        <PaletteBlockItem
          key={key}
          id={`block-type-${key}`}
          type={key}
          label={label}
          isDragging={draggedType === key}
        />
      ))}
    </div>
  );
}

// Item individual en la paleta
function PaletteBlockItem({ id, type, label, isDragging }: any) {
  const { attributes, listeners, setNodeRef, transform } = useSortable({
    id,
    data: { type },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 rounded-lg border-2 border-dashed cursor-grab active:cursor-grabbing text-center transition-all ${
        isDragging
          ? "border-purple-400 bg-purple-100"
          : "border-purple-300 bg-white hover:bg-purple-50"
      }`}
    >
      <div className="text-2xl mb-1">{label.split(" ")[0]}</div>
      <div className="text-xs font-medium text-gray-700">
        {label.split(" ").slice(1).join(" ")}
      </div>
    </div>
  );
}

// Componente para la grilla de edición
function EditorGridWithDnd({
  rows,
  blocks,
  categories,
  vendorId,
  rowsConfig,
  onDragEnd,
  onDeleteRow,
  onDeleteBlock,
  onBlockUpdate,
  onBlocksChange,
  onRowsConfigChange,
}: any) {
  const cellIds = rows.flatMap((row: any, rowIdx: number) =>
    Array.from({ length: 6 }, (_, colIdx) => `cell-${rowIdx}-${colIdx}`)
  );

  return (
    <SortableContext items={cellIds}>
      {rows.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-4">Arrastra bloques aquí para comenzar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map((row: any, rowIndex: number) => (
            <GridRowItem
              key={row.id}
              rowIndex={rowIndex}
              row={row}
              blocks={blocks}
              rowsConfig={rowsConfig}
              onDeleteRow={() => onDeleteRow(rowIndex)}
              onDeleteBlock={onDeleteBlock}
              onBlockUpdate={onBlockUpdate}
              onBlocksChange={onBlocksChange}
              onRowsConfigChange={onRowsConfigChange}
              categories={categories}
            />
          ))}
        </div>
      )}
    </SortableContext>
  );
}

// Componente para la grilla de edición
function EditorGrid({
  rows,
  blocks,
  categories,
  vendorId,
  rowsConfig,
  onDeleteRow,
  onDeleteBlock,
  onBlockUpdate,
  onBlocksChange,
  onRowsConfigChange,
  onRowReorder,
  sliders,
}: any) {
  const rowIds = rows.map((row: any) => row.id);

  return (
    <>
      {rows.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-4">Arrastra bloques aquí para comenzar</p>
        </div>
      ) : (
        <SortableContext items={rowIds}>
          <div className="space-y-6">
            {rows.map((row: any, rowIndex: number) => (
              <GridRowItem
                key={row.id}
                rowIndex={rowIndex}
                row={row}
                blocks={blocks}
                vendorId={vendorId}
                rowsConfig={rowsConfig}
                onDeleteRow={() => onDeleteRow(rowIndex)}
                onDeleteBlock={onDeleteBlock}
                onBlockUpdate={onBlockUpdate}
                onBlocksChange={onBlocksChange}
                onRowsConfigChange={onRowsConfigChange}
                categories={categories}
                sliders={sliders}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </>
  );
}

function GridRowItem({
  rowIndex,
  row,
  blocks,
  vendorId,
  rowsConfig,
  onDeleteRow,
  onDeleteBlock,
  onBlockUpdate,
  onBlocksChange,
  onRowsConfigChange,
  categories,
  sliders,
}: any) {
  const [numColumns, setNumColumns] = useState(row.columns || 4);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const cells = Array.from({ length: numColumns }, (_, i) => i + 1);

  const handleColumnsChange = (newColumnCount: number) => {
    setNumColumns(newColumnCount);
    // Update the row object to persist the change
    row.columns = newColumnCount;
    console.log(`[GridRowItem] 📐 Row ${rowIndex} columns changed to ${newColumnCount}`);
    
    if (onRowsConfigChange) {
      // Get existing rows configuration from props (passed from parent)
      const currentRowsConfig = rowsConfig || [];
      console.log(`[GridRowItem] 📐 Current rows config:`, currentRowsConfig);
      
      // Update or add the configuration for this row
      const updatedRowsConfig = [...currentRowsConfig];
      const existingConfigIndex = updatedRowsConfig.findIndex(config => config.row === rowIndex);
      
      if (existingConfigIndex >= 0) {
        updatedRowsConfig[existingConfigIndex].columns = newColumnCount;
      } else {
        updatedRowsConfig.push({ row: rowIndex, columns: newColumnCount });
      }
      
      console.log(`[GridRowItem] 📐 Updated rows config:`, updatedRowsConfig);
      onRowsConfigChange(updatedRowsConfig);
    }
  };

  const onAddBlockFromModal = (blockType: string, rowIdx: number, colIdx: number) => {
    // Crear nuevo bloque
    const newBlock = crearBloqueVacio(blockType);
    newBlock.row = rowIdx;
    newBlock.column = colIdx;

    // Actualizar bloques globales
    onBlocksChange([...blocks, newBlock]);

    // Actualizar la fila local
    row.blocks.push(newBlock);
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "z-50" : ""}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
            title="Arrastrar para reordenar fila"
          >
            <GripVertical className="w-5 h-5 text-gray-400" />
          </button>
          <h4 className="font-semibold text-gray-700">Fila {rowIndex + 1}</h4>
          <select
            value={numColumns}
            onChange={(e) => handleColumnsChange(parseInt(e.target.value))}
            className="px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="1">1 Columna</option>
            <option value="2">2 Columnas</option>
            <option value="3">3 Columnas</option>
            <option value="4">4 Columnas</option>
            <option value="5">5 Columnas</option>
            <option value="6">6 Columnas</option>
          </select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeleteRow}
          className="text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${numColumns}, 1fr)`,
          gap: "1rem",
        }}
      >
        {cells.map((colIndex) => {
          // colIndex es 1-based (1, 2, 3, etc)
          const cellId = `cell-${rowIndex}-${colIndex}`;
          const blockInCell = row.blocks.find(
            (b: any) => b.column === colIndex
          );

          return (
            <GridDropZone
              key={cellId}
              id={cellId}
              block={blockInCell}
              rowIndex={rowIndex}
              columnIndex={colIndex}
              onDeleteBlock={onDeleteBlock}
              onBlockUpdate={onBlockUpdate}
              onAddBlock={onAddBlockFromModal}
              onBlocksChange={onBlocksChange}
              categories={categories}
              vendorId={vendorId}
              sliders={sliders}
            />
          );
        })}
      </div>
    </div>
  );
}

function GridDropZone({
  id,
  block,
  onDeleteBlock,
  onBlockUpdate,
  categories,
  vendorId,
  rowIndex,
  columnIndex,
  onAddBlock,
  sliders,
}: any) {
  const { setNodeRef, isOver } = useSortable({ id });
  const [showBlockTypeModal, setShowBlockTypeModal] = useState(false);

  const handleSelectBlockType = (blockType: string) => {
    onAddBlock(blockType, rowIndex, columnIndex);
    setShowBlockTypeModal(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] p-4 border-2 border-dashed rounded-lg transition-all ${
        isOver
          ? "border-purple-500 bg-purple-50"
          : "border-gray-300 bg-gray-50"
      }`}
    >
      {block ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  {
                    blockTypeLabels[
                      block.type as keyof typeof blockTypeLabels
                    ]
                  }
                </p>
                <p className="text-xs text-gray-600">
                  {block.columns === 1
                    ? "Ancho completo"
                    : `${block.columns} columnas`}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteBlock(block.id)}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          <BlockQuickEditor
            block={block}
            onBlockUpdate={onBlockUpdate}
            categories={categories}
            vendorId={vendorId}
            sliders={sliders}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
          <Button
            onClick={() => setShowBlockTypeModal(true)}
            variant="outline"
            size="sm"
            className="text-purple-600 border-purple-300 hover:bg-purple-50"
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar
          </Button>
          <p className="text-xs text-gray-500 text-center">
            o arrastra un bloque aquí
          </p>

          {/* Modal para seleccionar tipo de bloque */}
          {showBlockTypeModal && typeof document !== 'undefined' && createPortal(
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
              style={{ 
                zIndex: 99999,
                pointerEvents: 'auto',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
              }}
              onClick={(e) => {
                // Cerrar modal si se hace click en el fondo
                if (e.target === e.currentTarget) {
                  setShowBlockTypeModal(false);
                }
              }}
            >
              <div 
                className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-2xl"
                style={{ position: 'relative', zIndex: 100000 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-lg mb-4">Selecciona un bloque</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(blockTypeLabels).map(([key, label]) => {
                    const parts = label.split(" ");
                    const emoji = parts[0];
                    const text = parts.slice(1).join(" ");
                    return (
                      <Button
                        key={key}
                        onClick={() => handleSelectBlockType(key)}
                        variant="outline"
                        className="h-auto py-4 flex flex-col items-center justify-center hover:bg-purple-50 hover:border-purple-300 transition-all"
                      >
                        <span className="text-2xl mb-1">{emoji}</span>
                        <span className="text-xs text-gray-600">{text}</span>
                      </Button>
                    );
                  })}
                </div>
                <Button
                  onClick={() => setShowBlockTypeModal(false)}
                  variant="outline"
                  className="w-full mt-4 border-gray-300 hover:bg-pink-100 hover:text-purple-700 hover:border-purple-400 font-medium transition-all"
                >
                  Cancelar
                </Button>
              </div>
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}

function BlockQuickEditor({ block, onBlockUpdate, categories, vendorId, sliders }: any) {
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaLibraryTarget, setMediaLibraryTarget] = useState<'single' | 'imageCarousel'>('single');
  const [pendingCarouselImages, setPendingCarouselImages] = useState<Array<{url: string, link: string, alt: string}>>([]);

  const handleMediaSelect = (file: any) => {
    if (mediaLibraryTarget === 'imageCarousel') {
      // Toggle: si ya está en pendientes la quita, sino la agrega
      setPendingCarouselImages(prev => {
        const exists = prev.some(img => img.url === file.url);
        if (exists) return prev.filter(img => img.url !== file.url);
        return [...prev, { url: file.url, link: '', alt: '' }];
      });
      // No insertar todavía, ni cerrar la biblioteca
      return;
    }
    if (block.type === "imageText") {
      onBlockUpdate(block.id, { backgroundImage: file.url });
    } else {
      onBlockUpdate(block.id, { imageUrl: file.url });
    }
    setShowMediaLibrary(false);
  };

  const handleOpenMediaLibrary = () => {
    console.log("📂 Opening MediaLibrary, vendorId:", vendorId);
    setMediaLibraryTarget('single');
    setShowMediaLibrary(true);
  };

  const handleInsertPendingImages = () => {
    if (pendingCarouselImages.length === 0) return;
    const current = block.imageCarouselConfig?.images || [];
    onBlockUpdate(block.id, {
      imageCarouselConfig: {
        ...block.imageCarouselConfig,
        images: [...current, ...pendingCarouselImages],
      },
    });
    setPendingCarouselImages([]);
    setShowMediaLibrary(false);
  };

  return (
    <div className="space-y-2 p-3 bg-white rounded border border-gray-200">
      {block.type === "text" && (
        <HTMLEditor
          value={block.text || ""}
          onChange={(html) => onBlockUpdate(block.id, { text: html })}
          placeholder="Contenido de texto..."
          className="text-xs"
          rows={4}
          vendorId={vendorId}
        />
      )}

      {block.type === "grid" && (
        <div className="space-y-2">
          <select
            value={block.gridConfig?.displayMode || "latest"}
            onChange={(e) =>
              onBlockUpdate(block.id, {
                gridConfig: { ...block.gridConfig, displayMode: e.target.value },
              })
            }
            className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="latest">Últimos Productos</option>
            <option value="featured">Destacados</option>
            <option value="best-sellers">Más Vendidos</option>
            <option value="on-sale">En Oferta</option>
            <option value="specific-category">Categoría Específica</option>
          </select>
          {block.gridConfig?.displayMode === "specific-category" && (
            <select
              value={block.gridConfig?.categoryId || ""}
              onChange={(e) =>
                onBlockUpdate(block.id, {
                  gridConfig: { ...block.gridConfig, categoryId: e.target.value },
                })
              }
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">-- Categoría --</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Columnas de productos
            </label>
            <select
              value={block.gridConfig?.columns || 4}
              onChange={(e) =>
                onBlockUpdate(block.id, {
                  gridConfig: { ...block.gridConfig, columns: parseInt(e.target.value) },
                })
              }
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value={6}>6 columnas</option>
              <option value={5}>5 columnas</option>
              <option value={4}>4 columnas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filas de productos
            </label>
            <select
              value={block.gridConfig?.rows || 3}
              onChange={(e) =>
                onBlockUpdate(block.id, {
                  gridConfig: { ...block.gridConfig, rows: parseInt(e.target.value) },
                })
              }
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value={1}>1 fila</option>
              <option value={2}>2 filas</option>
              <option value={3}>3 filas</option>
              <option value={4}>4 filas</option>
              <option value={5}>5 filas</option>
              <option value={6}>6 filas</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              {block.gridConfig?.columns || 4} col × {block.gridConfig?.rows || 3} filas = {(block.gridConfig?.columns || 4) * (block.gridConfig?.rows || 3)} productos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`infinite-scroll-${block.id}`}
              checked={block.gridConfig?.infiniteScroll || false}
              onChange={(e) =>
                onBlockUpdate(block.id, {
                  gridConfig: { ...block.gridConfig, infiniteScroll: e.target.checked },
                })
              }
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor={`infinite-scroll-${block.id}`} className="text-xs font-medium text-gray-700">
              Infinite Scroll (carga automática al hacer scroll)
            </label>
          </div>
        </div>
      )}

      {block.type === "image" && (
        <div className="space-y-2">
          {block.imageUrl && (
            <div className="relative w-full h-32 bg-gray-100 rounded overflow-hidden">
              <img
                src={block.imageUrl}
                alt={block.imageAlt || "Preview"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                Error al cargar imagen
              </div>
            </div>
          )}
          <div className="flex gap-1">
            <input
              type="text"
              value={block.imageUrl || ""}
              onChange={(e) => onBlockUpdate(block.id, { imageUrl: e.target.value })}
              placeholder="URL de imagen..."
              className="flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenMediaLibrary}
              className="px-2 h-7"
              title="Seleccionar de biblioteca"
            >
              <ImageIcon className="w-3 h-3" />
            </Button>
          </div>
          <input
            type="text"
            value={block.imageAlt || ""}
            onChange={(e) => onBlockUpdate(block.id, { imageAlt: e.target.value })}
            placeholder="Texto alternativo..."
            className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <input
            type="text"
            value={block.title || ""}
            onChange={(e) => onBlockUpdate(block.id, { title: e.target.value })}
            placeholder="Título sobre la imagen (opcional)..."
            className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          {block.title && (
            <input
              type="text"
              value={block.buttonText || ""}
              onChange={(e) => onBlockUpdate(block.id, { buttonText: e.target.value })}
              placeholder="Texto del enlace, por ejemplo: Ver más"
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          )}
          <input
            type="text"
            value={block.imageLink || ""}
            onChange={(e) => onBlockUpdate(block.id, { imageLink: e.target.value })}
            placeholder="Enlace al hacer clic (opcional)..."
            className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <select
            value={block.imageLinkTarget || "_self"}
            onChange={(e) => onBlockUpdate(block.id, { imageLinkTarget: e.target.value })}
            className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="_self">Abrir en la misma pestana</option>
            <option value="_blank">Abrir en nueva pestana</option>
          </select>
        </div>
      )}

      {block.type === "video" && (
        <div className="space-y-1">
          <select
            value={block.videoType || "youtube"}
            onChange={(e) => onBlockUpdate(block.id, { videoType: e.target.value })}
            className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
            <option value="custom">URL Personalizada</option>
          </select>
          <input
            type="text"
            value={block.videoUrl || ""}
            onChange={(e) => onBlockUpdate(block.id, { videoUrl: e.target.value })}
            placeholder="URL del video..."
            className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      )}

      {block.type === "slides" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Seleccionar Slider
          </label>
          <select
            value={block.sliderId || ""}
            onChange={(e) => {
              console.log(`[BlockEditor] 🎬 Slider selected:`, e.target.value);
              console.log(`[BlockEditor] 📦 Current block:`, block);
              onBlockUpdate(block.id, { sliderId: e.target.value });
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">-- Selecciona un slider --</option>
            {sliders.map((slider: any) => (
              <option key={slider.id} value={slider.id}>
                {slider.name || `Slider ${slider.id}`}
              </option>
            ))}
          </select>
          {!block.sliderId && (
            <p className="text-xs text-amber-600">⚠️ Selecciona un slider para mostrar</p>
          )}
          {block.sliderId && (
            <div className="space-y-2">
              <p className="text-xs text-green-600">✓ Slider configurado</p>
              <a
                href={`/dashboard/settings?section=diseno&subsection=slides&sliderId=${block.sliderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-purple-200 text-purple-700 rounded-md hover:bg-purple-50 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Ir a editar el slide
              </a>
            </div>
          )}
        </div>
      )}

      {block.type === "imageText" && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Imagen de Fondo
            </label>
            {block.backgroundImage && (
              <div className="relative w-full h-32 bg-gray-100 rounded overflow-hidden mb-2">
                <img
                  src={block.backgroundImage}
                  alt="Fondo"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex gap-1">
              <input
                type="text"
                value={block.backgroundImage || ""}
                onChange={(e) => onBlockUpdate(block.id, { backgroundImage: e.target.value })}
                placeholder="URL de imagen de fondo..."
                className="flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleOpenMediaLibrary}
                className="px-2 h-7"
                title="Seleccionar de biblioteca"
              >
                <ImageIcon className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Título
            </label>
            <input
              type="text"
              value={block.title || ""}
              onChange={(e) => onBlockUpdate(block.id, { title: e.target.value })}
              placeholder="Título del bloque..."
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Texto
            </label>
            <HTMLEditor
              value={block.text || ""}
              onChange={(html) => onBlockUpdate(block.id, { text: html })}
              placeholder="Texto descriptivo..."
              className="text-xs"
              rows={3}
              vendorId={vendorId}
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Texto del Botón
            </label>
            <input
              type="text"
              value={block.buttonText || ""}
              onChange={(e) => onBlockUpdate(block.id, { buttonText: e.target.value })}
              placeholder="Ej: Ver más"
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Enlace del Botón
            </label>
            <input
              type="text"
              value={block.buttonLink || ""}
              onChange={(e) => onBlockUpdate(block.id, { buttonLink: e.target.value })}
              placeholder="Ej: /productos, /categoria/vinilos"
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
      )}

      {block.type === "carousel" && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Título del carrusel</label>
            <input
              type="text"
              value={block.carouselConfig?.title || ""}
              onChange={(e) => onBlockUpdate(block.id, { carouselConfig: { ...block.carouselConfig, title: e.target.value } })}
              placeholder="Ej: Lo más vendido, Novedades..."
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mostrar productos de</label>
            <select
              value={block.carouselConfig?.displayMode || "latest"}
              onChange={(e) => onBlockUpdate(block.id, { carouselConfig: { ...block.carouselConfig, displayMode: e.target.value, categoryId: "", genre: "" } })}
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="latest">Más recientes</option>
              <option value="best-sellers">Más vendidos</option>
              <option value="featured">Destacados</option>
              <option value="on-sale">En oferta</option>
              <option value="by-category">Por categoría</option>
              <option value="by-genre">Por género musical</option>
            </select>
          </div>
          {block.carouselConfig?.displayMode === "by-category" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={block.carouselConfig?.categoryId || ""}
                onChange={(e) => onBlockUpdate(block.id, { carouselConfig: { ...block.carouselConfig, categoryId: e.target.value } })}
                className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">-- Selecciona categoría --</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}
          {block.carouselConfig?.displayMode === "by-genre" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Género musical</label>
              <input
                type="text"
                value={block.carouselConfig?.genre || ""}
                onChange={(e) => onBlockUpdate(block.id, { carouselConfig: { ...block.carouselConfig, genre: e.target.value } })}
                placeholder="Ej: Rock, Jazz, Cumbia..."
                className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Productos visibles</label>
              <select
                value={block.carouselConfig?.visibleItems || 4}
                onChange={(e) => onBlockUpdate(block.id, { carouselConfig: { ...block.carouselConfig, visibleItems: Number(e.target.value) } })}
                className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Total productos</label>
              <select
                value={block.carouselConfig?.limit || 12}
                onChange={(e) => onBlockUpdate(block.id, { carouselConfig: { ...block.carouselConfig, limit: Number(e.target.value) } })}
                className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value={6}>6</option>
                <option value={8}>8</option>
                <option value={12}>12</option>
                <option value={16}>16</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Velocidad del carrusel</label>
            <select
              value={block.carouselConfig?.scrollSpeed || "normal"}
              onChange={(e) => onBlockUpdate(block.id, { carouselConfig: { ...block.carouselConfig, scrollSpeed: e.target.value } })}
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="fast">Rápido</option>
              <option value="normal">Normal</option>
              <option value="slow">Lento</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox"
                checked={block.carouselConfig?.showTitle ?? true}
                onChange={(e) => onBlockUpdate(block.id, { carouselConfig: { ...block.carouselConfig, showTitle: e.target.checked } })}
              /> Título
            </label>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded p-2">
            <p className="text-xs text-purple-700">🎠 Mostrará productos en formato deslizable horizontal</p>
          </div>
        </div>
      )}

      {block.type === "imageCarousel" && (
        <div className="space-y-2">
          {/* Velocidad */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Velocidad del scroll</label>
            <select
              value={block.imageCarouselConfig?.scrollSpeed || 'normal'}
              onChange={(e) => onBlockUpdate(block.id, { imageCarouselConfig: { ...block.imageCarouselConfig, scrollSpeed: e.target.value } })}
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="fast">Rápido</option>
              <option value="normal">Normal</option>
              <option value="slow">Lento</option>
            </select>
          </div>
          {/* Alto de imágenes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Alto de imágenes (px)</label>
            <select
              value={block.imageCarouselConfig?.imageHeight || 400}
              onChange={(e) => onBlockUpdate(block.id, { imageCarouselConfig: { ...block.imageCarouselConfig, imageHeight: Number(e.target.value) } })}
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value={200}>200px</option>
              <option value={300}>300px</option>
              <option value={400}>400px</option>
              <option value={500}>500px</option>
              <option value={600}>600px</option>
            </select>
          </div>
          {/* Lista de imágenes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Imágenes ({(block.imageCarouselConfig?.images || []).length})</label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {(block.imageCarouselConfig?.images || []).map((img: any, i: number) => (
                <div key={i} className="flex items-center gap-1 bg-gray-50 rounded p-1">
                  <img src={img.url} alt="" className="w-8 h-8 object-cover rounded flex-shrink-0" />
                  <input
                    type="text"
                    value={img.link || ''}
                    onChange={(e) => {
                      const imgs = [...(block.imageCarouselConfig?.images || [])];
                      imgs[i] = { ...imgs[i], link: e.target.value };
                      onBlockUpdate(block.id, { imageCarouselConfig: { ...block.imageCarouselConfig, images: imgs } });
                    }}
                    placeholder="URL de enlace (opcional)"
                    className="flex-1 px-1.5 py-0.5 text-xs border rounded min-w-0"
                  />
                  <select
                    value={img.target || '_self'}
                    onChange={(e) => {
                      const imgs = [...(block.imageCarouselConfig?.images || [])];
                      imgs[i] = { ...imgs[i], target: e.target.value };
                      onBlockUpdate(block.id, { imageCarouselConfig: { ...block.imageCarouselConfig, images: imgs } });
                    }}
                    className="w-32 px-1.5 py-0.5 text-xs border rounded flex-shrink-0"
                  >
                    <option value="_self">Misma</option>
                    <option value="_blank">Nueva</option>
                  </select>
                  <button
                    onClick={() => {
                      const imgs = (block.imageCarouselConfig?.images || []).filter((_: any, j: number) => j !== i);
                      onBlockUpdate(block.id, { imageCarouselConfig: { ...block.imageCarouselConfig, images: imgs } });
                    }}
                    className="text-red-500 hover:text-red-700 flex-shrink-0 px-1"
                    title="Eliminar"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
          {/* Botón agregar imágenes */}
          <Button
            type="button" size="sm" variant="outline" className="w-full"
            onClick={() => { setMediaLibraryTarget('imageCarousel'); setPendingCarouselImages([]); setShowMediaLibrary(true); }}
          >
            <ImageIcon className="w-3 h-3 mr-1" /> Agregar imágenes desde biblioteca
          </Button>
          <div className="bg-purple-50 border border-purple-200 rounded p-2">
            <p className="text-xs text-purple-700">🎞️ Carrusel de ancho completo. Abre la biblioteca y selecciona varias imágenes.</p>
          </div>
        </div>
      )}

      {block.type === "component" && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Componente Predefinido
            </label>
            <select
              value={block.componentName || "goldmine-scale"}
              onChange={(e) => onBlockUpdate(block.id, { componentName: e.target.value })}
              className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="goldmine-scale">Escala Goldmine</option>
              <option value="how-to-buy">Cómo Comprar en Mundo Beat</option>
              <option value="sell-with-us">Vende en Mundo Beat</option>
              <option value="sell-with-us-hero">Vende en Mundo Beat (Hero)</option>
              <option value="store-benefits">Beneficios de la tienda</option>
            </select>
          </div>
          {block.componentName === "store-benefits" && (
            <div className="space-y-3 rounded border border-gray-200 bg-gray-50 p-2">
              {(block.benefitsConfig?.items || [
                { icon: 'truck', title: 'Envíos a todo Chile', description: 'Recibe tu compra donde estés.' },
                { icon: 'payment', title: 'Compra segura', description: 'Paga con medios de pago protegidos.' },
                { icon: 'shield', title: 'Productos protegidos', description: 'Preparamos cada pedido con cuidado.' },
              ]).slice(0, 3).map((item: any, index: number, items: any[]) => (
                <div key={index} className="space-y-1 border-b border-gray-200 pb-2 last:border-b-0 last:pb-0">
                  <select
                    value={item.icon}
                    onChange={(e) => {
                      const nextItems = items.map((current: any, itemIndex: number) => itemIndex === index ? { ...current, icon: e.target.value } : current);
                      onBlockUpdate(block.id, { benefitsConfig: { items: nextItems } });
                    }}
                    className="w-full rounded border px-2 py-1 text-xs"
                  >
                    <option value="truck">Envío</option>
                    <option value="payment">Pago</option>
                    <option value="shield">Protección</option>
                  </select>
                  <input
                    value={item.title}
                    onChange={(e) => {
                      const nextItems = items.map((current: any, itemIndex: number) => itemIndex === index ? { ...current, title: e.target.value } : current);
                      onBlockUpdate(block.id, { benefitsConfig: { items: nextItems } });
                    }}
                    placeholder="Título"
                    className="w-full rounded border px-2 py-1 text-xs"
                  />
                  <input
                    value={item.description}
                    onChange={(e) => {
                      const nextItems = items.map((current: any, itemIndex: number) => itemIndex === index ? { ...current, description: e.target.value } : current);
                      onBlockUpdate(block.id, { benefitsConfig: { items: nextItems } });
                    }}
                    placeholder="Descripción"
                    className="w-full rounded border px-2 py-1 text-xs"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs text-blue-800">
              {block.componentName === "store-benefits"
                ? "La franja mostrará estos tres beneficios en la página pública."
                : "Este bloque mostrará un componente prediseñado. El contenido no se puede editar aquí."}
            </p>
          </div>
        </div>
      )}

      {showMediaLibrary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">
                {mediaLibraryTarget === 'imageCarousel' ? 'Agregar imágenes al carrusel' : 'Biblioteca de Medios'}
              </h2>
              <div className="flex gap-2">
                {mediaLibraryTarget === 'imageCarousel' && (
                  pendingCarouselImages.length > 0 ? (
                    <Button variant="default" size="sm" onClick={handleInsertPendingImages} className="bg-green-600 hover:bg-green-700">
                      ✓ {pendingCarouselImages.length} {pendingCarouselImages.length === 1 ? 'imagen seleccionada' : 'imágenes seleccionadas'} · Insertar
                    </Button>
                  ) : (
                    <span className="text-sm text-gray-400 self-center">Selecciona imágenes para agregar</span>
                  )
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMediaLibrary(false)}
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="h-[calc(100%-60px)]">
              {vendorId ? (
                <MediaLibrary
                  vendorId={vendorId}
                  mode="select"
                  onSelect={handleMediaSelect}
                  selectedUrls={mediaLibraryTarget === 'imageCarousel' ? pendingCarouselImages.map(img => img.url) : []}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                  <p className="text-gray-500">Cargando información del vendedor...</p>
                  <p className="text-xs text-gray-400">Si esto tarda mucho, revisa la consola del navegador</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
