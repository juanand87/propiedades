"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import { ShoppingCart, Eye, X } from "lucide-react";
import { getCategoryUrl, getProductUrl } from "@/lib/useCustomDomain";
import { formatPrice } from "@/lib/format";
import GoldmineScale from "@/components/predefined/GoldmineScale";
import HowToBuy from "@/components/predefined/HowToBuy";
import SellWithUs from "@/components/predefined/SellWithUs";
import SellWithUsHero from "@/components/predefined/SellWithUsHero";
import MarketplacePresentation from "@/components/predefined/MarketplacePresentation";
import ProductCarousel from "@/components/blocks/ProductCarousel";
import ImageCarousel from "@/components/blocks/ImageCarousel";
import StoreBenefits from "@/components/blocks/StoreBenefits";
import { usePathname, useSearchParams } from "next/navigation";

// ===== DISEÑO SIMPLIFICADO =====
// Cambiar a false para volver al diseño con fondos
const SIMPLIFIED_DESIGN = false;
// ================================

interface PageBlock {
  id: string;
  type: "text" | "grid" | "slides" | "image" | "video" | "imageText" | "component" | "carousel" | "imageCarousel";
  columns: number;
  row: number;
  column: number;
  text?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageLink?: string;
  imageLinkTarget?: "_self" | "_blank";
  videoUrl?: string;
  videoType?: "youtube" | "vimeo" | "custom";
  sliderId?: string;
  backgroundImage?: string;
  title?: string;
  buttonText?: string;
  buttonLink?: string;
  componentName?: string;
  benefitsConfig?: {
    items: Array<{
      icon: "truck" | "shield" | "payment";
      title: string;
      description: string;
    }>;
  };
  gridConfig?: {
    displayMode: "latest" | "featured" | "best-sellers" | "categories" | "on-sale";
    categoryId?: string;
    sortBy?: "newest" | "most-sold" | "featured";
    columns: number;
    rows: number | null;
    isInfiniteScroll: boolean;
    maxProducts?: number;
    showCategoryTitle?: boolean;
  };
}

interface Product {
  id: string;
  title: string;
  artist: string;
  price: number;
  salePrice?: number;
  images: string[];
  slug: string;
  stock?: number;
  vendorId?: string;
  category?: string;
}

interface PageRendererProps {
  blocks: PageBlock[];
  rowsConfig?: Array<{
    row: number;
    columns: number;
  }>;
  vendorSlug: string;
  vendorId?: string;
  settings?: any;
  isHomepage?: boolean;
}

