"use client";

import { useState, useRef } from "react";
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from "@/components/ui/button";
import { X, Upload, Star, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductImage } from "./DiscogsSearch";

interface ImageGalleryProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  onUploadLocal?: (files: FileList) => Promise<string[]>;
  vendorId: string;
  allowDiscogsImport?: boolean;
}

interface SortableImageProps {
  image: ProductImage;
  index: number;
  onRemove: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}

function SortableImage({ image, index, onRemove, onMoveLeft, onMoveRight, canMoveLeft, canMoveRight }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg overflow-hidden border-2 ${
        image.isPrimary ? "border-yellow-400 shadow-lg" : "border-gray-200"
      } ${isDragging ? "z-50" : ""}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 hidden md:block p-1.5 bg-white bg-opacity-90 rounded cursor-grab active:cursor-grabbing shadow-lg z-10 hover:bg-opacity-100 transition-all"
      >
        <GripVertical className="h-4 w-4 text-gray-600" />
      </div>

      <div className="absolute top-2 left-2 flex md:hidden gap-1 z-10">
        <button
          type="button"
          onClick={onMoveLeft}
          disabled={!canMoveLeft}
          className="p-1.5 bg-white/95 rounded-full shadow-lg text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Mover imagen a la izquierda"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onMoveRight}
          disabled={!canMoveRight}
          className="p-1.5 bg-white/95 rounded-full shadow-lg text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Mover imagen a la derecha"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Imagen */}
      <img
        src={image.url.startsWith('http') ? image.url : `http://localhost:3001${image.url}`}
        alt={`Producto ${index + 1}`}
        className="w-full h-48 object-cover"
      />

      {/* Badge Principal */}
      {image.isPrimary && (
        <div className="absolute top-2 right-12 flex items-center gap-1 bg-yellow-400 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
          <Star className="h-3 w-3 fill-white" />
          PRINCIPAL
        </div>
      )}

      {/* Botón Eliminar */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-red-600"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Número de orden */}
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
        #{index + 1}
      </div>
    </div>
  );
}

export default function ImageGallery({
  images,
  onChange,
  onUploadLocal,
  vendorId,
  allowDiscogsImport = true,
}: ImageGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.url === active.id);
      const newIndex = images.findIndex((img) => img.url === over.id);

      const newImages = arrayMove(images, oldIndex, newIndex);
      
      // Actualizar orders y marcar el primero como principal
      const updatedImages = newImages.map((img, index) => ({
        ...img,
        order: index,
        isPrimary: index === 0,
      }));

      onChange(updatedImages);
    }
  };

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    
    // Reordenar y actualizar principal
    const updatedImages = newImages.map((img, i) => ({
      ...img,
      order: i,
      isPrimary: i === 0,
    }));

    onChange(updatedImages);
  };

  const handleMove = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const newImages = arrayMove(images, index, targetIndex);
    const updatedImages = newImages.map((img, orderIndex) => ({
      ...img,
      order: orderIndex,
      isPrimary: orderIndex === 0,
    }));

    onChange(updatedImages);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onUploadLocal) return;

    setUploading(true);
    try {
      const uploadedUrls = await onUploadLocal(files);
      
      const newImages: ProductImage[] = uploadedUrls.map((url, index) => ({
        url,
        isPrimary: images.length === 0 && index === 0,
        order: images.length + index,
      }));

      onChange([...images, ...newImages]);
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Error al subir imágenes');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Galería de Imágenes</h3>
          <p className="text-sm text-gray-500">
            <span className="hidden md:inline">Arrastra para reordenar.</span>
            <span className="md:hidden">Usa las flechas para cambiar el orden.</span> La primera imagen será la principal.
          </p>
        </div>
        
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Subiendo..." : "Cargar desde equipo"}
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !onUploadLocal}
          className="w-full rounded-lg border border-dashed bg-card p-12 text-center shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Cargar imágenes desde el equipo"
        >
          <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">
            {allowDiscogsImport
              ? "No hay imágenes. Haz clic aquí para cargarlas desde tu equipo o selecciónalas desde Discogs."
              : "No hay imágenes. Haz clic aquí para cargarlas desde tu equipo."}
          </p>
        </button>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={images.map(img => img.url)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <SortableImage
                  key={image.url}
                  image={image}
                  index={index}
                  onRemove={() => handleRemove(index)}
                  onMoveLeft={() => handleMove(index, "left")}
                  onMoveRight={() => handleMove(index, "right")}
                  canMoveLeft={index > 0}
                  canMoveRight={index < images.length - 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {images.length > 0 && (
        <p className="text-xs text-gray-500">
          <span className="hidden md:inline">💡 Tip: Arrastra las imágenes para cambiar el orden.</span>
          <span className="md:hidden">💡 Tip: Usa las flechas de cada imagen para moverlas.</span> La primera imagen se mostrará como principal en el listado de productos.
        </p>
      )}
    </div>
  );
}
