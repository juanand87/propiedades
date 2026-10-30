"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useRadio } from "@/contexts/RadioContext";
import { useState, useEffect } from "react";

export default function FloatingCartButton() {
  const { getTotalItems, openCart } = useCart();
  const { isOpen: radioOpen } = useRadio();
  const itemCount = getTotalItems();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // No mostrar si no hay items
  if (itemCount === 0) return null;

  // Subir el botón cuando haya barras inferiores activas.
  const bottomOffset = isMobile && radioOpen
    ? "7rem"
    : "var(--floating-cart-bottom-offset, 1.5rem)";

  return (
    <button
      onClick={openCart}
      className="fixed left-6 z-50 theme-gradient-bg hover:opacity-90 text-white rounded-full p-4 shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 animate-bounce-gentle"
      aria-label={`Carrito de compras - ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}
      style={{
        bottom: bottomOffset,
        background: 'var(--color-primary, linear-gradient(135deg, #9333ea 0%, #2563eb 100%))'
      }}
    >
      <div className="relative">
        <ShoppingBag className="w-6 h-6" />
        <div 
          className="absolute -top-5 -right-5 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center animate-pulse shadow-lg border-2 border-white"
          style={{
            background: 'var(--color-secondary, #ef4444)'
          }}
        >
          {itemCount}
        </div>
      </div>
    </button>
  );
}
