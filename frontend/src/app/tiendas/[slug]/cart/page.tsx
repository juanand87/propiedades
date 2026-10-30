"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getImageUrl, getProductImageByIndex } from "@/lib/utils";
import { ArrowLeft, Plus, Minus, Trash2, ShoppingCart, AlertTriangle } from "lucide-react";
import Link from "next/link";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import { applyThemeToDocument } from "@/lib/colorThemes";
import { getCheckoutUrl, getStoreUrl, getProductUrl } from "@/lib/useCustomDomain";

export default function StoreCartPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const { items, removeItem, updateQuantity } = useCart();

  const [settings, setSettings] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [stockIssues, setStockIssues] = useState<Array<{ productId: string; title: string; available: number; requested: number }>>([]);
  
  // Shipping calculation state
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [selectedCommuneName, setSelectedCommuneName] = useState<string | null>(null);

  useEffect(() => {
    loadStoreData();
  }, [slug]);

  useEffect(() => {
    if (vendor && items.length > 0) {
      filterStoreItems();
    } else {
      setStoreItems([]);
    }
  }, [items, vendor]);

  // Listener para cambios de ubicación desde el header
  useEffect(() => {
    const handleLocationChange = (event: Event) => {
      console.log('[CART-TIENDA] 📍 Ubicación cambiada desde header');
      const customEvent = event as CustomEvent;
      const { comuna, comunaId } = customEvent.detail || {};
      
      if (comuna && comunaId) {
        setSelectedCommuneName(comuna);
        // Recalcular envío con la nueva ubicación
        calculateShippingForLocation(comunaId);
      }
    };

    window.addEventListener('locationChanged', handleLocationChange);

    // Cargar ubicación inicial desde localStorage
    const savedComuna = localStorage.getItem('selectedComuna');
    const savedComunaId = localStorage.getItem('selectedComunaId');
    if (savedComuna && savedComunaId) {
      setSelectedCommuneName(savedComuna);
      // Calcular envío si ya tenemos vendor y items
      if (vendor && storeItems.length > 0) {
        calculateShippingForLocation(parseInt(savedComunaId));
      }
    }

    return () => {
      window.removeEventListener('locationChanged', handleLocationChange);
    };
  }, []);

  // Recalcular envío cuando cambian los items o el vendor
  useEffect(() => {
    const savedComunaId = localStorage.getItem('selectedComunaId');
    if (savedComunaId && vendor && storeItems.length > 0) {
      calculateShippingForLocation(parseInt(savedComunaId));
    } else if (storeItems.length === 0) {
      setShippingCost(null);
    }
  }, [storeItems, vendor]);

  const loadStoreData = async () => {
    try {
      setLoading(true);

      // Cargar información del vendor
      const vendorData = await api.get(`/vendors/slug/${slug}`, false);
      setVendor(vendorData);

      // Cargar configuración
      const vendorSettings = await api.getVendorSettings(vendorData.id, false);
      setSettings(vendorSettings);

      if (vendorSettings?.colorTheme) {
        applyThemeToDocument(vendorSettings.colorTheme, vendorSettings.customColors);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading store data:", error);
      setLoading(false);
    }
  };

  const filterStoreItems = async () => {
    // Filtrar solo items de esta tienda
    const filtered = items.filter(item => 
      item.vendorId === vendor.id || item.vendorSlug === slug
    );

    const issues: Array<{ productId: string; title: string; available: number; requested: number }> = [];

    // Enriquecer con información completa del producto y verificar stock
    const enriched = await Promise.all(
      filtered.map(async (item) => {
        try {
          // Siempre cargar el producto para verificar stock actual
          const product = await api.getProduct(item.productId);
          const availableStock = Number(product.stock) || 0;

          // Registrar problema de stock si corresponde
          if (availableStock === 0 || availableStock < item.quantity) {
            issues.push({
              productId: item.productId,
              title: item.title || product.title || 'Producto',
              available: availableStock,
              requested: item.quantity,
            });
          }

          const primaryImage = getProductImageByIndex(product, 0, 'thumb');

          return {
            ...item,
            imageUrl: item.imageUrl || (primaryImage ? getImageUrl(primaryImage) : undefined),
            artist: item.artist || product.artist,
            currentStock: availableStock,
          };
        } catch (error) {
          console.error("Error enriching item:", error);
          return item;
        }
      })
    );

    setStoreItems(enriched);
    setStockIssues(issues);
  };

  const parseImages = (images: any) => {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    
    if (typeof images === 'string') {
      if (images.startsWith('http') || images.startsWith('/')) {
        return [{ url: images, isPrimary: true }];
      }
      try {
        const parsed = JSON.parse(images);
        return Array.isArray(parsed) ? parsed : [{ url: parsed, isPrimary: true }];
      } catch {
        return images.split(',').filter(Boolean).map((url: string, index: number) => ({
          url: url.trim(),
          isPrimary: index === 0
        }));
      }
    }
    
    return [];
  };

  const calculateSubtotal = () => {
    return storeItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateShippingForLocation = async (comunaId: number) => {
    if (!vendor?.id || storeItems.length === 0) {
      setShippingCost(null);
      return;
    }

    try {
      setShippingLoading(true);
      console.log('[CART-TIENDA] 🚚 Calculando envío para comuna:', comunaId);
      
      const subtotal = calculateSubtotal();
      const products = storeItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/shipping/calculate-with-products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendorId: vendor.id,
          communeId: comunaId,
          products,
          declaredValue: subtotal,
        }),
      });

      if (response.ok) {
        const shippingOptions = await response.json();
        
        if (shippingOptions && shippingOptions.length > 0) {
          // Usar la opción más barata
          const cheapestOption = shippingOptions.reduce((min: any, opt: any) => 
            opt.price < min.price ? opt : min
          , shippingOptions[0]);
          
          setShippingCost(Math.round(cheapestOption.price));
          console.log('[CART-TIENDA] ✅ Envío calculado:', cheapestOption.price);
        } else {
          setShippingCost(null);
        }
      } else {
        console.error('[CART-TIENDA] Error al calcular envío');
        setShippingCost(null);
      }
    } catch (error) {
      console.error('[CART-TIENDA] Error calculating shipping:', error);
      setShippingCost(null);
    } finally {
      setShippingLoading(false);
    }
  };

  const handleCheckout = () => {
    if (storeItems.length === 0) {
      alert("No hay productos en el carrito de esta tienda");
      return;
    }
    const checkoutUrl = getCheckoutUrl(slug);
    router.push(checkoutUrl);
  };

  const renderHeader = () => {
    if (!settings || !vendor) return null;

    const headerType = settings?.headerType 
      ? (typeof settings.headerType === 'number' ? `type${settings.headerType}` : settings.headerType)
      : "type1";

    const headerConfig = {
      ...(settings?.headerConfig || {}),
      menus: settings?.menus || {},
      customMenus: settings?.customMenus || {},
      headerConfig: settings?.headerConfig || {},
    };

    switch (headerType) {
      case "type1":
        return <HeaderType1 vendor={vendor} config={headerConfig} slug={slug} />;
      case "type2":
        return <HeaderType2 vendor={vendor} config={headerConfig} slug={slug} />;
      case "type3":
        return <HeaderType3 vendor={vendor} config={headerConfig} slug={slug} />;
      default:
        return <HeaderType1 vendor={vendor} config={headerConfig} slug={slug} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderBottomColor: 'var(--color-primary, #0d7fb3)' }}></div>
            <p className="mt-4 text-gray-600">Cargando carrito...</p>
          </div>
        </div>
      </div>
    );
  }

  const subtotal = calculateSubtotal();
  const total = subtotal + (shippingCost || 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {renderHeader()}

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href={getStoreUrl(slug)}
            className="inline-flex items-center mb-4 transition-opacity hover:opacity-80" style={{ color: 'var(--color-primary, #0d7fb3)' }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a la tienda
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">
            Carrito de Compras
          </h1>
          <p className="text-gray-600 mt-2">
            {vendor?.storeName || 'Tienda'}
          </p>
        </div>

        {storeItems.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Tu carrito está vacío</h2>
              <p className="text-gray-600 mb-6">
                Agrega productos de {vendor?.storeName || 'esta tienda'} para comenzar tu compra
              </p>
              <Link href={getStoreUrl(slug)}>
                <Button className="text-white hover:opacity-90" style={{ backgroundColor: 'var(--color-primary, #0d7fb3)' }}>
                  Ir a la tienda
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Productos */}
            <div className="lg:col-span-2 space-y-4">
              {/* Advertencia de stock */}
              {stockIssues.length > 0 && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                  <p className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    Hay productos sin stock disponible
                  </p>
                  <ul className="space-y-1 mb-3">
                    {stockIssues.map(issue => (
                      <li key={issue.productId} className="text-sm text-red-600">
                        <strong>{issue.title}</strong>:{" "}
                        {issue.available === 0
                          ? "Ya no tiene stock"
                          : `Solo ${issue.available} disponible(s), tienes ${issue.requested} en el carrito`}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-red-600">Elimina estos productos del carrito para poder continuar con la compra.</p>
                </div>
              )}
              {storeItems.map((item) => (
                <Card key={`${item.productId}-${item.vendorId}`} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Imagen */}
                      <Link 
                        href={getProductUrl(item.productId, slug)}
                        className="flex-shrink-0"
                      >
                        <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                              <span className="text-2xl">🎵</span>
                            </div>
                          )}
                        </div>
                      </Link>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={getProductUrl(item.productId, slug)}
                          className="transition-opacity hover:opacity-80"
                        >
                          <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2">
                            {item.title}
                          </h3>
                        </Link>
                        {item.artist && (
                          <p className="text-sm text-gray-600 mb-2">{item.artist}</p>
                        )}
                        <p className="text-lg font-bold" style={{ color: 'var(--color-primary, #0d7fb3)' }}>
                          ${item.price.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        {stockIssues.some(i => i.productId === item.productId) && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            {(stockIssues.find(i => i.productId === item.productId)?.available ?? 0) === 0
                              ? "Sin stock"
                              : `Solo ${stockIssues.find(i => i.productId === item.productId)?.available} disponible(s)`}
                          </span>
                        )}
                      </div>

                      {/* Cantidad y acciones */}
                      <div className="flex flex-col items-end justify-between">
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="text-red-500 hover:text-red-700 p-2"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => {
                              if (item.quantity > 1) {
                                updateQuantity(item.productId, item.quantity - 1);
                              }
                            }}
                            disabled={item.quantity <= 1}
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="px-3 font-semibold min-w-[2rem] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => {
                              if (!item.stock || item.quantity < item.stock) {
                                updateQuantity(item.productId, item.quantity + 1);
                              }
                            }}
                            disabled={item.stock && item.quantity >= item.stock}
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Resumen */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Resumen</h2>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({storeItems.length} {storeItems.length === 1 ? 'producto' : 'productos'})</span>
                      <span className="font-semibold">${subtotal.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    
                    {/* Shipping cost */}
                    <div className="flex justify-between text-gray-600">
                      <span>Envío{selectedCommuneName ? ` a ${selectedCommuneName}` : ''}</span>
                      <span className="font-semibold">
                        {shippingLoading ? (
                          <span className="text-sm">Calculando...</span>
                        ) : shippingCost !== null ? (
                          shippingCost === 0 ? (
                            <span className="text-green-600 font-bold">¡Gratis!</span>
                          ) : (
                            `$${shippingCost.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                          )
                        ) : selectedCommuneName ? (
                          <span className="text-sm text-gray-500">No disponible</span>
                        ) : (
                          <span className="text-sm text-gray-500">Selecciona ubicación</span>
                        )}
                      </span>
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-lg font-bold text-gray-800">
                        <span>Total</span>
                        <span style={{ color: 'var(--color-primary, #0d7fb3)' }}>${total.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                      {!selectedCommuneName && (
                        <p className="text-xs text-gray-500 mt-1">
                          💡 Selecciona tu ubicación en el header para calcular el envío
                        </p>
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={handleCheckout}
                    disabled={stockIssues.length > 0}
                    className="w-full text-white py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90" style={{ backgroundColor: 'var(--color-primary, #0d7fb3)' }}
                  >
                    Continuar al Checkout
                  </Button>

                  <Link 
                    href={getStoreUrl(slug)}
                    className="block text-center mt-4 transition-opacity hover:opacity-80" style={{ color: 'var(--color-primary, #0d7fb3)' }}
                  >
                    Continuar comprando
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {settings?.footerConfig ? (
        <StoreFooter footerConfig={settings.footerConfig} vendorSlug={slug} />
      ) : (
        <footer className="bg-gray-900 text-white py-8 mt-12">
          <div className="container mx-auto px-4 text-center">
            <p>© {new Date().getFullYear()} {vendor?.storeName || 'Tienda'}. Todos los derechos reservados.</p>
          </div>
        </footer>
      )}
    </div>
  );
}