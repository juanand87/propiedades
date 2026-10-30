"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { getProductUrl } from "@/lib/useCustomDomain";
import { formatPrice } from "@/lib/format";

interface ProductCarouselProps {
  config: any;
  vendorSlug: string;
  vendorId?: string;
  settings?: any;
}

// ms entre cada avance automatico
const SPEED_DELAY: Record<string, number> = {
  fast: 2000,
  normal: 4000,
  slow: 7000,
};

function formatLabel(format: string | undefined) {
  if (!format) return null;
  return format.split(/[,(/]/)[0].trim();
}

export default function ProductCarousel({ config, vendorSlug, vendorId }: ProductCarouselProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addItem } = useCart();

  const cfg = config.carouselConfig || {};
  const limit = cfg.limit || 12;
  const visibleItems = Math.max(2, Math.min(6, cfg.visibleItems || 4));
  const showArrows = cfg.showArrows !== false;
  const showDots = cfg.showDots !== false;
  const showTitle = cfg.showTitle !== false;
  const scrollSpeed = cfg.scrollSpeed || "normal";
  const delay = SPEED_DELAY[scrollSpeed] ?? 4000;

  // Numero maximo de posiciones
  const maxIndex = Math.max(0, products.length - visibleItems);

  // ─── Carga de productos ───────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params: any = { limit };
        if (vendorId) { params.vendorId = vendorId; }
        else { params.marketplaceOnly = true; }

        switch (cfg.displayMode) {
          case "by-category": if (cfg.categoryId) params.categoryId = cfg.categoryId; break;
          case "by-genre":    if (cfg.genre)      params.genre      = cfg.genre;      break;
          case "on-sale":     params.isOnSale = true;          break;
          case "best-sellers":params.sortBy   = "most-sold";   break;
          case "featured":    params.featured  = true;          break;
        }
        const res = await api.getProducts(params);
        setProducts(res?.products || []);
        setCurrent(0);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [cfg.displayMode, cfg.categoryId, cfg.genre, limit, vendorId]);

  // ─── Auto-avance ─────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev >= maxIndex ? 0 : prev + 1));
    }, delay);
  }, [delay, maxIndex]);

  useEffect(() => {
    if (products.length > visibleItems) startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [products.length, visibleItems, startTimer]);

  // ─── Navegacion manual (reset timer) ─────────────────────────────────────
  const goTo = (index: number) => {
    setCurrent(index);
    startTimer(); // reinicia el timer al navegar manualmente
  };
  const prev = () => goTo(Math.max(0, current - 1));
  const next = () => goTo(Math.min(maxIndex, current + 1));

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    try { return JSON.parse(images); } catch { return [images]; }
  };

  const getTitle = () => {
    if (!showTitle) return null;
    if (cfg.title) return cfg.title;
    const map: Record<string, string> = {
      latest: "Novedades", "best-sellers": "Mas vendidos",
      featured: "Destacados", "on-sale": "En oferta",
      "by-category": "Productos", "by-genre": cfg.genre || "Genero",
    };
    return map[cfg.displayMode] || "Productos";
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {getTitle() && <h2 className="text-xl font-bold">{getTitle()}</h2>}
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: visibleItems }).map((_, i) => (
            <div key={i} className="flex-shrink-0 bg-gray-200 rounded-lg animate-pulse"
              style={{ width: `calc(100% / ${visibleItems} - 10px)`, height: 240 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!products.length) return null;

  // Offset en % por paso: cada paso mueve 1/visibleItems del 100% del track visible
  // El track contiene TODOS los productos, cada uno ocupa (100%/visibleItems) del contenedor
  const translatePct = current * (100 / visibleItems);

  return (
    <div
      className="space-y-3"
      // Pausa el auto-avance mientras el usuario interactua con el carrusel
      onMouseEnter={() => { if (timerRef.current) clearInterval(timerRef.current); }}
      onMouseLeave={() => { if (products.length > visibleItems) startTimer(); }}
    >
      {/* Header: titulo + flechas */}
      <div className="flex items-center justify-between">
        {getTitle()
          ? <h2 className="text-xl font-bold text-gray-900">{getTitle()}</h2>
          : <span />
        }
        {showArrows && products.length > visibleItems && (
          <div className="flex gap-2">
            <button onClick={prev} disabled={current === 0}
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={next} disabled={current >= maxIndex}
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-30 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Viewport del carrusel */}
      <div
        className="overflow-hidden"
        style={{ ['--vi' as any]: visibleItems }}
      >
        {/* Track deslizable */}
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{
            gap: '12px',
            transform: `translateX(calc(-${translatePct}% - ${current * 12}px))`,
          }}
        >
          {products.map((product: any, idx: number) => {
            const firstImage = getProductImageByIndex(product, 0, 'thumb');
            const imgUrl = firstImage ? getImageUrl(firstImage) : null;
            const price = Number(product.price);
            const salePrice = product.salePrice ? Number(product.salePrice) : null;
            const productUrl = getProductUrl(product, vendorSlug);
            const fmt = formatLabel(product.format);

            return (
              <div
                key={product.id}
                className="flex-shrink-0 bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col"
                style={{
                  width: `calc(100% / ${visibleItems} - ${12 * (visibleItems - 1) / visibleItems}px)`,
                  minWidth: `calc(100% / ${visibleItems} - ${12 * (visibleItems - 1) / visibleItems}px)`,
                }}
              >
                <Link href={productUrl} className="block group">
                  <div className="relative overflow-hidden bg-gray-100" style={{ aspectRatio: "1" }}>
                    {imgUrl ? (
                      <img src={imgUrl} alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-purple-100 to-blue-100">🎵</div>
                    )}

                    {salePrice && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full z-10">Oferta</span>
                    )}
                    {fmt && (
                      <span className="absolute bottom-2 left-2 bg-white/90 text-gray-700 text-xs font-semibold px-1.5 py-0.5 rounded shadow-sm z-10 flex items-center gap-1">
                        💿 {fmt}
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="text-xs text-gray-500 truncate">{product.artist}</p>
                    <p className="text-sm font-semibold text-gray-900 truncate leading-tight mt-0.5">{product.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {salePrice ? (
                        <>
                          <span className="text-sm font-bold" style={{ color: "var(--color-primary, #9333ea)" }}>{formatPrice(salePrice)}</span>
                          <span className="text-xs text-gray-400 line-through">{formatPrice(price)}</span>
                        </>
                      ) : (
                        <span className="text-sm font-bold" style={{ color: "var(--color-primary, #9333ea)" }}>{formatPrice(price)}</span>
                      )}
                    </div>
                  </div>
                </Link>

                <div className="px-3 pb-3 mt-auto">
                  <button
                    onClick={() => addItem({
                      productId: product.id, title: product.title, artist: product.artist,
                      price: salePrice ?? price, imageUrl: imgUrl || undefined,
                      stock: product.stock || 1,
                      vendorId: product.vendor?.id || product.vendorId || "",
                      vendorSlug: product.vendor?.slug || product.vendorSlug || vendorSlug,
                    })}
                    disabled={!product.stock || product.stock <= 0}
                    className="w-full py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    style={{ borderColor: "var(--color-primary, #9333ea)", color: "var(--color-primary, #9333ea)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-primary, #9333ea)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "var(--color-primary, #9333ea)"; }}
                  >
                    <ShoppingCart className="w-3 h-3" />
                    {!product.stock || product.stock <= 0 ? "Sin stock" : "Agregar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dots */}
      {showDots && products.length > visibleItems && (
        <div className="flex justify-center gap-1.5 pt-1">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === current ? "w-5 bg-purple-600" : "w-2 bg-gray-300 hover:bg-gray-400"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
