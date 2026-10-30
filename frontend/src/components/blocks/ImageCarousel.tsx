"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { getImageUrl } from "@/lib/utils";

interface CarouselImage {
  url: string;
  link?: string;
  target?: "_self" | "_blank";
  alt?: string;
}

interface ImageCarouselProps {
  config: any;
}

const SPEED_PX: Record<string, number> = {
  fast: 1.5,
  normal: 0.7,
  slow: 0.35,
};

export default function ImageCarousel({ config }: ImageCarouselProps) {
  const cfg = config.imageCarouselConfig || {};
  const images: CarouselImage[] = cfg.images || [];
  const imageHeight: number = cfg.imageHeight || 400;
  const scrollSpeed: string = cfg.scrollSpeed || "normal";

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const halfWidthRef = useRef(0);
  const [imgsLoaded, setImgsLoaded] = useState(false);

  // Duplicar imágenes para loop seamless
  const trackImages: CarouselImage[] = images.length < 5
    ? [...images, ...images, ...images, ...images]
    : [...images, ...images];

  const pxPerFrame = SPEED_PX[scrollSpeed] ?? 0.7;

  const animate = useCallback(() => {
    const el = containerRef.current;
    if (!pausedRef.current && el) {
      scrollPos.current += pxPerFrame;
      const half = halfWidthRef.current;
      if (half > 0 && scrollPos.current >= half) {
        scrollPos.current -= half;
      }
      el.scrollLeft = scrollPos.current;
    }
    rafRef.current = requestAnimationFrame(animate);
  }, [pxPerFrame]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!imgsLoaded) return;
    const el = containerRef.current;
    if (!el) return;
    halfWidthRef.current = el.scrollWidth / 2;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, [imgsLoaded, animate]);

  const handleImgLoad = useCallback(() => {
    setImgsLoaded(true);
  }, []);

  const scrollByOne = (dir: "prev" | "next") => {
    const el = containerRef.current;
    if (!el) return;
    const imgWidth = el.scrollWidth / trackImages.length;
    const delta = dir === "next" ? imgWidth : -imgWidth;
    scrollPos.current = Math.max(0, scrollPos.current + delta);
    const half = halfWidthRef.current;
    if (half > 0 && scrollPos.current >= half) scrollPos.current -= half;
    el.scrollLeft = scrollPos.current;
  };

  if (!images.length) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 text-gray-400 text-sm"
        style={{ height: imageHeight }}
      >
        Sin imágenes configuradas
      </div>
    );
  }

  return (
    <div
      className="relative select-none"
      style={{ height: imageHeight, backgroundColor: "#000" }}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Track scrollable sin scrollbar visible */}
      <div
        ref={containerRef}
        className="flex h-full overflow-hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {trackImages.map((img, idx) => {
          const imgSrc = getImageUrl(img.url);
          const imgEl = (
            <img
              src={imgSrc}
              alt={img.alt || ""}
              className="h-full w-auto object-cover block flex-shrink-0"
              loading={idx < 6 ? "eager" : "lazy"}
              draggable={false}
              onLoad={idx === 0 ? handleImgLoad : undefined}
            />
          );

          return img.link ? (
            <Link
              key={idx}
              href={img.link}
              target={img.target || "_self"}
              rel={(img.target || "_self") === "_blank" ? "noopener noreferrer" : undefined}
              className="flex-shrink-0 block h-full hover:opacity-80 transition-opacity"
            >
              {imgEl}
            </Link>
          ) : (
            <div key={idx} className="flex-shrink-0 h-full">
              {imgEl}
            </div>
          );
        })}
      </div>

      {/* Flecha izquierda */}
      <button
        onClick={() => scrollByOne("prev")}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
        aria-label="Anterior"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Flecha derecha */}
      <button
        onClick={() => scrollByOne("next")}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
        aria-label="Siguiente"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
