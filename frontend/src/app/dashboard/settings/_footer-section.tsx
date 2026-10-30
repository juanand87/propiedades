'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Image as ImageIcon, X } from 'lucide-react';
import MediaLibrary from '@/components/admin/MediaLibrary';

// Continuación del archivo settings/page.tsx - Footer Section Component

// Este componente va después de MenusSection en el archivo

function FooterSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [footerConfig, setFooterConfig] = useState({
    enabled: true,
    rows: [
      { id: 1, enabled: true, columns: 4, height: "auto", items: [] as any[] },
      { id: 2, enabled: false, columns: 3, height: "auto", items: [] as any[] },
      { id: 3, enabled: false, columns: 2, height: "auto", items: [] as any[] },
    ],
  });
  const [editingColumn, setEditingColumn] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [menus, setMenus] = useState<any[]>([]);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  useEffect(() => {
    loadFooter();
    loadMenus();
  }, [vendorId]);

  const loadFooter = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      if (data.footerConfig) {
        setFooterConfig(data.footerConfig);
      }
    } catch (error) {
      console.error("Error loading footer:", error);
    }
  };

  const loadMenus = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      
      // Siempre cargar los menús fijos
      const allMenus = [
        { id: 'principal', name: 'Menú Principal' },
        { id: 'secundario', name: 'Menú Secundario' },
        { id: 'lateral', name: 'Menú Lateral' },
        { id: 'footer', name: 'Menú Footer' },
      ];
      
      // Agregar custom menus si existen
      if (data.customMenus?.custom) {
        data.customMenus.custom.forEach((menu: any) => {
          allMenus.push({ id: menu.id, name: menu.name });
        });
      }
      
      setMenus(allMenus);
    } catch (error) {
      console.error("Error loading menus:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.updateVendorSettings(vendorId, { footerConfig });
      alert("Footer guardado correctamente");
    } catch (error: any) {
      console.error("Error saving footer:", error);
      alert(error.message || "Error al guardar el footer");
    } finally {
      setLoading(false);
    }
  };

  const updateRowColumns = (rowId: number, columns: number) => {
    setFooterConfig({
      ...footerConfig,
      rows: footerConfig.rows.map((row) =>
        row.id === rowId ? { ...row, columns, items: [] } : row
      ),
    });
  };

  const updateRowHeight = (rowId: number, height: string) => {
    setFooterConfig({
      ...footerConfig,
      rows: footerConfig.rows.map((row) =>
        row.id === rowId ? { ...row, height } : row
      ),
    });
  };

  const toggleRowEnabled = (rowId: number) => {
    setFooterConfig({
      ...footerConfig,
      rows: footerConfig.rows.map((row) =>
        row.id === rowId ? { ...row, enabled: !row.enabled } : row
      ),
    });
  };

  const editColumn = (rowId: number, columnIndex: number) => {
    const row = footerConfig.rows.find((r) => r.id === rowId);
    const existingItem = row?.items[columnIndex];

    setEditingColumn({
      rowId,
      columnIndex,
      type: existingItem?.type || "text",
      title: existingItem?.title || "",
      content: existingItem?.content || "",
      imageUrl: existingItem?.imageUrl || "",
      linkUrl: existingItem?.linkUrl || "",
      videoUrl: existingItem?.videoUrl || "",
      mapEmbed: existingItem?.mapEmbed || "",
      menuId: existingItem?.menuId || "",
      textAlign: existingItem?.textAlign || "left",
      imageScale: Number(existingItem?.imageScale) || 100,
      isNew: !existingItem,
    });
    setShowModal(true);
  };

  const saveColumn = () => {
    const { rowId, columnIndex, ...columnData } = editingColumn;
    
    setFooterConfig({
      ...footerConfig,
      rows: footerConfig.rows.map((row) => {
        if (row.id === rowId) {
          const newItems = [...row.items];
          newItems[columnIndex] = columnData;
          return { ...row, items: newItems };
        }
        return row;
      }),
    });

    setShowModal(false);
    setEditingColumn(null);
  };

  const deleteColumn = (rowId: number, columnIndex: number) => {
    if (!confirm("¿Eliminar el contenido de esta columna?")) return;

    setFooterConfig({
      ...footerConfig,
      rows: footerConfig.rows.map((row) => {
        if (row.id === rowId) {
          const newItems = [...row.items];
          newItems[columnIndex] = undefined;
          return { ...row, items: newItems };
        }
        return row;
      }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración del Footer</CardTitle>
        <CardDescription>
          Personaliza el pie de página de tu tienda con hasta 3 filas y 4 columnas por fila
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Habilitar/Deshabilitar Footer */}
        <div className="mb-6 flex items-center gap-3">
          <input
            type="checkbox"
            id="footerEnabled"
            checked={footerConfig.enabled}
            onChange={(e) => setFooterConfig({ ...footerConfig, enabled: e.target.checked })}
            className="w-4 h-4 text-purple-600"
          />
          <label htmlFor="footerEnabled" className="text-sm font-medium">
            Mostrar footer en la tienda
          </label>
        </div>

        {footerConfig.enabled && (
          <div className="space-y-6">
            {/* Configuración por fila */}
            {footerConfig.rows.map((row, rowIndex) => (
              <div key={row.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header de la fila */}
                <div className="bg-gray-50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={() => toggleRowEnabled(row.id)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="font-semibold">Fila {rowIndex + 1}</span>
                  </div>

                  {row.enabled && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Columnas:</label>
                        <select
                          value={row.columns}
                          onChange={(e) => updateRowColumns(row.id, Number(e.target.value))}
                          className="px-3 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value={1}>1 columna</option>
                          <option value={2}>2 columnas</option>
                          <option value={3}>3 columnas</option>
                          <option value={4}>4 columnas</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Altura:</label>
                        <select
                          value={row.height || "auto"}
                          onChange={(e) => updateRowHeight(row.id, e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="auto">Auto</option>
                          <option value="small">Pequeña</option>
                          <option value="medium">Mediana</option>
                          <option value="large">Grande</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Columnas de la fila */}
                {row.enabled && (
                  <div className={`grid grid-cols-${row.columns} gap-4 p-4`}>
                    {Array.from({ length: row.columns }).map((_, colIndex) => {
                      const item = row.items[colIndex];
                      return (
                        <div
                          key={colIndex}
                          className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-purple-400 transition-colors"
                        >
                          {item ? (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase">
                                  {item.type === "text" && "📝 Texto"}
                                  {item.type === "html" && "💻 HTML"}
                                  {item.type === "image" && "🖼️ Imagen"}
                                  {item.type === "video" && "🎬 Video"}
                                  {item.type === "map" && "🗺️ Mapa"}
                                  {item.type === "menu" && "📋 Menú"}
                                  {item.type === "social" && "🔗 Redes Sociales"}
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => editColumn(row.id, colIndex)}
                                    className="text-blue-600 hover:text-blue-700"
                                    title="Editar"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => deleteColumn(row.id, colIndex)}
                                    className="text-red-600 hover:text-red-700"
                                    title="Eliminar"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                              {item.title && (
                                <div className="font-semibold text-sm mb-1">{item.title}</div>
                              )}
                              {item.type === "text" && (
                                <div className="text-xs text-gray-600 line-clamp-2">{item.content}</div>
                              )}
                              {item.type === "image" && item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt={item.title}
                                  className="h-20 object-contain rounded"
                                  style={{ width: `${Math.max(25, Math.min(200, Number(item.imageScale) || 100))}%` }}
                                />
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => editColumn(row.id, colIndex)}
                              className="w-full py-8 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            >
                              <div className="text-2xl mb-1">+</div>
                              <div className="text-xs">Agregar contenido</div>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Botón guardar */}
            <div className="pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Guardando..." : "Guardar Footer"}
              </button>
            </div>
          </div>
        )}

        {/* Modal para editar columna */}
        {showModal && editingColumn && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full my-8">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Configurar Columna</h3>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Tipo de contenido */}
                <div>
                  <label className="block text-sm font-medium mb-2">Tipo de contenido</label>
                  <select
                    value={editingColumn.type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setEditingColumn({
                        ...editingColumn,
                        type: nextType,
                        textAlign: nextType === "social" ? "right" : editingColumn.textAlign,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="text">📝 Texto</option>
                    <option value="html">💻 Texto HTML</option>
                    <option value="image">🖼️ Imagen con enlace</option>
                    <option value="video">🎬 Video</option>
                    <option value="map">🗺️ Mapa</option>
                    <option value="menu">📋 Menú</option>
                    <option value="social">🔗 Redes Sociales</option>
                  </select>
                </div>

                {/* Título (opcional para todos) */}
                <div>
                  <label className="block text-sm font-medium mb-2">Título (opcional)</label>
                  <input
                    type="text"
                    value={editingColumn.title}
                    onChange={(e) => setEditingColumn({ ...editingColumn, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Título de la sección"
                  />
                </div>

                {/* Alineación de contenido */}
                <div>
                  <label className="block text-sm font-medium mb-2">Alineación del contenido</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border-2 rounded-lg transition-all hover:border-purple-300 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50">
                      <input
                        type="radio"
                        name="textAlign"
                        value="left"
                        checked={editingColumn.textAlign === "left"}
                        onChange={(e) => setEditingColumn({ ...editingColumn, textAlign: e.target.value })}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm">⬅️ Izquierda</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border-2 rounded-lg transition-all hover:border-purple-300 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50">
                      <input
                        type="radio"
                        name="textAlign"
                        value="center"
                        checked={editingColumn.textAlign === "center"}
                        onChange={(e) => setEditingColumn({ ...editingColumn, textAlign: e.target.value })}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm">↔️ Centro</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border-2 rounded-lg transition-all hover:border-purple-300 has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50">
                      <input
                        type="radio"
                        name="textAlign"
                        value="right"
                        checked={editingColumn.textAlign === "right"}
                        onChange={(e) => setEditingColumn({ ...editingColumn, textAlign: e.target.value })}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm">➡️ Derecha</span>
                    </label>
                  </div>
                </div>

                {/* Campos según el tipo */}
                {(editingColumn.type === "text" || editingColumn.type === "html") && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {editingColumn.type === "html" ? "Contenido HTML" : "Contenido"}
                    </label>
                    <textarea
                      value={editingColumn.content}
                      onChange={(e) => setEditingColumn({ ...editingColumn, content: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={6}
                      placeholder={
                        editingColumn.type === "html"
                          ? "<p>Tu código HTML aquí</p>"
                          : "Escribe el contenido..."
                      }
                    />
                  </div>
                )}

                {editingColumn.type === "image" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Imagen</label>
                      
                      {/* Vista previa de la imagen */}
                      {editingColumn.imageUrl && (
                        <div className="mb-3 relative inline-block">
                          <img 
                            src={editingColumn.imageUrl} 
                            alt="Vista previa" 
                            className="h-32 object-contain border border-gray-300 rounded"
                            style={{ width: `${Math.max(25, Math.min(200, Number(editingColumn.imageScale) || 100))}%` }}
                          />
                          <button
                            type="button"
                            onClick={() => setEditingColumn({ ...editingColumn, imageUrl: '' })}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-xs"
                            title="Eliminar imagen"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      
                      {/* Botón para abrir biblioteca */}
                      <button
                        type="button"
                        onClick={() => setShowMediaLibrary(true)}
                        className="w-full mb-3 px-4 py-3 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all flex items-center justify-center gap-2 text-purple-600 font-medium"
                      >
                        <ImageIcon className="w-5 h-5" />
                        {editingColumn.imageUrl ? 'Cambiar imagen' : 'Seleccionar de Biblioteca'}
                      </button>
                      
                      {/* Campo alternativo de URL manual */}
                      <div className="border-t pt-3">
                        <label className="block text-xs text-gray-500 mb-2">O pega una URL directamente:</label>
                        <input
                          type="text"
                          value={editingColumn.imageUrl}
                          onChange={(e) => setEditingColumn({ ...editingColumn, imageUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="http://localhost:3001/..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Tamaño de imagen: {Math.max(25, Math.min(200, Number(editingColumn.imageScale) || 100))}%
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={25}
                          max={200}
                          step={5}
                          value={Math.max(25, Math.min(200, Number(editingColumn.imageScale) || 100))}
                          onChange={(e) => setEditingColumn({ ...editingColumn, imageScale: Number(e.target.value) })}
                          className="flex-1"
                        />
                        <input
                          type="number"
                          min={25}
                          max={200}
                          step={5}
                          value={Math.max(25, Math.min(200, Number(editingColumn.imageScale) || 100))}
                          onChange={(e) => setEditingColumn({ ...editingColumn, imageScale: Number(e.target.value) })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-sm text-gray-500">%</span>
                        <button
                          type="button"
                          onClick={() => setEditingColumn({ ...editingColumn, imageScale: 100 })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50"
                        >
                          100%
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Enlace (opcional)</label>
                      <input
                        type="text"
                        value={editingColumn.linkUrl}
                        onChange={(e) => setEditingColumn({ ...editingColumn, linkUrl: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="https://ejemplo.com"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        💡 La imagen tendrá efecto zoom al pasar el mouse
                      </p>
                    </div>
                  </>
                )}

                {editingColumn.type === "video" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">URL del video</label>
                    <input
                      type="text"
                      value={editingColumn.videoUrl}
                      onChange={(e) => setEditingColumn({ ...editingColumn, videoUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="https://youtube.com/watch?v=..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Soporta YouTube, Vimeo o enlaces directos a .mp4
                    </p>
                  </div>
                )}

                {editingColumn.type === "map" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Código embed del mapa</label>
                    <textarea
                      value={editingColumn.mapEmbed}
                      onChange={(e) => setEditingColumn({ ...editingColumn, mapEmbed: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
                      rows={4}
                      placeholder='<iframe src="https://www.google.com/maps/embed?..." width="600" height="450"></iframe>'
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Obtén el código desde Google Maps → Compartir → Insertar un mapa
                    </p>
                  </div>
                )}

                {editingColumn.type === "menu" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Seleccionar Menú *</label>
                    <select
                      value={editingColumn.menuId}
                      onChange={(e) => setEditingColumn({ ...editingColumn, menuId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Selecciona un menú</option>
                      {menus.map(menu => (
                        <option key={menu.id} value={menu.id}>{menu.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 El menú se mostrará verticalmente en el footer
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Configura los menús en: Diseño → Menús
                    </p>
                  </div>
                )}

                {editingColumn.type === "social" && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Se mostrarán automáticamente las redes sociales configuradas en tu Header (Facebook, Instagram, WhatsApp, etc.) con icono y nombre, alineadas hacia la derecha.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingColumn(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveColumn}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Modal de Biblioteca de Medios */}
      {showMediaLibrary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold">Seleccionar Imagen</h2>
              <button
                onClick={() => setShowMediaLibrary(false)}
                className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <MediaLibrary
                vendorId={vendorId}
                mode="select"
                accept="image/*"
                onSelect={(file) => {
                  setEditingColumn({ ...editingColumn, imageUrl: file.url });
                  setShowMediaLibrary(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
export default FooterSection;