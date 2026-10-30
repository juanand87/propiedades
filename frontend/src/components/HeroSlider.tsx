"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, ShoppingCart, X } from "lucide-react";
import { api } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";

interface SlideItem {
  id: number;
  mediaType: "image" | "video" | "gradient";
  imageUrl?: string;
  videoUrl?: string;
  gradient?: string;
  title?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonLinkType?: "external" | "product" | "category";
  buttonProductId?: string;
  buttonCategoryId?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  imageOpacity?: number;
  titleShadow?: boolean;
}

interface OverlayCard {
  id: number;
  type: "product" | "custom"; // Tipo de card
  // Para productos
  productId?: string;
  productName?: string;
  productImage?: string;
  productPrice?: number;
  productSlug?: string;
  // Para custom (legacy)
  icon?: string;
  title?: string;
  description?: string;
  linkType?: "external" | "internal" | "category";
  linkUrl?: string;
  bgColor?: string;
  iconBgColor?: string;
}

interface HeroSliderConfig {
  enabled: boolean;
  sliderId?: number | string;
  autoplay: boolean;
  interval: number; // segundos
  showArrows: boolean;
  showDots: boolean;
  height: number; // px
  scrollEffect?: "normal" | "fixed-overlay" | "fixed-zoom";
  overlayCards: {
    enabled: boolean;
    items: OverlayCard[];
  };
}

interface Slider {
  id: number | string;
  name: string;
  showInHomepage: boolean;
  items: SlideItem[];
}

interface HeroSliderProps {
  config: HeroSliderConfig;
  slides: Slider[];
  vendorSlug?: string;
}