// Slider Component
function Slider({ sliderId, vendorSlug }: { sliderId?: string; vendorSlug: string }) {
  const [slider, setSlider] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sliderId) {
      setLoading(false);
      return;
    }

    const loadSlider = async () => {
      try {
        
        // Get vendor by slug
        const vendor = await api.getVendorBySlug(vendorSlug);
        
        // Get vendor settings
        const settings = await api.getVendorSettings(vendor.id);
        
        // Find the slider by ID - compare as strings since sliderId comes as string from DB
        const foundSlider = settings.slides?.find((s: any) => String(s.id) === String(sliderId));
        
        setSlider(foundSlider);
      } catch (error) {
        console.error("[Slider] Error loading slider:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSlider();
  }, [sliderId, vendorSlug]);

  useEffect(() => {
    if (!slider || !slider.items || slider.items.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slider.items.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [slider]);

  if (loading) {
    return (
      <div className="w-full h-64 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
        <p className="text-gray-400">Cargando slider...</p>
      </div>
    );
  }

  if (!slider) {
    return (
      <div className="w-full h-64 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
        <p className="text-gray-400">No se encontró el slider</p>
      </div>
    );
  }

  if (!slider.items || !Array.isArray(slider.items) || slider.items.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
        <p className="text-gray-400">El slider no tiene imágenes</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-96 overflow-hidden rounded-lg shadow-lg">
      {/* Slides */}
      {slider.items.map((item: any, index: number) => {
        // Get image URL - handle both 'image' and 'imageUrl' properties
        const imageUrl = item.imageUrl || item.image;
        const imageSrc = imageUrl ? getImageUrl(imageUrl) : null;
        const isGradient = item.mediaType === 'gradient' || item.type === 'gradient';
        const gradientStyle = item.gradient
          || (item.gradientFrom && item.gradientTo
            ? `linear-gradient(135deg, ${item.gradientFrom} 0%, ${item.gradientTo} 100%)`
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
        
        return (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
          >
            {item.mediaType === 'video' && item.videoUrl ? (
              <video
                src={item.videoUrl}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : isGradient ? (
              <div
                className="w-full h-full"
                style={{ background: gradientStyle }}
              />
            ) : imageSrc ? (
              <img
                src={imageSrc}
                alt={item.title || `Slide ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error(`[Slider] Failed to load image:`, imageSrc);
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500">Error al cargar imagen</div>';
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500">
                Sin imagen
              </div>
            )}
            {/* Overlay con contenido */}
            <div 
              className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 md:p-6"
              style={{
                backgroundColor: `rgba(0, 0, 0, ${item.imageOpacity || 0.3})`
              }}
            >
              {item.title && (
                <h3 
                  className="text-xl md:text-3xl font-bold mb-2 md:mb-2"
                  style={{
                    color: item.titleColor || "#ffffff",
                    textShadow: item.titleShadow !== false 
                      ? '2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)' 
                      : 'none'
                  }}
                >
                  {item.title}
                </h3>
              )}
              {item.description && (
                <p 
                  className="hidden md:block text-base mb-4 drop-shadow-lg"
                  style={{ color: item.descriptionColor || "#ffffff" }}
                >
                  {item.description}
                </p>
              )}
              {item.buttonText && (
                item.link ? (
                  <Link
                    href={item.link}
                    className="px-4 py-2 md:px-6 md:py-2 rounded-lg text-sm md:text-base font-medium shadow-lg hover:opacity-90 transition-opacity"
                    style={{
                      backgroundColor: item.buttonBgColor || "#8b5cf6",
                      color: item.buttonTextColor || "#ffffff"
                    }}
                  >
                    {item.buttonText}
                  </Link>
                ) : (
                  <button
                    className="px-4 py-2 md:px-6 md:py-2 rounded-lg text-sm md:text-base font-medium shadow-lg"
                    style={{
                      backgroundColor: item.buttonBgColor || "#8b5cf6",
                      color: item.buttonTextColor || "#ffffff"
                    }}
                  >
                    {item.buttonText}
                  </button>
                )
              )}
            </div>
          </div>
        );
      })}

      {/* Navigation dots */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
        {slider.items.map((_: any, index: number) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentSlide
                ? "bg-white w-8"
                : "bg-white/50 hover:bg-white/75"
            }`}
            aria-label={`Ir al slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Previous/Next buttons */}
      {slider.items.length > 1 && (
        <>
          <button
            onClick={() =>
              setCurrentSlide((prev) =>
                prev === 0 ? slider.items.length - 1 : prev - 1
              )
            }
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-black p-2 rounded-full transition-colors"
            aria-label="Slide anterior"
          >
            ←
          </button>
          <button
            onClick={() =>
              setCurrentSlide((prev) => (prev + 1) % slider.items.length)
            }
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-black p-2 rounded-full transition-colors"
            aria-label="Siguiente slide"
          >
            →
          </button>
        </>
      )}
    </div>
  );
}

// Product Grid Component
function ProductGrid({ config, vendorSlug, vendorId, settings }: { config: any; vendorSlug: string; vendorId?: string; settings?: any }) {
  const { addItem } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const [previewSelectedImage, setPreviewSelectedImage] = useState<string | null>(null);
  const restoredFromSessionRef = React.useRef(false);
  const gridConfig = config.gridConfig;
  const sessionKey = `pageRendererGrid:${pathname}:${searchParams.toString()}:${vendorSlug}:${vendorId || 'marketplace'}:${config?.id || config?.row || 'grid'}:${gridConfig?.displayMode || 'latest'}:${gridConfig?.categoryId || 'none'}`;

  const saveGridState = () => {
    try {
      const stateData = {
        products,
        hasMore,
        offset,
        scrollY: window.scrollY,
        savedAt: Date.now(),
      };
      localStorage.setItem(sessionKey, JSON.stringify(stateData));
      console.log('✅ [PageRenderer] State saved:', sessionKey, 'scrollY:', window.scrollY);
    } catch (error) {
      console.warn('Could not save page renderer grid state:', error);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const rawState = localStorage.getItem(sessionKey);
      console.log('🔍 [PageRenderer] Searching for state:', sessionKey, 'found:', !!rawState);
      
      if (!rawState) return;

      const state = JSON.parse(rawState);
      const isFresh = Date.now() - (state.savedAt || 0) < 60 * 60 * 1000; // 1 hour
      
      if (!isFresh) {
        console.log('⏰ [PageRenderer] State is stale, clearing');
        localStorage.removeItem(sessionKey);
        return;
      }
      
      if (!Array.isArray(state.products) || state.products.length === 0) {
        console.log('❌ [PageRenderer] No products in saved state');
        return;
      }

      console.log('✨ [PageRenderer] Restoring state with', state.products.length, 'products, scroll:', state.scrollY);
      restoredFromSessionRef.current = true;
      setProducts(state.products);
      setHasMore(Boolean(state.hasMore));
      setOffset(Number(state.offset) || state.products.length);
      setLoading(false);

      // Restore scroll after render
      setTimeout(() => {
        window.scrollTo(0, Number(state.scrollY) || 0);
        console.log('📍 [PageRenderer] Scroll restored to:', state.scrollY);
      }, 100);
    } catch (error) {
      console.warn('Could not restore page renderer grid state:', error);
    }
  }, [sessionKey]);

  const loadProducts = async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      }
      
      if (!gridConfig) return;

      console.log("🛍️ Loading products for grid:", gridConfig);
      
      const cols = gridConfig.columns || 4;
      const rows = gridConfig.rows;
      const limit = rows ? rows * cols : (gridConfig.limit || 12);
      const currentOffset = isLoadMore ? offset : 0;
      
      let apiParams: any = {
        limit,
        offset: currentOffset,
      };
      
      // Si hay vendorId (página de tienda), filtrar por vendor
      // Si no hay vendorId (página de marketplace), usar marketplaceOnly
      if (vendorId) {
        apiParams.vendorId = vendorId;
      } else {
        apiParams.marketplaceOnly = true;
      }

      // Configurar parámetros según el tipo de grid
      switch (gridConfig.displayMode) {
        case "latest":
          // Los productos ya vienen ordenados por fecha de creación (más recientes primero)
          break;
        case "categories":
          if (gridConfig.categoryId) {
            apiParams.categoryId = gridConfig.categoryId;
          }
          break;
        case "featured":
          // TODO: Implementar productos destacados
          break;
        case "on-sale":
          apiParams.isOnSale = true;
          break;
        case "best-sellers":
          // TODO: Implementar más vendidos
          break;
      }
        
      const response = await api.getProducts(apiParams);
      console.log("📡 API Response:", response);
      
      // La API devuelve directamente los datos, no envueltos en success/data
      if (response && response.products) {
        const newProducts = response.products;
        console.log("✅ Products loaded:", newProducts.length);
        
        if (isLoadMore) {
          setProducts(prev => [...prev, ...newProducts]);
        } else {
          setProducts(newProducts);
        }
        
        // Verificar si hay más productos basado en el total y productos actuales
        const currentTotal = isLoadMore ? products.length + newProducts.length : newProducts.length;
        setHasMore(currentTotal < response.total);
        setOffset(currentOffset + newProducts.length);
      } else {
        console.error("❌ Failed to load products: Invalid response structure", response);
      }
    } catch (error) {
      console.error("❌ Error loading products:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (restoredFromSessionRef.current) {
      restoredFromSessionRef.current = false;
      return;
    }

    setOffset(0);
    setProducts([]);
    setLoading(true);
    loadProducts(false);
  }, [config?.gridConfig?.displayMode, config?.gridConfig?.categoryId, config?.gridConfig?.limit, config?.gridConfig?.rows, config?.gridConfig?.columns, vendorSlug]);
  // Función para obtener el título del grid
  const getGridTitle = () => {
    if (!gridConfig?.showCategoryTitle) return null;
    
    switch (gridConfig.displayMode) {
      case "latest":
        return "Últimos productos";
      case "categories":
        return "Productos por categoría";
      case "featured":
        return "Productos destacados";
      case "on-sale":
        return "Productos en Oferta";
      case "best-sellers":
        return "Más vendidos";
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {getGridTitle() && (
          <h2 className="text-xl font-bold text-gray-900">{getGridTitle()}</h2>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-48 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-4">
        {getGridTitle() && (
          <h2 className="text-xl font-bold text-gray-900">{getGridTitle()}</h2>
        )}
        <div className="text-center py-8 text-gray-500">
          No hay productos disponibles
        </div>
      </div>
    );
  }

  const gridCols = Math.min(gridConfig?.columns || 4, 6);
  const gridClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  }[gridCols] || "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  // Parsear imágenes (pueden venir como JSON string o array)
  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    if (typeof images === 'string') {
      try {
        return JSON.parse(images);
      } catch {
        return [images];
      }
    }
    return [];
  };

  return (
    <div className="space-y-4">
      {getGridTitle() && (
        <h2 className="text-xl font-bold text-gray-900">{getGridTitle()}</h2>
      )}
      
      <div className={`grid ${gridClass} gap-4`}>
        {products.map((product) => {

          const primaryThumb = getProductImageByIndex(product, 0, 'thumb');
          const secondThumb = getProductImageByIndex(product, 1, 'thumb');
          const imageUrl = primaryThumb ? getImageUrl(primaryThumb) : null;
          const secondImageUrl = secondThumb ? getImageUrl(secondThumb) : null;

          return (
            <div 
              key={product.id} 
              className={SIMPLIFIED_DESIGN 
                ? "group h-full flex flex-col" 
                : "bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer group h-full flex flex-col"
              }
            >
              <div className={`relative w-full aspect-square overflow-hidden ${SIMPLIFIED_DESIGN ? 'rounded-lg' : 'rounded-t-lg'}`}>
                <Link href={getProductUrl(product, vendorSlug)} onClick={saveGridState}>
                  <div className="absolute inset-0 cursor-pointer">
                    {imageUrl ? (
                      settings?.imageRolloverEnabled && secondImageUrl ? (
                        // Image Rollover Effect
                        <>
                          <img
                            src={imageUrl}
                            alt={product.title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-300"
                          />
                          <img
                            src={secondImageUrl}
                            alt={product.title}
                            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          />
                        </>
                      ) : (
                        // Single image
                        <img
                          src={imageUrl}
                          alt={product.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '';
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400">Sin imagen</div>';
                            }
                          }}
                        />
                      )
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                        <span className="text-4xl">🎵</span>
                      </div>
                    )}
                  </div>
                </Link>
                
                {product.salePrice && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs z-10">
                    Oferta
                  </div>
                )}
                
                {/* Category Badge */}
                {settings?.productGridCategoryDisplay && 
                 settings.productGridCategoryDisplay.mode !== 'none' && 
                 (product as any).category && (
                  <div 
                    className={`absolute bg-white/90 shadow-md text-xs font-semibold rounded-lg p-2 z-10 group/badge ${
                      settings.productGridCategoryDisplay.position === 'top-left' ? 'top-2 left-2' :
                      settings.productGridCategoryDisplay.position === 'top-right' ? 'top-2 right-2' :
                      settings.productGridCategoryDisplay.position === 'bottom-left' ? 'bottom-2 left-2' :
                      'bottom-2 right-2'
                    }`}
                  >
                    {settings.productGridCategoryDisplay.mode === 'icon' ? (
                      (product as any).categoryIcon ? (
                        (product as any).categoryIcon.startsWith('/') || (product as any).categoryIcon.startsWith('http') ? (
                          <img 
                            src={getImageUrl((product as any).categoryIcon)} 
                            alt={(product as any).category}
                            className={`w-6 h-6 object-contain${/vinilo|vinyl/i.test((product as any).category || '') ? ' disc-spin' : ''}`}
                          />
                        ) : (
                          <span className={`text-xl${(product as any).categoryIcon === '💿' ? ' disc-spin' : ''}`}>{(product as any).categoryIcon}</span>
                        )
                      ) : '🏷️'
                    ) : (product as any).category}
                    {settings.productGridCategoryDisplay.mode === 'icon' && (
                      <span className={`
                        pointer-events-none absolute hidden group-hover/badge:block
                        bg-gray-800 text-white text-xs font-normal rounded px-2 py-1 whitespace-nowrap
                        top-1/2 -translate-y-1/2 z-30
                        ${(settings.productGridCategoryDisplay.position === 'top-right' || settings.productGridCategoryDisplay.position === 'bottom-right')
                          ? 'right-full mr-2'
                          : 'left-full ml-2'}
                      `}>
                        {(product as any).category}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Botones de acción - Hover en desktop, ocultos en mobile */}
                <div className="hidden md:flex absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 gap-1">
                  {/* Botón Vista Previa - solo ícono para evitar salto de línea en grids anchos */}
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreviewProduct(product);
                      setPreviewSelectedImage(null);
                    }}
                    className="bg-gray-800/95 hover:bg-gray-900 text-white font-semibold py-3 px-4 transition-colors backdrop-blur-sm flex items-center justify-center"
                    title="Vista Previa"
                  >
                    <Eye className="w-4 h-4 flex-shrink-0" />
                  </button>
                  
                  {/* Botón Agregar al Carrito */}
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addItem({
                        productId: product.id,
                        title: product.title,
                        artist: product.artist,
                        price: product.salePrice || product.price,
                        imageUrl: imageUrl || undefined,
                        stock: product.stock || 1,
                        vendorId: (product as any).vendor?.id || product.vendorId || '',
                        vendorSlug: (product as any).vendor?.slug || (product as any).vendorSlug || vendorSlug,
                      });
                    }}
                    disabled={!product.stock || product.stock <= 0}
                    className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed backdrop-blur-sm flex items-center justify-center gap-2"
                    style={{ background: !product.stock || product.stock <= 0 ? undefined : 'linear-gradient(135deg, var(--color-primary, #9333ea) 0%, var(--color-secondary, #2563eb) 100%)' }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>
              
              {/* Botones siempre visibles en mobile */}
              <div className="md:hidden flex gap-1 p-1.5">
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreviewProduct(product);
                    setPreviewSelectedImage(null);
                  }}
                  className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-medium py-2 text-sm rounded transition-all flex items-center justify-center gap-1"
                  style={{ background: `linear-gradient(135deg, var(--color-secondary, #2563eb) 0%, var(--color-primary, #9333ea) 100%)` }}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Vista</span>
                </button>
                
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addItem({
                      productId: product.id,
                      title: product.title,
                      artist: product.artist,
                      price: product.salePrice || product.price,
                      imageUrl: imageUrl || undefined,
                      stock: product.stock || 1,
                      vendorId: (product as any).vendor?.id || product.vendorId || '',
                      vendorSlug: (product as any).vendor?.slug || (product as any).vendorSlug || vendorSlug,
                    });
                  }}
                  disabled={!product.stock || product.stock <= 0}
                  className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-medium py-2 text-sm rounded transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>+</span>
                </button>
              </div>
              
              <div className="p-3 flex flex-col flex-1">
                <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.title}</h3>
                <div className="flex items-center justify-between">
                  {product.salePrice ? (
                    <div className="flex flex-col">
                      <span className="text-lg md:text-xl font-bold text-red-600">${Math.round(product.salePrice).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      <span className="text-sm text-gray-500 line-through">${Math.round(product.price).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  ) : (
                    <span className="text-lg md:text-xl font-bold theme-text">${Math.round(product.price).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón Cargar más para scroll infinito */}
      {gridConfig?.infiniteScroll && hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={() => loadProducts(true)}
            disabled={loadingMore}
            className="text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary, #9333ea) 0%, var(--color-secondary, #2563eb) 100%)',
            }}
          >
            {loadingMore ? "Cargando..." : "Cargar más productos"}
          </button>
        </div>
      )}

      {/* Modal de Vista Previa */}
      {previewProduct && (() => {
        const primaryImage = getProductImageByIndex(previewProduct, 0, 'large') || getProductImageByIndex(previewProduct, 0, 'thumb');
        const displayImage = previewSelectedImage || primaryImage;
        const selectedImage = displayImage || primaryImage;

        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setPreviewProduct(null); setPreviewSelectedImage(null); }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-2xl font-bold text-gray-900">Vista Previa</h2>
                <button
                  onClick={() => { setPreviewProduct(null); setPreviewSelectedImage(null); }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                      {selectedImage ? (
                        <img
                          src={getImageUrl(selectedImage)}
                          alt={previewProduct.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span className="text-6xl">?</span>
                        </div>
                      )}
                    </div>

                    {(() => {
                      const images = parseImages(previewProduct.images);
                      return images.length > 1 && (
                        <div className="grid grid-cols-4 gap-2">
                          {images.slice(0, 4).map((img: any, idx: number) => {
                            const imgUrl = getProductImageByIndex(previewProduct, idx, 'thumb');
                            const largeUrl = getProductImageByIndex(previewProduct, idx, 'large') || imgUrl;
                            return imgUrl && (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setPreviewSelectedImage(largeUrl)}
                                className={`aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 transition-colors cursor-pointer ${selectedImage === largeUrl ? 'theme-border' : 'border-gray-200 hover:theme-border'}`}
                              >
                                <img
                                  src={getImageUrl(imgUrl)}
                                  alt={`${previewProduct.title} ${idx + 1}`}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col space-y-6">
                    <div>
                      <h3 className="text-3xl font-bold text-gray-900 mb-2">
                        {previewProduct.title}
                      </h3>
                      {previewProduct.artist && (
                        <p className="text-xl text-gray-600">
                          {previewProduct.artist}
                        </p>
                      )}
                    </div>

                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-bold theme-text">
                        {formatPrice(Number(previewProduct.price) || 0)}
                      </span>
                      {previewProduct.stock > 0 ? (
                        <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                          Stock disponible: {previewProduct.stock}
                        </span>
                      ) : (
                        <span className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
                          Sin stock
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 border-t pt-4">
                      {previewProduct.format && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Formato:</span>
                          <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                            {previewProduct.format}
                          </span>
                        </div>
                      )}
                      {previewProduct.genre && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Genero:</span>
                          <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                            {previewProduct.genre}
                          </span>
                        </div>
                      )}
                      {previewProduct.condition && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Condicion:</span>
                          <span className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                            {previewProduct.condition}
                          </span>
                        </div>
                      )}
                      {previewProduct.year && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 w-24">Ano:</span>
                          <span className="text-sm text-gray-900">{previewProduct.year}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4 border-t mt-auto">
                      <Link
                        href={getProductUrl(previewProduct, vendorSlug)}
                        onClick={saveGridState}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                      >
                        Ver detalles completos
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const primaryImage = getProductImageByIndex(previewProduct, 0, 'thumb');
                          addItem({
                            productId: previewProduct.id,
                            title: previewProduct.title,
                            artist: previewProduct.artist,
                            price: previewProduct.price,
                            imageUrl: primaryImage ? getImageUrl(primaryImage) : undefined,
                            stock: previewProduct.stock || 1,
                            vendorId: previewProduct.vendor?.id || previewProduct.vendorId || '',
                            vendorSlug: previewProduct.vendor?.slug || previewProduct.vendorSlug || vendorSlug,
                          });
                          setPreviewProduct(null);
                          setPreviewSelectedImage(null);
                        }}
                        disabled={!previewProduct.stock || previewProduct.stock <= 0}
                        className="flex-1 theme-gradient-bg hover:opacity-90 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-5 h-5" />
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const PageRenderer: React.FC<PageRendererProps> = ({ blocks, rowsConfig, vendorSlug, vendorId, settings, isHomepage }) => {
  const organizeBlocksIntoRows = () => {
    if (!blocks.length) return [];

    const rows: { [key: number]: PageBlock[] } = {};
    blocks.forEach((block) => {
      const row = block.row || 0;
      if (!rows[row]) {
        rows[row] = [];
      }
      rows[row].push(block);
    });

    return Object.keys(rows)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((rowNum) => {
        const rowIndex = parseInt(rowNum);
        const savedRowConfig = rowsConfig?.find(config => config.row === rowIndex);
        const columns = savedRowConfig?.columns || 4;
        
        return {
          index: rowIndex,
          columns: columns,
          blocks: rows[rowIndex] || [],
        };
      });
  };

  const renderBlock = (block: PageBlock) => {
    switch (block.type) {
      case "text":
        return (
          <div className="prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: block.text || "" }} />
          </div>
        );

      case "image": {
        if (block.title) {
          const categorySlug = block.imageLink?.match(/^\/categoria\/([^/?#]+)/)?.[1];
          const imageLink = categorySlug
            ? getCategoryUrl(vendorSlug, categorySlug)
            : block.imageLink;
          const categoryBanner = (
            <div className="group relative aspect-[16/9] w-full overflow-hidden rounded-md bg-gray-200 shadow-sm">
              {block.imageUrl ? (
                <img
                  src={getImageUrl(block.imageUrl)}
                  alt={block.imageAlt || block.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : null}
              <div className="absolute inset-0 bg-black/40 transition-colors group-hover:bg-black/50" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-white">
                <h2 className="text-xl font-semibold drop-shadow">{block.title}</h2>
                <span className="mt-2 text-sm font-semibold uppercase drop-shadow">{block.buttonText || 'Ver más'}</span>
              </div>
            </div>
          );

          return imageLink ? (
            <a
              href={imageLink}
              target={block.imageLinkTarget || "_self"}
              rel={(block.imageLinkTarget || "_self") === "_blank" ? "noopener noreferrer" : undefined}
              className="block"
            >
              {categoryBanner}
            </a>
          ) : categoryBanner;
        }

        const imageElement = block.imageUrl ? (
          <img
            src={getImageUrl(block.imageUrl)}
            alt={block.imageAlt || ""}
            className="max-w-full h-auto rounded-lg"
          />
        ) : (
          <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
            <span className="text-gray-500">Imagen no disponible</span>
          </div>
        );

        return (
          <div className="text-center">
            {block.imageUrl && block.imageLink ? (
              <a
                href={block.imageLink}
                target={block.imageLinkTarget || "_self"}
                rel={(block.imageLinkTarget || "_self") === "_blank" ? "noopener noreferrer" : undefined}
                className="inline-block max-w-full"
              >
                {imageElement}
              </a>
            ) : imageElement}
          </div>
        );
      }

      case "video":
        return (
          <div className="video-container">
            {block.videoUrl ? (
              <div className="aspect-video">
                {block.videoType === "youtube" ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(block.videoUrl)}`}
                    className="w-full h-full rounded-lg"
                    allowFullScreen
                  />
                ) : block.videoType === "vimeo" ? (
                  <iframe
                    src={`https://player.vimeo.com/video/${getVimeoVideoId(block.videoUrl)}`}
                    className="w-full h-full rounded-lg"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={block.videoUrl}
                    controls
                    className="w-full h-full rounded-lg"
                  />
                )}
              </div>
            ) : (
              <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-gray-500">Video no disponible</span>
              </div>
            )}
          </div>
        );

      case "grid":
        return (
          <div className="grid-block">
            <ProductGrid config={block} vendorSlug={vendorSlug} vendorId={vendorId} settings={settings} />
          </div>
        );

      case "slides":
        if (isHomepage && settings?.slides?.some((carousel: any) => carousel.showInHomepage === true)) {
          return null;
        }
        return (
          <div className="slides-block">
            <Slider sliderId={block.sliderId} vendorSlug={vendorSlug} />
          </div>
        );

      case "imageText":
        return (
          <div className="relative w-full min-h-[400px] md:min-h-[500px] rounded-lg overflow-hidden">
            {/* Imagen de fondo */}
            {block.backgroundImage && (
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${block.backgroundImage})` }}
              >
                <div className="absolute inset-0 bg-black/40"></div>
              </div>
            )}
            
            {/* Contenido centrado */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-[400px] md:min-h-[500px] px-4 py-12 text-center">
              {block.title && (
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
                  {block.title}
                </h2>
              )}
              {block.text && (
                <p className="text-lg md:text-xl text-white mb-8 max-w-2xl drop-shadow-md">
                  {block.text}
                </p>
              )}
              {block.buttonText && block.buttonLink && (
                <a
                  href={block.buttonLink}
                  className="inline-block px-8 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
                >
                  {block.buttonText}
                </a>
              )}
            </div>
          </div>
        );

      case "carousel":
        return (
          <div className="carousel-block">
            <ProductCarousel config={block} vendorSlug={vendorSlug} vendorId={vendorId} settings={settings} />
          </div>
        );

      case "imageCarousel":
        return <ImageCarousel config={block} />;

      case "component":
        // Renderizar componentes predefinidos
        const componentName = block.componentName || "goldmine-scale";
        console.log("🧩 Rendering component:", componentName, "Block data:", block);
        
        switch (componentName) {
          case "goldmine-scale":
            return <GoldmineScale />;
          case "how-to-buy":
            return <HowToBuy />;
          case "sell-with-us":
            return <SellWithUs />;
          case "sell-with-us-hero":
            return <SellWithUsHero />;
          case "marketplace-presentation":
            return <MarketplacePresentation configJson={block.text} />;
          case "store-benefits":
            return <StoreBenefits items={block.benefitsConfig?.items} />;
          default:
            return (
              <div className="text-center text-gray-500 p-4 border border-dashed border-gray-300 rounded">
                Componente no encontrado: {componentName}
              </div>
            );
        }

      default:
        return (
          <div className="text-center text-gray-500 p-4 border border-dashed border-gray-300 rounded">
            Tipo de bloque desconocido: {block.type}
          </div>
        );
    }
  };

  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getVimeoVideoId = (url: string) => {
    // Soporta URLs como: 
    // https://vimeo.com/1066783194
    // https://vimeo.com/1066783194/deff279e49 (con hash de privacidad)
    const regExp = /vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/;
    const match = url.match(regExp);
    if (match) {
      // Si hay hash de privacidad, incluirlo
      return match[2] ? `${match[1]}?h=${match[2]}` : match[1];
    }
    return null;
  };

  const getGridClass = (columns: number) => {
    const gridClassMap: Record<number, string> = {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
    };
    return gridClassMap[columns] || gridClassMap[4];
  };

  const organizedRows = organizeBlocksIntoRows();

  if (!blocks.length) {
    return (
      <div className="text-center text-gray-500 py-12">
        Esta página no tiene contenido aún.
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1300px] mx-auto px-4">
      <div className="space-y-8">
        {organizedRows.map((row) => {
          const visibleBlocks = row.blocks.filter((block) => !(
            block.type === 'slides'
            && isHomepage
            && settings?.slides?.some((carousel: any) => carousel.showInHomepage === true)
          ));

          if (visibleBlocks.length === 0) return null;

          // Carrusel de imágenes: full-width sin Card ni padding, fuera del grid
          const imageCarouselBlock = visibleBlocks.find((b: any) => b.type === 'imageCarousel');
          if (imageCarouselBlock) {
            return (
              <div key={row.index} className="row-container" style={{ marginLeft: 'calc(-50vw + 50%)', width: '100vw' }}>
                {renderBlock(imageCarouselBlock)}
              </div>
            );
          }

          return (
          <div key={row.index} className="row-container">
            <div className={`grid gap-4 ${getGridClass(row.columns)}`}>
              {Array.from({ length: row.columns }, (_, colIndex) => {
                const block = visibleBlocks.find(b => (b.column - 1) === colIndex);
                const renderWithoutCard = block && (
                  (block.type === 'component' && block.componentName === 'store-benefits')
                  || (block.type === 'image' && Boolean(block.title))
                );
                return (
                  <div key={colIndex} className="col-item">
                    {block ? (
                      renderWithoutCard ? renderBlock(block) : (
                        <Card className="h-full" style={{ backgroundColor: 'var(--color-bg-page)' }}>
                        <CardContent className="p-4">
                          {renderBlock(block)}
                        </CardContent>
                        </Card>
                      )
                    ) : (
                      <div className="h-16 bg-gray-50 rounded border border-dashed border-gray-200"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default PageRenderer;
