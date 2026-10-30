"use client";

import { useRef, useEffect, useState } from "react";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Code, Maximize2, Minimize2, Image as ImageIcon, X } from "lucide-react";
import dynamic from "next/dynamic";

const MediaLibrary = dynamic(() => import("@/components/admin/MediaLibrary"), { ssr: false });

interface HTMLEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  vendorId?: string; // ID del vendor para biblioteca de medios
}

export function HTMLEditor({ value, onChange, placeholder, className, rows = 4, vendorId }: HTMLEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [htmlCode, setHtmlCode] = useState(value || "");
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [imageWidth, setImageWidth] = useState("100");
  const [imageHeight, setImageHeight] = useState("auto");
  const [imageAlign, setImageAlign] = useState("none");
  const [selectedImgElement, setSelectedImgElement] = useState<HTMLImageElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeHandle, setResizeHandle] = useState<'se' | 'sw' | 'ne' | 'nw' | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!showHtml && editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || "";
    }
    setHtmlCode(value || "");
  }, [value, showHtml]);

  // Manejar selección de imágenes en el editor
  useEffect(() => {
    if (!editorRef.current || showHtml) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        e.preventDefault();
        setSelectedImgElement(target as HTMLImageElement);
      } else {
        setSelectedImgElement(null);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('resize-handle')) {
        e.preventDefault();
        e.stopPropagation();
        const img = selectedImgElement;
        if (img) {
          setIsResizing(true);
          setResizeHandle(target.getAttribute('data-handle') as any);
          setResizeStartPos({
            x: e.clientX,
            y: e.clientY,
            width: img.offsetWidth,
            height: img.offsetHeight,
          });
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !selectedImgElement || !resizeHandle) return;
      
      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;
      
      // Mantener aspecto ratio
      const aspectRatio = resizeStartPos.width / resizeStartPos.height;
      
      let newWidth = resizeStartPos.width;
      let newHeight = resizeStartPos.height;
      
      // Ajustar según el handle que se está arrastrando
      switch (resizeHandle) {
        case 'se': // inferior derecha
          newWidth = Math.max(50, resizeStartPos.width + deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'sw': // inferior izquierda
          newWidth = Math.max(50, resizeStartPos.width - deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'ne': // superior derecha
          newWidth = Math.max(50, resizeStartPos.width + deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'nw': // superior izquierda
          newWidth = Math.max(50, resizeStartPos.width - deltaX);
          newHeight = newWidth / aspectRatio;
          break;
      }
      
      selectedImgElement.style.width = `${newWidth}px`;
      selectedImgElement.style.height = `${newHeight}px`;
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        setResizeHandle(null);
        if (editorRef.current) {
          handleInput();
        }
      }
    };

    const editor = editorRef.current;
    editor.addEventListener('click', handleClick);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      editor.removeEventListener('click', handleClick);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [showHtml, selectedImgElement, isResizing, resizeStartPos]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newHtml = e.target.value;
    setHtmlCode(newHtml);
    onChange(newHtml);
  };

  const toggleHtmlMode = () => {
    if (!showHtml && editorRef.current) {
      // Guardar contenido antes de cambiar a HTML
      setHtmlCode(editorRef.current.innerHTML);
    }
    setShowHtml(!showHtml);
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertLink = () => {
    const url = prompt("Ingresa la URL:");
    if (url) {
      execCommand("createLink", url);
    }
  };

  const handleImageSelect = (file: any) => {
    // Guardar la imagen seleccionada y mostrar opciones de tamaño
    setSelectedImage(file);
    // No cerramos la biblioteca aún, mostramos el panel de configuración
  };

  const handleInsertImage = () => {
    if (!selectedImage) return;

    // Construir estilos según configuración
    const styles: string[] = [];
    
    if (imageWidth !== "auto") {
      styles.push(`width: ${imageWidth}%`);
    }
    if (imageHeight !== "auto") {
      styles.push(`height: ${imageHeight}`);
    }
    styles.push("max-width: 100%");
    
    // Alineación
    if (imageAlign === "left") {
      styles.push("float: left; margin: 10px 15px 10px 0");
    } else if (imageAlign === "right") {
      styles.push("float: right; margin: 10px 0 10px 15px");
    } else if (imageAlign === "center") {
      styles.push("display: block; margin: 10px auto");
    }

    const styleAttr = styles.join("; ");
    const imgTag = `<img src="${selectedImage.url}" alt="${selectedImage.originalName || 'Imagen'}" style="${styleAttr}" />`;

    if (showHtml) {
      // En modo HTML, insertar como texto
      setHtmlCode(prev => prev + imgTag);
      onChange(htmlCode + imgTag);
    } else {
      // En modo visual, insertar usando execCommand
      execCommand("insertHTML", imgTag);
    }
    
    // Resetear y cerrar
    setSelectedImage(null);
    setImageWidth("100");
    setImageHeight("auto");
    setImageAlign("none");
    setShowMediaLibrary(false);
  };

  if (!isClient) {
    return (
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        rows={rows}
      />
    );
  }

  return (
    <div className="border border-gray-300 rounded overflow-hidden">
      {/* Toolbar */}
      <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-300 flex-wrap items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {!showHtml && (
            <>
              <button
                type="button"
                onClick={() => execCommand("bold")}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Negrita"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => execCommand("italic")}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Cursiva"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => execCommand("underline")}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Subrayado"
              >
                <span className="text-sm font-bold underline">U</span>
              </button>
              
              <div className="w-px h-6 bg-gray-300 mx-1" />
              
              <button
                type="button"
                onClick={insertLink}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Insertar enlace"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
              
              {vendorId && (
                <button
                  type="button"
                  onClick={() => setShowMediaLibrary(true)}
                  className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                  title="Insertar imagen"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              )}
              
              <div className="w-px h-6 bg-gray-300 mx-1" />
              
              <button
                type="button"
                onClick={() => execCommand("insertUnorderedList")}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Lista con viñetas"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => execCommand("insertOrderedList")}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Lista numerada"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              
              <div className="w-px h-6 bg-gray-300 mx-1" />
              
              <button
                type="button"
                onClick={() => execCommand("justifyLeft")}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Alinear izquierda"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => execCommand("justifyCenter")}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Alinear centro"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => execCommand("justifyRight")}
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Alinear derecha"
              >
                <AlignRight className="w-4 h-4" />
              </button>
              
              <div className="w-px h-6 bg-gray-300 mx-1" />
              
              <select
                onChange={(e) => {
                  execCommand("formatBlock", e.target.value);
                  e.target.value = "";
                }}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-200 transition-colors"
                defaultValue=""
              >
                <option value="">Formato</option>
                <option value="p">Párrafo</option>
                <option value="h1">Título 1</option>
                <option value="h2">Título 2</option>
                <option value="h3">Título 3</option>
                <option value="h4">Título 4</option>
              </select>
            </>
          )}
        </div>

        {/* Botones de control */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={toggleHtmlMode}
            className={`p-1.5 rounded transition-colors ${showHtml ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200'}`}
            title={showHtml ? "Modo Visual" : "Ver HTML"}
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title={isExpanded ? "Contraer" : "Expandir"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Editor / HTML Source */}
      {showHtml ? (
        <textarea
          ref={textareaRef}
          value={htmlCode}
          onChange={handleHtmlChange}
          className={`w-full p-3 font-mono text-xs focus:outline-none resize-none ${
            isExpanded ? 'min-h-[600px]' : `min-h-[${rows * 24}px]`
          } ${className || ""}`}
          style={{ minHeight: isExpanded ? '600px' : `${rows * 24}px` }}
          spellCheck={false}
        />
      ) : (
        <div className="relative">
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            className={`p-3 overflow-y-auto focus:outline-none ${
              isExpanded ? 'min-h-[600px] max-h-[800px]' : `min-h-[${rows * 24}px] max-h-96`
            } ${className || ""}`}
            style={{ minHeight: isExpanded ? '600px' : `${rows * 24}px` }}
            suppressContentEditableWarning
            data-placeholder={placeholder}
          />
          
          {/* Handles de redimensionamiento para imagen seleccionada */}
          {selectedImgElement && !showHtml && (
            <div
              style={{
                position: 'absolute',
                left: selectedImgElement.offsetLeft + 'px',
                top: selectedImgElement.offsetTop + 'px',
                width: selectedImgElement.offsetWidth + 'px',
                height: selectedImgElement.offsetHeight + 'px',
                border: '2px solid #8B5CF6',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {/* Handle esquina inferior derecha */}
              <div
                className="resize-handle"
                data-handle="se"
                style={{
                  position: 'absolute',
                  right: '-6px',
                  bottom: '-6px',
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#8B5CF6',
                  border: '2px solid white',
                  borderRadius: '50%',
                  cursor: 'se-resize',
                  pointerEvents: 'all',
                }}
              />
              {/* Handle esquina inferior izquierda */}
              <div
                className="resize-handle"
                data-handle="sw"
                style={{
                  position: 'absolute',
                  left: '-6px',
                  bottom: '-6px',
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#8B5CF6',
                  border: '2px solid white',
                  borderRadius: '50%',
                  cursor: 'sw-resize',
                  pointerEvents: 'all',
                }}
              />
              {/* Handle esquina superior derecha */}
              <div
                className="resize-handle"
                data-handle="ne"
                style={{
                  position: 'absolute',
                  right: '-6px',
                  top: '-6px',
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#8B5CF6',
                  border: '2px solid white',
                  borderRadius: '50%',
                  cursor: 'ne-resize',
                  pointerEvents: 'all',
                }}
              />
              {/* Handle esquina superior izquierda */}
              <div
                className="resize-handle"
                data-handle="nw"
                style={{
                  position: 'absolute',
                  left: '-6px',
                  top: '-6px',
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#8B5CF6',
                  border: '2px solid white',
                  borderRadius: '50%',
                  cursor: 'nw-resize',
                  pointerEvents: 'all',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal Biblioteca de Medios */}
      {showMediaLibrary && vendorId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Seleccionar e Insertar Imagen</h3>
              <button
                onClick={() => {
                  setShowMediaLibrary(false);
                  setSelectedImage(null);
                  setImageWidth("100");
                  setImageHeight("auto");
                  setImageAlign("none");
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto flex">
              {/* Biblioteca de Medios - 70% */}
              <div className="flex-1 p-4 border-r">
                <MediaLibrary 
                  vendorId={vendorId}
                  mode="select"
                  accept="image/*"
                  onSelect={handleImageSelect}
                />
              </div>

              {/* Panel de Configuración - 30% */}
              {selectedImage && (
                <div className="w-80 p-4 space-y-4">
                  <h4 className="font-semibold text-sm border-b pb-2">Configurar Imagen</h4>
                  
                  {/* Vista previa */}
                  <div className="border rounded p-2">
                    <img 
                      src={selectedImage.url} 
                      alt="Preview" 
                      className="w-full h-auto rounded"
                    />
                    <p className="text-xs text-gray-500 mt-1 truncate">{selectedImage.originalName}</p>
                  </div>

                  {/* Ancho */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ancho
                    </label>
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => setImageWidth("25")}
                        className={`flex-1 px-2 py-1 text-xs border rounded ${imageWidth === "25" ? "bg-purple-100 border-purple-500" : "hover:bg-gray-50"}`}
                      >
                        25%
                      </button>
                      <button
                        onClick={() => setImageWidth("50")}
                        className={`flex-1 px-2 py-1 text-xs border rounded ${imageWidth === "50" ? "bg-purple-100 border-purple-500" : "hover:bg-gray-50"}`}
                      >
                        50%
                      </button>
                      <button
                        onClick={() => setImageWidth("75")}
                        className={`flex-1 px-2 py-1 text-xs border rounded ${imageWidth === "75" ? "bg-purple-100 border-purple-500" : "hover:bg-gray-50"}`}
                      >
                        75%
                      </button>
                      <button
                        onClick={() => setImageWidth("100")}
                        className={`flex-1 px-2 py-1 text-xs border rounded ${imageWidth === "100" ? "bg-purple-100 border-purple-500" : "hover:bg-gray-50"}`}
                      >
                        100%
                      </button>
                    </div>
                    <input
                      type="number"
                      value={imageWidth}
                      onChange={(e) => setImageWidth(e.target.value)}
                      min="1"
                      max="100"
                      className="w-full px-2 py-1 text-sm border rounded"
                      placeholder="Ancho personalizado (%)"
                    />
                  </div>

                  {/* Alineación */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alineación
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setImageAlign("none")}
                        className={`px-2 py-1 text-xs border rounded ${imageAlign === "none" ? "bg-purple-100 border-purple-500" : "hover:bg-gray-50"}`}
                      >
                        Sin alineación
                      </button>
                      <button
                        onClick={() => setImageAlign("left")}
                        className={`px-2 py-1 text-xs border rounded ${imageAlign === "left" ? "bg-purple-100 border-purple-500" : "hover:bg-gray-50"}`}
                      >
                        ← Izquierda
                      </button>
                      <button
                        onClick={() => setImageAlign("center")}
                        className={`px-2 py-1 text-xs border rounded ${imageAlign === "center" ? "bg-purple-100 border-purple-500" : "hover:bg-gray-50"}`}
                      >
                        ⬛ Centro
                      </button>
                      <button
                        onClick={() => setImageAlign("right")}
                        className={`px-2 py-1 text-xs border rounded ${imageAlign === "right" ? "bg-purple-100 border-purple-500" : "hover:bg-gray-50"}`}
                      >
                        Derecha →
                      </button>
                    </div>
                  </div>

                  {/* Botón Insertar */}
                  <button
                    onClick={handleInsertImage}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 transition-colors font-medium"
                  >
                    Insertar Imagen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