export default function HeroSlider({ config, slides, vendorSlug = "marketplace" }: HeroSliderProps) {
  const { addItem } = useCart();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [cardsPage, setCardsPage] = useState(0); // Página actual de las cards
  const [isMobile, setIsMobile] = useState(false); // Detectar si es mobile
  const [hydratedProducts, setHydratedProducts] = useState<Record<string, any>>({});
  const [failedProductIds, setFailedProductIds] = useState<Record<string, true>>({});
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const sliderRootRef = useRef<HTMLDivElement>(null);
  const [scrollZoom, setScrollZoom] = useState(1);

  const getThemedButtonBackground = (color?: string) => {
    const normalized = String(color || '').toLowerCase();
    if (!normalized || normalized === '#8b5cf6') {
      return 'linear-gradient(135deg, var(--color-primary, #9333ea) 0%, var(--color-secondary, #2563eb) 100%)';
    }
    return color;
  };

  // Detectar tamaño de pantalla
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Ejecutar al montar
    checkMobile();
    
    // Escuchar cambios de tamaño
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Encontrar el slider configurado o el primero que tenga showInHomepage
  const activeSlider = config.sliderId 
    ? slides.find(s => String(s.id) === String(config.sliderId))
    : slides.find(s => s.showInHomepage) || slides[0];

  const slideItems = activeSlider?.items || [];
  const overlayCards = config.overlayCards?.items || [];
  const productCardIds = overlayCards
    .filter((card) => card.type === "product" && card.productId)
    .map((card) => card.productId as string);
  const productCardKey = productCardIds.join("|");
  const visibleOverlayCards = overlayCards.filter((card) => {
    if (card.type !== "product" || !card.productId) return true;
    const product = hydratedProducts[card.productId];
    if (product && (product.status !== "active" || Number(product.stock || 0) <= 0)) return false;
    return !failedProductIds[card.productId];
  });
  const sliderHeight = config.height || 400;

  useEffect(() => {
    if (config.scrollEffect !== "fixed-zoom") {
      return;
    }

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    let frameId: number | null = null;

    const updateZoom = () => {
      frameId = null;
      if (!desktopQuery.matches || !sliderRootRef.current) {
        setScrollZoom(1);
        return;
      }

      const scene = sliderRootRef.current.closest(".store-carousel-scroll-scene") as HTMLElement | null;
      if (!scene) return;
      const sceneTop = scene.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(1, sliderHeight * 0.55);
      const progress = Math.min(1, Math.max(0, (window.scrollY - sceneTop) / distance));
      setScrollZoom(1 + progress * 0.09);
    };

    const requestUpdate = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(updateZoom);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    desktopQuery.addEventListener("change", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      desktopQuery.removeEventListener("change", requestUpdate);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [config.scrollEffect, sliderHeight]);

  const goToNext = useCallback(() => {
    if (slideItems.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % slideItems.length);
  }, [slideItems.length]);

  const goToPrev = useCallback(() => {
    if (slideItems.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + slideItems.length) % slideItems.length);
  }, [slideItems.length]);

  // Autoplay
  useEffect(() => {
    if (!config.autoplay || isHovered || slideItems.length <= 1) return;

    const timer = setInterval(() => {
      goToNext();
    }, (config.interval || 5) * 1000);

    return () => clearInterval(timer);
  }, [config.autoplay, config.interval, isHovered, goToNext, slideItems.length]);

  useEffect(() => {
    const missingProductIds = productCardIds.filter((id) => !hydratedProducts[id] && !failedProductIds[id]);

    if (missingProductIds.length === 0) return;

    let cancelled = false;

    const loadProducts = async () => {
      const loadedProducts = await Promise.all(
        missingProductIds.map(async (productId) => {
          try {
            return [productId, await api.getProduct(productId)] as const;
          } catch {
            return [productId, null] as const;
          }
        })
      );

      if (cancelled) return;

      setHydratedProducts((current) => {
        const next = { ...current };
        loadedProducts.forEach(([productId, product]) => {
          if (product && product.status === "active" && Number(product.stock || 0) > 0) {
            next[productId] = product;
          }
        });
        return next;
      });
      setFailedProductIds((current) => {
        const next = { ...current };
        let hasNewFailure = false;

        loadedProducts.forEach(([productId, product]) => {
          if ((!product || product.status !== "active" || Number(product.stock || 0) <= 0) && !next[productId]) {
            next[productId] = true;
            hasNewFailure = true;
          }
        });

        return hasNewFailure ? next : current;
      });
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [productCardKey, hydratedProducts, failedProductIds]);

  if (!config.enabled || !activeSlider || slideItems.length === 0) {
    return null;
  }

  const currentSlide = slideItems[currentIndex];
  const effectiveScrollZoom = config.scrollEffect === "fixed-zoom" ? scrollZoom : 1;
  const showOverlayCards = config.overlayCards?.enabled && visibleOverlayCards.length > 0;
  const colsPerRow = (config.overlayCards as any)?.columnsPerRow || 4;

  // Las cards superpuestas agregan altura extra, necesitamos padding inferior
  const containerStyle = showOverlayCards 
    ? { paddingBottom: "60px" } // Espacio para las cards que se superponen
    : {};

  const getButtonLink = (slide: SlideItem): string => {
    if (slide.buttonLinkType === "product" && slide.buttonProductId) {
      return vendorSlug === "marketplace" 
        ? `/productos/${slide.buttonProductId}`
        : `/tiendas/${vendorSlug}/productos/${slide.buttonProductId}`;
    }
    if (slide.buttonLinkType === "category" && slide.buttonCategoryId) {
      return vendorSlug === "marketplace"
        ? `/categoria/${slide.buttonCategoryId}`
        : `/tiendas/${vendorSlug}/categoria/${slide.buttonCategoryId}`;
    }
    return slide.buttonLink || "#";
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getProductUrl = (productId: string) => {
    return vendorSlug === "marketplace"
      ? `/productos/${productId}`
      : `/tiendas/${vendorSlug}/productos/${productId}`;
  };

  const getCardProduct = (card: OverlayCard) => {
    const hydratedProduct = card.productId ? hydratedProducts[card.productId] : null;
    return hydratedProduct || {
      id: card.productId,
      title: card.productName,
      price: card.productPrice,
      images: card.productImage ? [card.productImage] : [],
      slug: card.productSlug,
      stock: 1,
    };
  };

  const getProductImage = (product: any, card?: OverlayCard) => {
    const productImage =
      getProductImageByIndex(product, 0, "thumb") ||
      getProductImageByIndex(product, 0, "large") ||
      card?.productImage;

    return productImage ? getImageUrl(productImage) : "";
  };

  const handleAddToCart = (product: any, card?: OverlayCard) => {
    const productId = product?.id || card?.productId;
    if (!productId) return;

    addItem({
      productId,
      title: product?.title || card?.productName || "Producto",
      artist: product?.artist,
      price: Number(product?.salePrice || product?.price || card?.productPrice || 0),
      imageUrl: getProductImage(product, card) || undefined,
      stock: product?.stock || 1,
      vendorId: product?.vendor?.id || product?.vendorId || "",
      vendorSlug: product?.vendor?.slug || product?.vendorSlug || vendorSlug,
    });
  };

  return (
    <div ref={sliderRootRef} className="relative" style={containerStyle}>
      {/* Slider Container */}
      <div 
        className="relative overflow-hidden"
        style={{ height: window.innerWidth < 768 ? '280px' : `${sliderHeight}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Slides */}
        <div 
          className="flex transition-transform duration-500 ease-out h-full"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {slideItems.map((slide, index) => (
            <div 
              key={slide.id || index}
              className="w-full h-full flex-shrink-0 relative"
            >
              {/* Background */}
              {slide.mediaType === "video" && slide.videoUrl ? (
                <video
                  src={slide.videoUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ transform: `scale(${effectiveScrollZoom})`, transition: "transform 80ms linear", willChange: "transform" }}
                />
              ) : slide.mediaType === "image" && slide.imageUrl ? (
                <div
                  className="absolute inset-0 w-full h-full"
                  style={{
                    backgroundImage: `url(${slide.imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    transform: `scale(${effectiveScrollZoom})`,
                    transition: "transform 80ms linear",
                    willChange: "transform",
                  }}
                />
              ) : (
                <div
                  className="absolute inset-0 w-full h-full"
                  style={{
                    background: slide.gradient || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  }}
                />
              )}

              {/* Overlay gradient para texto */}
              {(slide.title || slide.description) && (
                <div 
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(to right, rgba(0,0,0,${slide.imageOpacity || 0.4}) 0%, transparent 60%)`,
                  }}
                />
              )}

              {/* Content */}
              {(slide.title || slide.description || slide.buttonText) && (
                <div className="absolute inset-0 flex items-center">
                  <div className="mx-auto max-w-[1300px] px-4 md:px-8">
                    <div className="max-w-xl">
                      {slide.title && (
                        <h2 
                          className={`text-3xl md:text-5xl font-bold text-white mb-4 ${
                            slide.titleShadow ? "drop-shadow-lg" : ""
                          }`}
                        >
                          {slide.title}
                        </h2>
                      )}
                      {slide.description && (
                        <p className="text-lg md:text-xl text-white/90 mb-6 drop-shadow">
                          {slide.description}
                        </p>
                      )}
                      {slide.buttonText && (
                        <Link href={getButtonLink(slide)}>
                          <button
                            className="px-6 py-3 rounded-lg font-medium transition-all hover:scale-105 hover:shadow-lg"
                            style={{
                              background: getThemedButtonBackground(slide.buttonBgColor),
                              color: slide.buttonTextColor || "#ffffff",
                            }}
                          >
                            {slide.buttonText}
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        {config.showArrows && slideItems.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
              style={{ opacity: isHovered ? 1 : 0.7 }}
            >
              <ChevronLeft className="w-6 h-6 text-gray-800" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
              style={{ opacity: isHovered ? 1 : 0.7 }}
            >
              <ChevronRight className="w-6 h-6 text-gray-800" />
            </button>
          </>
        )}

        {/* Dots */}
        {config.showDots && slideItems.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slideItems.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentIndex 
                    ? "bg-white scale-110" 
                    : "bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}

        {/* Gradient inferior para fusionar con las cards */}
        {showOverlayCards && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
            style={{
              background: "linear-gradient(to top, rgba(249,250,251,1) 0%, transparent 100%)",
            }}
          />
        )}
      </div>

      {/* Overlay Cards (estilo MercadoLibre) */}
      {showOverlayCards && (
        <div className="relative z-10 mx-auto max-w-[1300px] px-4">
          {/* Navegación de cards - SOLO DESKTOP */}
          {visibleOverlayCards.length > colsPerRow && (
            <>
              <button
                onClick={() => setCardsPage(Math.max(0, cardsPage - 1))}
                disabled={cardsPage === 0}
                className={`hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white shadow-lg rounded-full items-center justify-center transition-all ${
                  cardsPage === 0 
                    ? "opacity-30 cursor-not-allowed" 
                    : "hover:bg-gray-50 hover:scale-110"
                }`}
                style={{ marginTop: "-40px" }}
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={() => setCardsPage(Math.min(Math.ceil(visibleOverlayCards.length / colsPerRow) - 1, cardsPage + 1))}
                disabled={cardsPage >= Math.ceil(visibleOverlayCards.length / colsPerRow) - 1}
                className={`hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white shadow-lg rounded-full items-center justify-center transition-all ${
                  cardsPage >= Math.ceil(visibleOverlayCards.length / colsPerRow) - 1
                    ? "opacity-30 cursor-not-allowed" 
                    : "hover:bg-gray-50 hover:scale-110"
                }`}
                style={{ marginTop: "-40px" }}
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
            </>
          )}
          
          {/* Cards visibles - DESKTOP: Grid 4 columnas | MOBILE: Scroll horizontal */}
          <div 
            className="md:grid md:gap-4 md:transition-all md:duration-300 flex md:flex-none gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
            style={{
              gridTemplateColumns: `repeat(${Math.min(visibleOverlayCards.length, colsPerRow)}, 1fr)`,
              marginTop: window.innerWidth < 768 ? "-60px" : "-80px", // Superponer sobre el slider
            }}
          >
            {/* En desktop: slice con paginación | En mobile: todos los productos */}
            {(isMobile ? visibleOverlayCards : visibleOverlayCards.slice(cardsPage * colsPerRow, cardsPage * colsPerRow + colsPerRow)).map((card) => {
              // Determinar el link según el tipo de card
              const cardLink = card.type === "product" && card.productId
                ? getProductUrl(card.productId)
                : (card.linkUrl || "#");

              // Formatear precio
              const formatPrice = (price: number) => {
                return new Intl.NumberFormat("es-CL", {
                  style: "currency",
                  currency: "CLP",
                  minimumFractionDigits: 0,
                }).format(price);
              };
              const product = card.type === "product" ? getCardProduct(card) : null;
              const productImage = product ? getProductImage(product, card) : "";
              const productPrice = Number(product?.salePrice || product?.price || card.productPrice || 0);
              const productStock = Number(product?.stock ?? 1);

              return (
                <Link 
                  key={card.id} 
                  href={cardLink}
                  className="group snap-start flex-shrink-0 w-[90px] md:w-auto md:flex-shrink"
                >
                  {card.type === "product" ? (
                    // Card de Producto
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-100 h-full">
                      {/* Imagen del producto */}
                      <div className="aspect-square relative overflow-hidden bg-gray-100">
                        {productImage ? (
                          <img 
                            src={productImage} 
                            alt={product?.title || card.productName || "Producto"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            📦
                          </div>
                        )}
                        <div className="hidden md:flex absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 gap-1">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPreviewProduct(product);
                            }}
                            className="bg-gray-800/95 hover:bg-gray-900 text-white font-semibold py-3 px-4 transition-colors backdrop-blur-sm flex items-center justify-center"
                            title="Vista rapida"
                          >
                            <Eye className="w-4 h-4 flex-shrink-0" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!productStock || productStock <= 0) return;
                              handleAddToCart(product, card);
                            }}
                            aria-disabled={!productStock || productStock <= 0}
                            className="flex-1 hover:opacity-90 text-white font-semibold py-3 transition-all aria-disabled:bg-gray-400 aria-disabled:cursor-not-allowed backdrop-blur-sm flex items-center justify-center gap-2"
                            style={{ background: !productStock || productStock <= 0 ? undefined : "linear-gradient(135deg, var(--color-primary, #9333ea) 0%, var(--color-secondary, #2563eb) 100%)" }}
                          >
                            <ShoppingCart className="w-4 h-4" />
                            <span>Agregar</span>
                          </button>
                        </div>
                      </div>
                      <div className="hidden sm:flex md:hidden gap-1 p-1.5">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewProduct(product);
                          }}
                          className="flex-1 text-white font-medium py-2 text-sm rounded transition-all flex items-center justify-center gap-1"
                          style={{ background: "linear-gradient(135deg, var(--color-secondary, #2563eb) 0%, var(--color-primary, #9333ea) 100%)" }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Vista</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!productStock || productStock <= 0) return;
                            handleAddToCart(product, card);
                          }}
                          aria-disabled={!productStock || productStock <= 0}
                          className="flex-1 text-white font-medium py-2 text-sm rounded transition-all aria-disabled:bg-gray-400 aria-disabled:cursor-not-allowed flex items-center justify-center gap-1"
                          style={{ background: !productStock || productStock <= 0 ? undefined : "linear-gradient(135deg, var(--color-primary, #9333ea) 0%, var(--color-secondary, #2563eb) 100%)" }}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>+</span>
                        </button>
                      </div>
                      {/* Info del producto */}
                      <div className="p-2 md:p-3">
                        <h3 className="font-medium text-gray-900 text-xs md:text-sm line-clamp-2 group-hover:text-purple-600 transition-colors">
                          {product?.title || card.productName || "Producto"}
                        </h3>
                        {productPrice > 0 && (
                          <p className="text-sm md:text-lg font-bold text-gray-900 mt-1">
                            {formatPrice(productPrice)}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Card Custom (legacy con iconos)
                    <div 
                      className="bg-white rounded-xl shadow-lg p-5 hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-100"
                      style={{ backgroundColor: card.bgColor || "#ffffff" }}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ backgroundColor: card.iconBgColor || "#f3e8ff" }}
                        >
                          {card.icon || "📦"}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                            {card.title}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
          
          {/* Indicadores de página de cards - SOLO DESKTOP */}
          {overlayCards.length > 4 && (
            <div className="hidden md:flex justify-center gap-2 mt-4">
              {Array.from({ length: Math.ceil(overlayCards.length / 4) }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCardsPage(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === cardsPage 
                      ? "bg-purple-600 w-6" 
                      : "bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {previewProduct && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">Vista Previa</h2>
              <button
                onClick={() => setPreviewProduct(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                  {getProductImage(previewProduct) ? (
                    <img
                      src={getProductImage(previewProduct)}
                      alt={previewProduct.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      Producto
                    </div>
                  )}
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
                    <span className="text-4xl font-bold text-purple-600">
                      {formatPrice(Number(previewProduct.salePrice || previewProduct.price || 0))}
                    </span>
                    {Number(previewProduct.stock ?? 1) > 0 ? (
                      <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                        Stock disponible: {previewProduct.stock || 1}
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
                      href={getProductUrl(previewProduct)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                    >
                      Ver detalles completos
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleAddToCart(previewProduct);
                        setPreviewProduct(null);
                      }}
                      disabled={!Number(previewProduct.stock ?? 1)}
                      className="flex-1 hover:opacity-90 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{ background: !Number(previewProduct.stock ?? 1) ? undefined : "linear-gradient(135deg, var(--color-primary, #9333ea) 0%, var(--color-secondary, #2563eb) 100%)" }}
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
      )}
    </div>
  );
}
