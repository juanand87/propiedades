"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getImageUrl } from "@/lib/imageUtils";
import { isCustomDomain } from "@/lib/useCustomDomain";

interface Slide {
  id: number;
  name?: string;
  mediaType?: string;
  hasImage?: boolean;
  imageUrl?: string;
  videoUrl?: string;
  gradient?: string;
  title: string;
  description: string;
  buttonText: string;
  buttonLink: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  imageOpacity?: number;
  titleShadow?: boolean;
  transition?: string;
  showInHomepage?: boolean;
  order: number;
}

interface StoreCarouselProps {
  slides: Slide[];
  vendorSlug?: string;
}

export default function StoreCarousel({ slides, vendorSlug }: StoreCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Filtrar solo slides marcados para mostrar en homepage
  const homepageSlides = slides?.filter((slide: any) => slide.showInHomepage === true) || [];

  // Si no hay slides para homepage, no mostrar nada
  if (!homepageSlides || homepageSlides.length === 0) {
    return null;
  }

  // Ordenar slides por order
  const sortedSlides = [...homepageSlides].sort((a, b) => a.order - b.order);
  
  console.log("StoreCarousel - vendorSlug:", vendorSlug);
  console.log("StoreCarousel - slides:", sortedSlides);
  console.log("StoreCarousel - buttonLink:", sortedSlides[0]?.buttonLink);

  const goToSlide = (index: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const goToPrevious = () => {
    const newIndex = currentIndex === 0 ? sortedSlides.length - 1 : currentIndex - 1;
    goToSlide(newIndex);
  };

  const goToNext = () => {
    const newIndex = currentIndex === sortedSlides.length - 1 ? 0 : currentIndex + 1;
    goToSlide(newIndex);
  };

  // Auto-play
  useEffect(() => {
    if (sortedSlides.length <= 1) return;

    const interval = setInterval(() => {
      goToNext();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentIndex, sortedSlides.length]);

  const currentSlide = sortedSlides[currentIndex];

  // Determinar el tipo de media del slide
  const slideMediaType = currentSlide.mediaType || (currentSlide.hasImage && currentSlide.imageUrl ? "image" : "gradient");
  const transition = currentSlide.transition || "fade";

  // Debug: Log de URLs de imágenes
  console.log("🖼️ Current slide:", {
    hasImage: currentSlide.hasImage,
    imageUrl: currentSlide.imageUrl,
    mediaType: slideMediaType,
    gradient: currentSlide.gradient
  });
  
  if (currentSlide.imageUrl) {
    const processedUrl = getImageUrl(currentSlide.imageUrl);
    console.log("🖼️ Original imageUrl:", currentSlide.imageUrl);
    console.log("🖼️ Processed image URL:", processedUrl);
  }

  // Clases de transición según el efecto seleccionado
  const transitionClasses: Record<string, string> = {
    fade: "transition-opacity duration-700 ease-in-out",
    slide: "transition-transform duration-700 ease-in-out",
    zoom: "transition-all duration-700 ease-in-out",
    flip: "transition-all duration-700 ease-in-out"
  };

  const animationClasses: Record<string, string> = {
    fade: isAnimating ? "opacity-0" : "opacity-100",
    slide: isAnimating ? "translate-x-full" : "translate-x-0",
    zoom: isAnimating ? "scale-0" : "scale-100",
    flip: isAnimating ? "rotate-y-180" : "rotate-y-0"
  };

  return (
    <div className="relative w-full h-[400px] md:h-[500px] overflow-hidden">
      {/* Slide actual */}
      <div className={`absolute inset-0 ${transitionClasses[transition]} ${animationClasses[transition]}`}
           style={{ transformStyle: 'preserve-3d' }}>
        {/* Video de fondo */}
        {slideMediaType === "video" && currentSlide.videoUrl && (
          <video
            src={currentSlide.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        )}

        {/* Imagen o gradiente de fondo */}
        {slideMediaType !== "video" && (
          <>
            {slideMediaType === "image" && currentSlide.imageUrl && currentSlide.imageUrl.trim() !== '' ? (
              <img
                src={getImageUrl(currentSlide.imageUrl)}
                alt={currentSlide.title || "Slide"}
                className="absolute inset-0 w-full h-full object-cover"
                onLoad={() => {
                  console.log("✅ Image loaded successfully:", currentSlide.imageUrl);
                }}
                onError={(e) => {
                  console.error("❌ Error loading slide image:", currentSlide.imageUrl);
                  console.error("❌ Processed URL was:", getImageUrl(currentSlide.imageUrl));
                  console.error("❌ API URL:", process.env.NEXT_PUBLIC_API_URL);
                  // Mostrar gradiente de fallback
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                  }
                }}
              />
            ) : null}
            <div
              className={`absolute inset-0 ${slideMediaType === "image" && currentSlide.imageUrl && currentSlide.imageUrl.trim() !== '' ? 'hidden' : ''}`}
              style={{
                background: currentSlide.gradient || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            />
          </>
        )}

        {/* Overlay */}
        <div 
          className="absolute inset-0" 
          style={{
            backgroundColor: `rgba(0, 0, 0, ${currentSlide.imageOpacity ?? 0.3})`
          }}
        />

        {/* Contenido */}
        <div className="relative h-full flex flex-col items-center justify-center text-white px-6 text-center">
          {currentSlide.title && (
            <h2 
              className="text-3xl md:text-5xl font-bold mb-4 animate-fade-in"
              style={{
                textShadow: currentSlide.titleShadow !== false 
                  ? '2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)' 
                  : 'none'
              }}
            >
              {currentSlide.title}
            </h2>
          )}
          
          {currentSlide.description && (
            <p className="text-base md:text-xl mb-6 max-w-2xl animate-fade-in-delay drop-shadow-lg">
              {currentSlide.description}
            </p>
          )}
          
          {currentSlide.buttonText && currentSlide.buttonLink && (
            <Link
              href={
                // Si estamos en dominio personalizado y el link es interno, limpiarlo
                isCustomDomain() && currentSlide.buttonLink.includes('/tiendas/')
                  ? currentSlide.buttonLink.replace(/\/tiendas\/[^\/]+/, '')
                  : vendorSlug && currentSlide.buttonLink.startsWith('/products/')
                  ? currentSlide.buttonLink.replace('/products/', `/tiendas/${vendorSlug}/productos/`)
                  : vendorSlug && currentSlide.buttonLink.startsWith('/productos') && !isCustomDomain()
                  ? `/tiendas/${vendorSlug}${currentSlide.buttonLink}`
                  : currentSlide.buttonLink
              }
              className="px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 animate-fade-in-delay-2 shadow-lg"
              style={{
                backgroundColor: currentSlide.buttonBgColor || "#ffffff",
                color: currentSlide.buttonTextColor || "#1f2937",
              }}
            >
              {currentSlide.buttonText}
            </Link>
          )}
        </div>
      </div>

      {/* Controles de navegación - solo si hay más de 1 slide */}
      {sortedSlides.length > 1 && (
        <>
          {/* Flechas */}
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all"
            aria-label="Slide anterior"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all"
            aria-label="Siguiente slide"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Indicadores */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {sortedSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? "w-8 bg-white"
                    : "bg-white/50 hover:bg-white/75"
                }`}
                aria-label={`Ir al slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Animaciones CSS */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-fade-in-delay {
          animation: fadeIn 0.6s ease-out 0.2s both;
        }

        .animate-fade-in-delay-2 {
          animation: fadeIn 0.6s ease-out 0.4s both;
        }
      `}</style>
    </div>
  );
}
