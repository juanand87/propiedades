"use client";

import { useCart } from "@/contexts/CartContext";
import { X, ShoppingCart, Plus, Minus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getImageUrl } from "@/lib/utils";
import { getStoreUrl } from "@/lib/useCustomDomain";
import { useEffect, useState } from "react";
import { useParams } from 'next/navigation';

const safeNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const formatCLP = (value: unknown) => safeNumber(value, 0).toLocaleString('es-CL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const getCartLineTotal = (item: any) => safeNumber(item?.price, 0) * Math.max(0, Math.trunc(safeNumber(item?.quantity, 0)));


export default function CartDrawer() {
  const {
    items,
    removeItem,
    updateQuantity,
    getTotalItems,
    getTotalPrice,
    isOpen,
    closeCart,
  } = useCart();

  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [totalShippingCost, setTotalShippingCost] = useState<number | null>(null);
  const [validSubtotal, setValidSubtotal] = useState<number | null>(null);
  const [shippingCount, setShippingCount] = useState<number>(0);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [communeMap, setCommuneMap] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isOpen]);

  // Load commune map from API on component mount
  useEffect(() => {
    const loadCommuneMap = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/shipping/communes`);
        if (response.ok) {
          const communes = await response.json();
          // Create a map of commune name -> id
          const map: { [key: string]: number } = {};
          communes.forEach((commune: any) => {
            map[commune.name] = commune.id;
          });
          setCommuneMap(map);
        }
      } catch (error) {
        console.error('Error loading commune map:', error);
      }
    };
    
    loadCommuneMap();
  }, []);

  // Estado para forzar recálculo cuando cambia la ubicación
  const [locationKey, setLocationKey] = useState(0);

  // Listener para cambios en localStorage (cuando el usuario cambia la ubicación)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedComuna' || e.key === 'selectedRegion') {
        console.log('[CartDrawer] 📍 Ubicación cambiada:', { key: e.key, newValue: e.newValue });
        // Forzar recálculo incrementando el key
        setLocationKey(prev => prev + 1);
      }
    };

    // Listener personalizado para cambios del mismo tab
    const handleCustomLocationChange = () => {
      console.log('[CartDrawer] 📍 Ubicación cambiada desde header');
      setLocationKey(prev => prev + 1);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('locationChanged', handleCustomLocationChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('locationChanged', handleCustomLocationChange);
    };
  }, []);

  // Load shipping cost based on selected region - fetch from real shipping API
  useEffect(() => {
    const calculateRealShipping = async () => {
      const region = localStorage.getItem('selectedRegion');
      const communeName = localStorage.getItem('selectedComuna');
      
      setSelectedRegion(region);
      
      // Only calculate if we have items, a region, and commune map loaded
      if (!region || !communeName || items.length === 0 || Object.keys(communeMap).length === 0) {
        setTotalShippingCost(null);
        setValidSubtotal(null);
        setShippingCount(0);
        return;
      }

      console.log('[CartDrawer] 🔄 Calculando envío para:', { region, communeName });
      setShippingLoading(true);
      try {
        // Get commune ID from the map
        const communeId = communeMap[communeName];
        
        if (!communeId) {
          console.warn(`Commune "${communeName}" not found in map`);
          setTotalShippingCost(null);
          setShippingCount(0);
          setShippingLoading(false);
          return;
        }

        // Agrupar items por vendor (igual que en /cart) - filtrar vendorIds inválidos
        const grouped = items.reduce((acc, item) => {
          const vendorId = item.vendorId?.trim();
          if (!vendorId || vendorId === 'undefined' || vendorId === 'null') {
            console.warn('[CartDrawer] Item con vendorId inválido:', { vendorId: item.vendorId, title: item.title });
            return acc;
          }
          if (!acc[vendorId]) {
            acc[vendorId] = [];
          }
          acc[vendorId].push(item);
          return acc;
        }, {} as { [vendorId: string]: typeof items });

        const vendorCount = Object.keys(grouped).length;
        console.log('[CartDrawer] Vendor count:', vendorCount);
        console.log('[CartDrawer] Grouped vendors:', Object.keys(grouped));
        console.log('[CartDrawer] Items per vendor:', Object.entries(grouped).map(([vid, vitems]) => 
          ({ vendorId: vid, count: vitems.length, items: vitems.map(i => ({ title: i.title, price: i.price, qty: i.quantity })) })
        ));

        // Calcular subtotal de productos válidos (con vendorId válido)
        const validProductsSubtotal = Object.values(grouped)
          .flat()
          .reduce((sum, item) => sum + getCartLineTotal(item), 0);
        console.log('[CartDrawer] Valid products subtotal:', validProductsSubtotal);
        console.log('[CartDrawer] Total products in cart (including invalid):', getTotalPrice());
        setValidSubtotal(validProductsSubtotal);

        // Calcular envío para cada vendor
        const shippingCosts = await Promise.all(
          Object.entries(grouped).map(async ([vendorId, vendorItems]) => {
            const subtotal = vendorItems.reduce((sum, item) => sum + getCartLineTotal(item), 0);
            
            try {
              const products = vendorItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
              }));

              const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/shipping/calculate-with-products`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  vendorId,
                  communeId,
                  products,
                  declaredValue: subtotal,
                }),
              });

              if (response.ok) {
                const shippingOptions = await response.json();
                
                if (shippingOptions && shippingOptions.length > 0) {
                  const cheapestOption = shippingOptions.reduce((min: any, opt: any) => 
                    opt.price < min.price ? opt : min
                  , shippingOptions[0]);
                  return Math.round(cheapestOption.price);
                }
              }
            } catch (error) {
              console.error(`Error calculating shipping for vendor ${vendorId}:`, error);
            }
            
            return 0;
          })
        );

        // Sumar todos los costos de envío
        const totalCost = shippingCosts.reduce((sum, cost) => sum + cost, 0);
        console.log('[CartDrawer] Total shipping cost:', totalCost, 'from', vendorCount, 'vendors');
        setTotalShippingCost(totalCost);
        setShippingCount(vendorCount);
      } catch (error) {
        console.error('Error calculating shipping:', error);
        setTotalShippingCost(null);
        setShippingCount(0);
      } finally {
        setShippingLoading(false);
      }
    };

    calculateRealShipping();
  }, [isOpen, items, communeMap, locationKey]); // Agregar locationKey como dependencia
  
  // Obtener el slug de la URL actual (si estamos en /tiendas/[slug])
  const params = useParams();
  const currentPageSlug = params?.slug as string | undefined;
  
  // Determinar la URL del carrito (nueva página estilo MercadoLibre)
  // Siempre redirigir a /cart para la vista previa antes del checkout
  const getCartUrl = () => {
    return '/cart';
  };

  if (!shouldRender) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeCart}
      />

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          isAnimating ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b theme-gradient-bg text-white">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            <h2 className="text-lg font-bold">
              Carrito ({getTotalItems()})
            </h2>
          </div>
          <button
            onClick={closeCart}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p className="text-lg">Tu carrito está vacío</p>
              <button
                onClick={closeCart}
                className="mt-4 theme-text hover:underline font-medium"
              >
                Seguir comprando
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const hasInvalidVendorId = !item.vendorId || item.vendorId === 'undefined' || item.vendorId === 'null';
                return (
                <div
                  key={item.productId}
                  className={`flex gap-3 p-3 rounded-lg border ${hasInvalidVendorId ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}
                >
                  {/* Imagen */}
                  <div className="w-20 h-20 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden">
                    {item.imageUrl ? (
                      <img
                        src={getImageUrl(item.imageUrl)}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        🎵
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {hasInvalidVendorId && (
                      <span className="text-xs text-red-600 font-semibold">⚠️ Error - Producto sin tienda</span>
                    )}
                    <h3 className="font-semibold text-sm text-gray-800 truncate">
                      {item.title}
                    </h3>
                    {item.artist && (
                      <p className="text-xs text-gray-600 truncate">
                        {item.artist}
                      </p>
                    )}
                    <p className="text-sm font-bold theme-text mt-1">
                      ${formatCLP(item.price)}
                    </p>

                    {/* Controles de cantidad */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded transition-colors disabled:opacity-50"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-semibold w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded transition-colors disabled:opacity-50"
                        disabled={item.quantity >= item.stock}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="ml-auto p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t p-4 bg-gray-50">
            {/* Shipping */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-600">
                  Envío {shippingCount > 0 && `(${shippingCount} ${shippingCount === 1 ? 'tienda' : 'tiendas'})`}
                </span>
              </div>
              {shippingLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin theme-text" />
                  <span className="text-xs text-gray-500">Calculando...</span>
                </div>
              ) : totalShippingCost !== null ? (
                <span className="text-sm font-semibold theme-text">
                  ${totalShippingCost.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              ) : (
                <span className="text-xs text-gray-500">No disponible</span>
              )}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <span className="text-lg font-semibold text-gray-800">Total:</span>
              <span className="text-2xl font-bold theme-text">
                ${totalShippingCost !== null && validSubtotal !== null 
                  ? (validSubtotal + totalShippingCost).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) 
                  : getTotalPrice().toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Botones */}
            <div className="space-y-2">
              <Link
                href={getCartUrl()}
                className="block w-full"
                onClick={closeCart}
              >
                <Button 
                  className="w-full theme-gradient-bg text-white font-semibold py-6 hover:opacity-90 transition-opacity"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)'
                  }}
                >
                  Pagar Ahora
                </Button>
              </Link>
              <Button
                onClick={closeCart}
                variant="outline"
                className="w-full theme-border hover:bg-gray-100"
              >
                Seguir Comprando
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
