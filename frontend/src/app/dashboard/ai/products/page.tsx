"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import Link from "next/link";

interface Product {
  id: string;
  title: string;
  artist: string;
  album: string;
  images: string[];
  description: string;
  descriptionGeneratedByAI: boolean;
  descriptionGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AIStats {
  total: number;
  withDescriptionAI: number;
  pendingDescription: number;
}

interface PreviewItem {
  product: Product;
  description?: string;
  status: 'pending' | 'generated' | 'approved' | 'rejected' | 'error';
  error?: string;
}

type FilterType = 'all' | 'pending-description';
type GenerationMode = 'auto' | 'preview';
type SortType = 'newest' | 'oldest' | 'alphabetical' | 'artist';

export default function AIProductsPage() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<AIStats>({
    total: 0,
    withDescriptionAI: 0,
    pendingDescription: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('pending-description');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Modo de generación
  const [generationMode, setGenerationMode] = useState<GenerationMode>('auto');
  
  // Estado de generación masiva
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationTotal, setGenerationTotal] = useState(0);
  const [generationCurrent, setGenerationCurrent] = useState(0);
  const [generationErrors, setGenerationErrors] = useState<string[]>([]);
  const [generationSuccess, setGenerationSuccess] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  
  // Estado de previsualización
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewCurrent, setPreviewCurrent] = useState(0);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // Refs para control de pausa
  const isPausedRef = useRef(false);
  const shouldStopRef = useRef(false);
  
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  
  useEffect(() => {
    shouldStopRef.current = shouldStop;
  }, [shouldStop]);

  // Cargar datos
  useEffect(() => {
    loadData();
  }, []);

  // Filtrar y ordenar productos cuando cambia el filtro o el orden
  useEffect(() => {
    filterAndSortProducts();
  }, [products, filter, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      const user = await api.getProfile();
      if (!user?.vendor?.id) {
        console.error("No vendor found");
        return;
      }
      setVendorId(user.vendor.id);

      // Cargar todos los productos
      const response = await api.getProducts({ 
        vendorId: user.vendor.id, 
        limit: 1000
      });
      
      const allProducts = response.products || [];
      setProducts(allProducts);
      
      // Calcular estadísticas
      const withDescAI = allProducts.filter((p: Product) => p.descriptionGeneratedByAI).length;
      const pendingDesc = allProducts.filter((p: Product) => !p.descriptionGeneratedByAI).length;
      
      setStats({
        total: allProducts.length,
        withDescriptionAI: withDescAI,
        pendingDescription: pendingDesc,
      });
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortProducts = () => {
    let filtered: Product[] = [];
    
    switch (filter) {
      case 'pending-description':
        filtered = products.filter(p => !p.descriptionGeneratedByAI);
        break;
      default:
        filtered = products;
    }
    
    // Ordenar según la selección
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'artist':
        filtered.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
        break;
    }
    
    setFilteredProducts(filtered);
    setSelectedProducts(new Set());
    setSelectAll(false);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
    setSelectAll(newSelected.size === filteredProducts.length);
  };

  const parseImages = (images: unknown): string[] => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    try {
      return JSON.parse(images as string);
    } catch {
      return [];
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generar descripción para un producto
  const generateDescription = async (product: Product): Promise<{ success: boolean; description?: string }> => {
    if (!vendorId) return { success: false };
    try {
      const result = await api.generateDescriptionWithGemini(vendorId, {
        artist: product.artist,
        album: product.album || product.title,
        title: product.title,
      });
      
      if (result.description) {
        return { success: true, description: result.description };
      }
      return { success: false };
    } catch (error) {
      console.error(`Error generating description for ${product.title}:`, error);
      return { success: false };
    }
  };

  // Guardar descripción
  const saveDescription = async (productId: string, description: string): Promise<boolean> => {
    try {
      await api.updateProduct(productId, {
        description: description,
        descriptionGeneratedByAI: true,
        descriptionGeneratedAt: new Date(),
      });
      return true;
    } catch (error) {
      console.error('Error saving description:', error);
      return false;
    }
  };

  // Generar individual
  const handleGenerateIndividual = async (product: Product) => {
    if (!vendorId) return;
    
    const button = document.getElementById(`btn-description-${product.id}`);
    if (button) button.textContent = '⏳ Generando...';
    
    let success = false;
    const result = await generateDescription(product);
    if (result.success && result.description) {
      success = await saveDescription(product.id, result.description);
    }
    
    if (success) {
      await loadData();
    } else {
      if (button) button.textContent = '❌ Error';
      setTimeout(() => {
        if (button) button.textContent = '✨ Descripción IA';
      }, 2000);
    }
  };

  // Iniciar generación (auto o preview)
  const handleStartGeneration = async () => {
    if (selectedProducts.size === 0) {
      alert('Selecciona al menos un producto');
      return;
    }

    const productsToProcess = filteredProducts.filter(p => selectedProducts.has(p.id));

    if (generationMode === 'preview') {
      // Modo previsualización
      setPreviewItems(productsToProcess.map(p => ({ product: p, status: 'pending' })));
      setPreviewCurrent(0);
      setShowPreviewModal(true);
      await generatePreviewItems(productsToProcess);
    } else {
      // Modo automático
      await handleBulkGenerate(productsToProcess);
    }
  };

  // Generar items para previsualización
  const generatePreviewItems = async (productsToProcess: Product[]) => {
    setIsGeneratingPreview(true);
    const items: PreviewItem[] = [];

    for (let i = 0; i < productsToProcess.length; i++) {
      if (shouldStopRef.current) break;
      
      const product = productsToProcess[i];
      const item: PreviewItem = { product, status: 'pending' };
      
      try {
        // Generar descripción si es necesario
        if (!product.descriptionGeneratedByAI) {
          const descResult = await generateDescription(product);
          if (descResult.success) {
            item.description = descResult.description;
          }
        }

        // Delay para rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        item.status = 'generated';
      } catch {
        item.status = 'error';
        item.error = 'Error al generar';
      }

      items.push(item);
      setPreviewItems([...items]);
      setPreviewCurrent(i + 1);

      // Delay entre productos
      if (i < productsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setIsGeneratingPreview(false);
  };

  // Aprobar item de preview
  const handleApprovePreviewItem = async (index: number) => {
    const item = previewItems[index];
    if (!item || item.status !== 'generated') return;

    const newItems = [...previewItems];
    
    try {
      if (item.description) {
        await saveDescription(item.product.id, item.description);
      }
      newItems[index].status = 'approved';
    } catch {
      newItems[index].status = 'error';
      newItems[index].error = 'Error al guardar';
    }
    
    setPreviewItems(newItems);
  };

  // Rechazar item de preview
  const handleRejectPreviewItem = (index: number) => {
    const newItems = [...previewItems];
    newItems[index].status = 'rejected';
    setPreviewItems(newItems);
  };

  // Aprobar todos los pendientes
  const handleApproveAllPreview = async () => {
    for (let i = 0; i < previewItems.length; i++) {
      if (previewItems[i].status === 'generated') {
        await handleApprovePreviewItem(i);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  };

  // Cerrar modal de preview
  const handleClosePreviewModal = async () => {
    setShowPreviewModal(false);
    setShouldStop(false);
    await loadData();
  };

  // Generación masiva automática
  const handleBulkGenerate = async (productsToProcess: Product[]) => {
    setIsGenerating(true);
    setGenerationTotal(productsToProcess.length);
    setGenerationCurrent(0);
    setGenerationProgress(0);
    setGenerationErrors([]);
    setGenerationSuccess(0);
    setShouldStop(false);
    setIsPaused(false);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < productsToProcess.length; i++) {
      // Verificar si se debe pausar o detener
      while (isPausedRef.current && !shouldStopRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (shouldStopRef.current) {
        break;
      }

      const product = productsToProcess[i];
      setGenerationCurrent(i + 1);
      
      let productSuccess = true;

      // Generar descripción si es necesario
      if (!product.descriptionGeneratedByAI) {
        const descResult = await generateDescription(product);
        if (descResult.success && descResult.description) {
          const saved = await saveDescription(product.id, descResult.description);
          if (!saved) {
            errors.push(`${product.title}: Error guardando descripción`);
            productSuccess = false;
          }
        } else {
          errors.push(`${product.title}: Error generando descripción`);
          productSuccess = false;
        }
      }

      // Delay para rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (productSuccess) {
        successCount++;
        setGenerationSuccess(successCount);
      } else {
        setGenerationErrors([...errors]);
      }

      setGenerationProgress(((i + 1) / productsToProcess.length) * 100);

      // Delay entre productos para evitar rate limiting
      if (i < productsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Mostrar modal de finalización
    setIsGenerating(false);
    setShowCompletionModal(true);
  };

  const handleCloseCompletionModal = async () => {
    setShowCompletionModal(false);
    setSelectedProducts(new Set());
    setSelectAll(false);
    await loadData();
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    setShouldStop(true);
    setIsPaused(false);
  };

  // Regenerar individual (para productos que ya tienen IA)
  const handleRegenerate = async (product: Product) => {
    if (!vendorId) return;
    
    const confirmed = confirm(`¿Deseas regenerar la descripción para "${product.title}"? El contenido actual será reemplazado.`);
    if (!confirmed) return;
    
    await handleGenerateIndividual(product);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">🤖 Funciones IA - Productos</h1>
        <p className="text-gray-500 mt-1">Genera descripciones de productos con inteligencia artificial</p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Descripciones IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.withDescriptionAI}</div>
            <Progress value={(stats.withDescriptionAI / stats.total) * 100} className="mt-2 h-2" />
            <p className="text-xs text-gray-500 mt-1">{((stats.withDescriptionAI / stats.total) * 100).toFixed(1)}% completado</p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.pendingDescription}</div>
            <p className="text-xs text-red-500 mt-1">Sin descripción IA</p>
          </CardContent>
        </Card>
      </div>

      {/* Panel de generación masiva */}
      {isGenerating && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-purple-700">🚀 Generación en progreso...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Procesando {generationCurrent} de {generationTotal}</span>
                <span>{generationProgress.toFixed(0)}%</span>
              </div>
              <Progress value={generationProgress} className="h-3" />
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600">✅ Exitosos: {generationSuccess}</span>
              <span className="text-red-600">❌ Errores: {generationErrors.length}</span>
              {isPaused && <span className="text-yellow-600">⏸️ En pausa</span>}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePauseResume}
              >
                {isPaused ? '▶️ Continuar' : '⏸️ Pausar'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStop}
              >
                ⏹️ Detener
              </Button>
            </div>

            {generationErrors.length > 0 && (
              <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700 max-h-32 overflow-y-auto">
                {generationErrors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filtros y acciones */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Filtro */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Filtrar:</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as FilterType)}
                  className="border rounded px-3 py-1.5 text-sm"
                >
                  <option value="all">Todos los productos</option>
                  <option value="pending-description">Sin descripción IA ({stats.pendingDescription})</option>
                </select>
              </div>

              {/* Ordenar */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                  className="border rounded px-3 py-1.5 text-sm"
                >
                  <option value="newest">Más nuevos primero</option>
                  <option value="oldest">Más antiguos primero</option>
                  <option value="alphabetical">Alfabético (título)</option>
                  <option value="artist">Por artista</option>
                </select>
              </div>
            </div>

            {selectedProducts.size > 0 && !isGenerating && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600">{selectedProducts.size} seleccionados</span>
                
                {/* Modo de generación */}
                <select
                  value={generationMode}
                  onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
                  className="border rounded px-3 py-1.5 text-sm bg-blue-50"
                >
                  <option value="auto">🚀 Generar y guardar</option>
                  <option value="preview">👁️ Generar y revisar</option>
                </select>
                
                <Button
                  onClick={handleStartGeneration}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                >
                  {generationMode === 'preview' ? '👁️ Previsualizar' : '🚀 Generar'} ({selectedProducts.size})
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Productos ({filteredProducts.length})</CardTitle>
            {filteredProducts.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm cursor-pointer">
                  Seleccionar todos
                </label>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">🎉</p>
              <p>¡No hay productos pendientes con este filtro!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product) => {
                const images = parseImages(product.images);
                const imageUrl = images.length > 0 ? getImageUrl(images[0]) : '/placeholder.png';
                
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedProducts.has(product.id)}
                      onCheckedChange={(checked: boolean) => handleSelectProduct(product.id, checked)}
                    />
                    
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="w-12 h-12 object-cover rounded"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{product.title}</h3>
                      <p className="text-sm text-gray-500 truncate">{product.artist}</p>
                      <p className="text-xs text-gray-400">
                        Creado: {formatDate(product.createdAt)}
                      </p>
                    </div>

                    {/* Status badges con fechas */}
                    <div className="flex flex-col items-end gap-1">
                      {product.descriptionGeneratedByAI ? (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                            ✓ Descripción
                          </span>
                          <button
                            onClick={() => handleRegenerate(product)}
                            className="text-xs text-gray-400 hover:text-purple-600"
                            title="Regenerar descripción"
                          >
                            🔄
                          </button>
                          {product.descriptionGeneratedAt && (
                            <span className="text-xs text-gray-400">
                              {formatDate(product.descriptionGeneratedAt)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">Sin descripción</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!product.descriptionGeneratedByAI && (
                        <Button
                          id={`btn-description-${product.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateIndividual(product)}
                          disabled={isGenerating}
                        >
                          ✨ Descripción IA
                        </Button>
                      )}
                      <Link href={`/dashboard/products/${product.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          ✏️ Editar
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de previsualización */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <div>
                <h2 className="text-xl font-bold">👁️ Previsualización de Generación IA</h2>
                <p className="text-purple-100 text-sm">
                  {isGeneratingPreview 
                    ? `Generando ${previewCurrent} de ${previewItems.length}...` 
                    : `${previewItems.filter(i => i.status === 'generated').length} listos para revisar`}
                </p>
              </div>
              <div className="flex gap-2">
                {!isGeneratingPreview && previewItems.some(i => i.status === 'generated') && (
                  <Button
                    onClick={handleApproveAllPreview}
                    className="bg-white text-purple-600 hover:bg-purple-50"
                  >
                    ✅ Aprobar todos
                  </Button>
                )}
                <Button
                  onClick={handleClosePreviewModal}
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                >
                  ✕ Cerrar
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {previewItems.map((item, index) => (
                <div 
                  key={item.product.id}
                  className={`border rounded-lg p-4 ${
                    item.status === 'approved' ? 'bg-green-50 border-green-200' :
                    item.status === 'rejected' ? 'bg-red-50 border-red-200' :
                    item.status === 'error' ? 'bg-red-50 border-red-300' :
                    item.status === 'generated' ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={parseImages(item.product.images)[0] ? getImageUrl(parseImages(item.product.images)[0]) : '/placeholder.png'}
                      alt={item.product.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-bold">{item.product.title}</h3>
                          <p className="text-sm text-gray-500">{item.product.artist}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.status === 'pending' && (
                            <span className="px-3 py-1 text-xs bg-gray-200 text-gray-600 rounded-full">⏳ Pendiente</span>
                          )}
                          {item.status === 'generated' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprovePreviewItem(index)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                ✅ Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectPreviewItem(index)}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                ❌ Rechazar
                              </Button>
                            </>
                          )}
                          {item.status === 'approved' && (
                            <span className="px-3 py-1 text-xs bg-green-200 text-green-700 rounded-full">✓ Guardado</span>
                          )}
                          {item.status === 'rejected' && (
                            <span className="px-3 py-1 text-xs bg-red-200 text-red-700 rounded-full">✕ Rechazado</span>
                          )}
                          {item.status === 'error' && (
                            <span className="px-3 py-1 text-xs bg-red-200 text-red-700 rounded-full">⚠️ Error</span>
                          )}
                        </div>
                      </div>

                      {item.description && (
                        <div className="mt-3">
                          <h4 className="text-sm font-semibold text-purple-600 mb-1">📝 Descripción generada:</h4>
                          <p className="text-sm text-gray-700 bg-white p-3 rounded border max-h-32 overflow-y-auto">
                            {item.description}
                          </p>
                        </div>
                      )}

                      {item.error && (
                        <p className="text-sm text-red-600 mt-2">{item.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {isGeneratingPreview && (
              <div className="p-4 border-t bg-gray-50">
                <Progress value={(previewCurrent / previewItems.length) * 100} className="h-2" />
                <p className="text-sm text-gray-500 text-center mt-2">
                  Generando contenido... {previewCurrent} de {previewItems.length}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de finalización */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              <div className="text-6xl mb-4">
                {generationErrors.length === 0 ? '🎉' : '⚠️'}
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {generationErrors.length === 0 ? '¡Generación completada!' : 'Generación finalizada'}
              </h2>
              <p className="text-gray-600 mb-6">
                Se ha finalizado la generación con IA para <strong>{generationTotal}</strong> productos.
              </p>
              
              <div className="flex justify-center gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{generationSuccess}</div>
                  <div className="text-sm text-gray-500">Exitosos</div>
                </div>
                {generationErrors.length > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{generationErrors.length}</div>
                    <div className="text-sm text-gray-500">Errores</div>
                  </div>
                )}
              </div>

              {generationErrors.length > 0 && (
                <details className="mb-4 text-left">
                  <summary className="cursor-pointer text-sm text-red-600 hover:text-red-700">
                    Ver errores ({generationErrors.length})
                  </summary>
                  <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700 max-h-32 overflow-y-auto">
                    {generationErrors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                </details>
              )}

              <Button
                onClick={handleCloseCompletionModal}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                size="lg"
              >
                Aceptar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
