"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import { ArrowLeft, Plus, Minus, Trash2, Package, Truck, MapPin, Store, Disc3 } from "lucide-react";
import Link from "next/link";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import { applyThemeToDocument } from "@/lib/colorThemes";
import LocationSelector from "@/components/LocationSelector";

// Agregar estilos para animaciones de notificación
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  if (!document.head.querySelector('style[data-cart-animations]')) {
    style.setAttribute('data-cart-animations', 'true');
    document.head.appendChild(style);
  }
}

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

interface VendorGroup {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  items: any[];
  subtotal: number;
  shippingCost: number;
  shippingOptions: any[];
  selectedShipping: any;
  freeShippingEnabled?: boolean;
  freeShippingThreshold?: number;
  halfPriceShippingEnabled?: boolean;
  halfPriceShippingThreshold?: number;
}

const buildFreeShippingOption = (option?: any) => {
  const quotedPrice = Number(option?.originalPrice ?? option?.enviaQuotedPrice ?? option?.price ?? 0);

  return {
    ...(option || {}),
    method: 'Envío Gratis',
    displayMethod: 'Envío Gratis',
    price: 0,
    originalPrice: quotedPrice,
    enviaQuotedPrice: quotedPrice,
    isFreeShipping: true,
    methodCode: option?.methodCode || 'free_shipping',
    estimatedDays: option?.estimatedDays || 5,
    isRealTimeQuote: option?.isRealTimeQuote ?? false,
  };
};
export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, getTotalPrice } = useCart();
  const [openLocationModal, setOpenLocationModal] = useState(false);

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingShipping, setLoadingShipping] = useState(false);
  
  // Estado para grupos de vendedores
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  
  // Region/Comuna selection (cargar desde localStorage)
  const [selectedRegion, setSelectedRegion] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const regionId = localStorage.getItem('selectedRegionId');
      return regionId ? parseInt(regionId) : null;
    }
    return null;
  });
  
  const [selectedCommune, setSelectedCommune] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const comunaId = localStorage.getItem('selectedComunaId');
      return comunaId ? parseInt(comunaId) : null;
    }
    return null;
  });

  useEffect(() => {
    loadMarketplaceSettings();
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      groupItemsByVendor();
    }
  }, [items]);

  useEffect(() => {
    if (vendorGroups.length > 0 && selectedCommune) {
      calculateShippingForGroups();
    }
  }, [selectedCommune]);

  // Listener para cambios en la ubicación (cuando se selecciona en el header)
  useEffect(() => {
    const handleLocationChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { regionId, comunaId } = customEvent.detail;
      console.log('[CartPage] 📍 Ubicación cambiada:', customEvent.detail);
      setSelectedRegion(regionId);
      setSelectedCommune(comunaId);
      setOpenLocationModal(false);
    };

    window.addEventListener('locationChanged', handleLocationChange);

    return () => {
      window.removeEventListener('locationChanged', handleLocationChange);
    };
  }, []);

  const loadMarketplaceSettings = async () => {
    try {
      const marketplaceSettings = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/marketplace/settings`
      );
      const settingsData = await marketplaceSettings.json();
      const settingsObj = settingsData.reduce((acc: any, setting: any) => {
        acc[setting.settingKey] = setting.settingValue;
        return acc;
      }, {});

      try {
        const vendorSettings = await api.getVendorSettings(MARKETPLACE_VENDOR_ID, false);
        Object.assign(settingsObj, {
          headerConfig: vendorSettings.headerConfig,
          headerType: vendorSettings.headerType,
          footerConfig: vendorSettings.footerConfig,
          colorTheme: vendorSettings.colorTheme,
        });
      } catch (error) {
        console.log('Could not load vendor settings for marketplace:', error);
      }

      setSettings(settingsObj);

      if (settingsObj.colorTheme) {
        applyThemeToDocument(settingsObj.colorTheme, settingsObj.customColors);
      }
    } catch (error) {
      console.error("Error loading marketplace settings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Autodetección de ubicación por geolocalización
  const autoDetectLocation = async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    
    console.log('[CART] 📍 Iniciando autodetección de ubicación...');
    
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            console.log('[CART] 📍 Coordenadas obtenidas:', { latitude, longitude });
            
            // Usar API de geocodificación inversa
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=es`
            );
            const data = await response.json();
            
            console.log('[CART] 🌍 Datos de geocodificación:', data);
            
            if (data && data.address) {
              const { city, town, municipality, county, state } = data.address;
              const detectedLocation = city || town || municipality || county || '';
              
              if (detectedLocation) {
                await findMatchingLocation(detectedLocation, state);
              }
            }
          } catch (error) {
            console.error('[CART] ❌ Error en geocodificación:', error);
          } finally {
            resolve();
          }
        },
        (error) => {
          console.log('[CART] ⚠️ Error al obtener ubicación:', error.message);
          resolve();
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000 // 5 minutos
        }
      );
    });
  };

  // Buscar comuna que coincida con la ubicación detectada
  const findMatchingLocation = async (detectedCity: string, detectedRegion?: string) => {
    try {
      console.log('[CART] 🔍 Buscando coincidencia para:', { detectedCity, detectedRegion });
      
      // Cargar regiones si no están disponibles
      const regionsData = await api.getRegions();
      
      // Buscar región que coincida
      let matchedRegion = null;
      if (detectedRegion) {
        matchedRegion = regionsData.find((region: any) => 
          region.name.toLowerCase().includes(detectedRegion.toLowerCase()) ||
          detectedRegion.toLowerCase().includes(region.name.toLowerCase())
        );
      }
      
      // Si no encuentra región, usar Región Metropolitana como default
      if (!matchedRegion) {
        matchedRegion = regionsData.find((region: any) => 
          region.name.toLowerCase().includes('metropolitana') ||
          region.name.toLowerCase().includes('santiago')
        );
      }
      
      if (matchedRegion) {
        console.log('[CART] 🎯 Región encontrada:', matchedRegion.name);
        
        // Cargar comunas de la región
        const communesData = await api.getCommunesByRegion(matchedRegion.id);
        
        // Buscar comuna que coincida
        const matchedCommune = communesData.find((commune: any) => 
          commune.name.toLowerCase().includes(detectedCity.toLowerCase()) ||
          detectedCity.toLowerCase().includes(commune.name.toLowerCase()) ||
          // Búsquedas adicionales para casos comunes
          (detectedCity.toLowerCase().includes('santiago') && commune.name.toLowerCase().includes('santiago')) ||
          (detectedCity.toLowerCase().includes('providencia') && commune.name.toLowerCase().includes('providencia')) ||
          (detectedCity.toLowerCase().includes('las condes') && commune.name.toLowerCase().includes('las condes'))
        );
        
        if (matchedCommune) {
          console.log('[CART] ✅ Comuna detectada automáticamente:', matchedCommune.name);
          
          // Aplicar la ubicación detectada
          setSelectedRegion(matchedRegion.id);
          setSelectedCommune(matchedCommune.id);
          
          // Guardar en localStorage
          localStorage.setItem('selectedRegion', matchedRegion.name);
          localStorage.setItem('selectedComuna', matchedCommune.name);
          localStorage.setItem('selectedRegionId', matchedRegion.id.toString());
          localStorage.setItem('selectedComunaId', matchedCommune.id.toString());
          localStorage.setItem('checkoutSelectedRegion', matchedRegion.id.toString());
          localStorage.setItem('checkoutSelectedCommune', matchedCommune.id.toString());
          localStorage.setItem('locationAutoDetected', 'true');
          
          // Mostrar notificación al usuario
          if (typeof window !== 'undefined') {
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #22c55e;
              color: white;
              padding: 12px 20px;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              z-index: 1000;
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 14px;
              max-width: 300px;
              animation: slideInRight 0.3s ease-out;
            `;
            notification.innerHTML = `
              📍 Ubicación detectada: <strong>${matchedCommune.name}</strong><br>
              <small>Región ${matchedRegion.name}</small>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
              if (notification && notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out forwards';
                setTimeout(() => {
                  if (notification && notification.parentNode) {
                    document.body.removeChild(notification);
                  }
                }, 300);
              }
            }, 4000);
          }
        } else {
          console.log('[CART] ⚠️ No se encontró comuna coincidente para:', detectedCity);
        }
      }
    } catch (error) {
      console.error('[CART] ❌ Error buscando ubicación:', error);
    }
  };

  // Verificar si necesita autodetección al cargar
  useEffect(() => {
    const checkAutoDetection = async () => {
      if (typeof window === 'undefined') return;
      
      // Solo autodetectar si no hay ubicación seleccionada y no se ha autodetectado antes
      const hasSelectedLocation = selectedRegion && selectedCommune;
      const wasAutoDetected = localStorage.getItem('locationAutoDetected');
      
      if (!hasSelectedLocation && !wasAutoDetected && settings) {
        console.log('[CART] 🎯 No hay ubicación seleccionada, iniciando autodetección...');
        await autoDetectLocation();
      }
    };
    
    if (settings && !loading) {
      checkAutoDetection();
    }
  }, [settings, loading, selectedRegion, selectedCommune]);

  const groupItemsByVendor = async () => {
    try {
      // Enriquecer items con información del vendor
      const enrichedItems = await Promise.all(items.map(async (item) => {
        try {
          const product = await api.getProduct(item.productId);
          return {
            ...item,
            vendorId: product.vendor?.id || product.vendorId || MARKETPLACE_VENDOR_ID,
            vendorSlug: product.vendor?.slug || product.vendorSlug || 'marketplace',
            vendorName: product.vendor?.storeName || 'Marketplace',
          };
        } catch (error) {
          console.error("[CART] Error fetching product:", error);
          return {
            ...item,
            vendorId: MARKETPLACE_VENDOR_ID,
            vendorSlug: 'marketplace',
            vendorName: 'Marketplace',
          };
        }
      }));

      // Agrupar por vendorId - filtrar vendorIds inválidos
      const grouped: Record<string, any[]> = {};
      enrichedItems.forEach(item => {
        const vendorId = item.vendorId?.trim();
        if (!vendorId || vendorId === 'undefined' || vendorId === 'null') {
          console.warn('[CART] Item con vendorId inválido:', { vendorId: item.vendorId, title: item.title });
          return;
        }
        if (!grouped[vendorId]) {
          grouped[vendorId] = [];
        }
        grouped[vendorId].push(item);
      });

      // Crear grupos y precargar la configuración de descuentos de envío por tienda
      const groups: VendorGroup[] = await Promise.all(
        Object.entries(grouped).map(async ([vendorId, vendorItems]) => {
          const subtotal = vendorItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

          let freeShippingEnabled = false;
          let freeShippingThreshold: number | undefined;
          let halfPriceShippingEnabled = false;
          let halfPriceShippingThreshold: number | undefined;

          try {
            const vendorSettings = await api.getVendorSettings(vendorId, false);
            if (vendorSettings?.shippingSettings) {
              freeShippingEnabled = Boolean(vendorSettings.shippingSettings.freeShippingEnabled);
              halfPriceShippingEnabled = Boolean(vendorSettings.shippingSettings.halfPriceShippingEnabled);
              freeShippingThreshold = vendorSettings.shippingSettings.freeShippingThreshold;
              halfPriceShippingThreshold = vendorSettings.shippingSettings.halfPriceShippingThreshold;
            }
          } catch (error) {
            console.error(`[CART] Error loading vendor settings for ${vendorId}:`, error);
          }

          return {
            vendorId,
            vendorName: vendorItems[0].vendorName,
            vendorSlug: vendorItems[0].vendorSlug || '',
            storeName: vendorItems[0].vendorName,
            items: vendorItems,
            subtotal,
            shippingCost: 0,
            shippingOptions: [],
            selectedShipping: null,
            freeShippingEnabled,
            freeShippingThreshold,
            halfPriceShippingEnabled,
            halfPriceShippingThreshold,
          };
        })
      );

      setVendorGroups(groups);
      
      // Si ya hay una comuna seleccionada, calcular envío inmediatamente
      if (selectedCommune && groups.length > 0) {
        calculateShippingForGroupsImmediate(groups);
      }
    } catch (error) {
      console.error("[CART] Error grouping items:", error);
    }
  };

  const calculateShippingForGroupsImmediate = async (groups: VendorGroup[]) => {
    if (!selectedCommune || groups.length === 0) return;
    
    setLoadingShipping(true);
    
    try {
      // Calcular envío para cada vendor
      const updatedGroups: VendorGroup[] = await Promise.all(
        groups.map(async (group) => {
          let shippingCost = 0;
          let shippingOptions: any[] = [];
          let selectedShipping: any = null;

          const qualifiesForFreeShipping = Boolean(
            group.freeShippingEnabled &&
            group.freeShippingThreshold &&
            group.subtotal >= Number(group.freeShippingThreshold)
          );

          // Calcular envío
          try {
            const products = group.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
            }));

            const options = await api.calculateShippingWithProducts({
              vendorId: group.vendorId,
              communeId: selectedCommune,
              products,
              declaredValue: group.subtotal,
            });

            if (options && options.length > 0) {
              shippingOptions = options;
              // Seleccionar explicitamente la opcion mas barata y, si aplica, bonificarla sin perder el carrier.
              selectedShipping = options.reduce((min: any, opt: any) => 
                opt.price < min.price ? opt : min
              , options[0]);

              if (qualifiesForFreeShipping) {
                selectedShipping = buildFreeShippingOption(selectedShipping);
                shippingOptions = [selectedShipping];
              }

              shippingCost = Math.round(selectedShipping.price);
            } else if (qualifiesForFreeShipping) {
              selectedShipping = buildFreeShippingOption();
              shippingOptions = [selectedShipping];
              shippingCost = 0;
            }
          } catch (error) {
            console.error(`[CART] Error calculating shipping for vendor ${group.vendorId}:`, error);
          }

          return {
            ...group,
            shippingCost,
            shippingOptions,
            selectedShipping,
          };
        })
      );

      setVendorGroups(updatedGroups);
      
      // Guardar cálculo de envío en sessionStorage para reutilizar en checkout
      if (typeof window !== 'undefined' && selectedCommune) {
        const shippingCache = {
          communeId: selectedCommune,
          regionId: selectedRegion,
          timestamp: Date.now(),
          cartItems: items.map(item => ({ productId: item.productId, quantity: item.quantity })),
        vendorShipping: updatedGroups.map(group => ({
          vendorId: group.vendorId,
          vendorName: group.vendorName,
          vendorSlug: group.vendorSlug,
          selectedShipping: group.selectedShipping,
            shippingOptions: group.shippingOptions,
            shippingCost: group.shippingCost,
          }))
        };
        sessionStorage.setItem('shippingCache', JSON.stringify(shippingCache));
        console.log('[CART] 💾 Cálculo de envío guardado en caché (immediate)');
      }
    } catch (error) {
      console.error("[CART] Error calculating shipping:", error);
    } finally {
      setLoadingShipping(false);
    }
  };

  const calculateShippingForGroups = async () => {
    if (!selectedCommune || vendorGroups.length === 0) return;
    
    setLoadingShipping(true);
    
    try {
      // Calcular envío para cada vendor
      const updatedGroups: VendorGroup[] = await Promise.all(
        vendorGroups.map(async (group) => {
          let shippingCost = 0;
          let shippingOptions: any[] = [];
          let selectedShipping: any = null;

          const qualifiesForFreeShipping = Boolean(
            group.freeShippingEnabled &&
            group.freeShippingThreshold &&
            group.subtotal >= Number(group.freeShippingThreshold)
          );

          // Calcular envío
          try {
            const products = group.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
            }));

            const options = await api.calculateShippingWithProducts({
              vendorId: group.vendorId,
              communeId: selectedCommune,
              products,
              declaredValue: group.subtotal,
            });

            if (options && options.length > 0) {
              shippingOptions = options;
              // Seleccionar explicitamente la opcion mas barata y, si aplica, bonificarla sin perder el carrier.
              selectedShipping = options.reduce((min: any, opt: any) => 
                opt.price < min.price ? opt : min
              , options[0]);

              if (qualifiesForFreeShipping) {
                selectedShipping = buildFreeShippingOption(selectedShipping);
                shippingOptions = [selectedShipping];
              }

              shippingCost = Math.round(selectedShipping.price);
            } else if (qualifiesForFreeShipping) {
              selectedShipping = buildFreeShippingOption();
              shippingOptions = [selectedShipping];
              shippingCost = 0;
            }
          } catch (error) {
            console.error(`[CART] Error calculating shipping for vendor ${group.vendorId}:`, error);
          }

          return {
            ...group,
            shippingCost,
            shippingOptions,
            selectedShipping,
          };
        })
      );

      setVendorGroups(updatedGroups);
      
      // Guardar cálculo de envío en sessionStorage para reutilizar en checkout
      if (typeof window !== 'undefined' && selectedCommune) {
        const shippingCache = {
          communeId: selectedCommune,
          regionId: selectedRegion,
          timestamp: Date.now(),
          cartItems: items.map(item => ({ productId: item.productId, quantity: item.quantity })),
          vendorShipping: updatedGroups.map(group => ({
            vendorId: group.vendorId,
            vendorName: group.vendorName,
            vendorSlug: group.vendorSlug,
            selectedShipping: group.selectedShipping,
            shippingOptions: group.shippingOptions,
            shippingCost: group.shippingCost,
          }))
        };
        sessionStorage.setItem('shippingCache', JSON.stringify(shippingCache));
        console.log('[CART] 💾 Cálculo de envío guardado en caché');
      }
    } catch (error) {
      console.error("[CART] Error calculating shipping:", error);
    } finally {
      setLoadingShipping(false);
    }
  };

  const renderHeader = () => {
    if (!settings) return null;

    const vendor = {
      id: MARKETPLACE_VENDOR_ID,
      slug: "marketplace",
      storeName: settings?.storeName || "Marketplace",
      phone: settings?.phone || "",
      email: settings?.email || ""
    };

    const headerType = settings?.headerType 
      ? (typeof settings.headerType === 'number' ? `type${settings.headerType}` : settings.headerType)
      : "type1";

    switch (headerType) {
      case "type1":
        return <HeaderType1 vendor={vendor} config={settings || {}} slug="marketplace" />;
      case "type2":
        return <HeaderType2 vendor={vendor} config={settings || {}} slug="marketplace" />;
      case "type3":
        return <HeaderType3 vendor={vendor} config={settings || {}} slug="marketplace" />;
      default:
        return <HeaderType1 vendor={vendor} config={settings || {}} slug="marketplace" />;
    }
  };

  const hasFreeShippingConfigured = (group: VendorGroup) => Boolean(
    group.freeShippingEnabled && group.freeShippingThreshold && Number(group.freeShippingThreshold) > 0,
  );

  const hasHalfPriceConfigured = (group: VendorGroup) => Boolean(
    group.halfPriceShippingEnabled && group.halfPriceShippingThreshold && Number(group.halfPriceShippingThreshold) > 0,
  );

  const qualifiesForFreeShipping = (group: VendorGroup) => Boolean(
    hasFreeShippingConfigured(group) && group.subtotal >= Number(group.freeShippingThreshold),
  );

  const isFreeShippingActive = (group: VendorGroup) => Boolean(
    group.selectedShipping?.methodCode === 'free_shipping' || qualifiesForFreeShipping(group),
  );

  const getShippingMessage = (group: VendorGroup) => {
    if (isFreeShippingActive(group)) {
      return {
        text: `🎉 ${group.vendorName} ya tiene envío gratis para este pedido.`,
        type: "success",
      };
    }

    const hasFreeShipping = hasFreeShippingConfigured(group);
    const hasHalfPrice = hasHalfPriceConfigured(group);
    const hasHalfPriceApplied = group.selectedShipping?.hasDiscount && group.selectedShipping?.discountPercentage === 50;

    if (!selectedCommune) {
      if (hasFreeShipping) {
        const remainingForFree = Number(group.freeShippingThreshold) - group.subtotal;
        if (remainingForFree > 0) {
          return {
            text: `Agrega $${remainingForFree.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} más para tener envío gratis en ${group.vendorName}`,
            type: "warning",
          };
        }
      }

      if (hasHalfPrice) {
        const remainingForHalf = Number(group.halfPriceShippingThreshold) - group.subtotal;
        if (remainingForHalf > 0) {
          return {
            text: `Agrega $${remainingForHalf.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} más para obtener 50% descuento en el envío de ${group.vendorName}`,
            type: "warning",
          };
        }
      }

      return {
        text: "Selecciona tu ubicación para calcular el envío",
        type: "info",
      };
    }

    if (!group.selectedShipping) {
      return {
        text: "Calculando opciones de envío para esta tienda",
        type: "info",
      };
    }

    console.log(`[CART] getShippingMessage for ${group.vendorName}:`, {
      hasFreeShipping,
      hasHalfPrice,
      hasHalfPriceApplied,
      freeShippingThreshold: group.freeShippingThreshold,
      halfPriceShippingThreshold: group.halfPriceShippingThreshold,
      subtotal: group.subtotal,
      selectedShipping: group.selectedShipping
    });

    // Caso 1: Ambos descuentos configurados
    if (hasFreeShipping && hasHalfPrice) {
      const remainingForHalf = group.halfPriceShippingThreshold! - group.subtotal;
      const remainingForFree = group.freeShippingThreshold! - group.subtotal;

      // Ya pasó el umbral de 50% (tiene descuento aplicado)
      if (hasHalfPriceApplied) {
        if (remainingForFree > 0) {
          return {
            text: `¡Tienes 50% descuento en envío! Agrega $${remainingForFree.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} más para envío 100% gratis en ${group.vendorName}`,
            type: "warning"
          };
        }
      } else if (remainingForHalf > 0) {
        return {
          text: `Agrega $${remainingForHalf.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} para 50% descuento en envío, o $${remainingForFree.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} para 100% gratis en ${group.vendorName}`,
          type: "warning"
        };
      }
    }

    // Caso 2: Solo 50% descuento
    if (hasHalfPrice && !hasFreeShipping) {
      const remaining = group.halfPriceShippingThreshold! - group.subtotal;
      
      // Ya tiene el 50% aplicado
      if (hasHalfPriceApplied) {
        return {
          text: `🎉 ¡Tienes 50% descuento en el envío de ${group.vendorName}!`,
          type: "success"
        };
      }
      
      // Aún no alcanza el umbral
      if (remaining > 0) {
        return {
          text: `Agrega $${remaining.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} más para 50% descuento en envío de ${group.vendorName}`,
          type: "warning"
        };
      }
    }

    // Caso 3: Solo envío gratis (configuración actual)
    if (hasFreeShipping && !hasHalfPrice) {
      const remaining = group.freeShippingThreshold! - group.subtotal;
      if (remaining > 0) {
        return {
          text: `Agrega $${remaining.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} más para tener envío gratis en ${group.vendorName}`,
          type: "warning"
        };
      }
    }

    // Caso 4: Sin descuentos configurados
    return {
      text: `Esta tienda no ofrece descuentos en envíos`,
      type: "info"
    };
  };

  // Calcular totales generales
  const totalProducts = vendorGroups.reduce((sum, g) => sum + g.subtotal, 0);
  const totalShipping = vendorGroups.reduce((sum, g) => sum + g.shippingCost, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalVendors = vendorGroups.length;
  const grandTotal = totalProducts + totalShipping;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 theme-border"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        {renderHeader()}
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h1 className="text-2xl font-bold text-gray-800 mb-4">Tu carrito está vacío</h1>
              <p className="text-gray-600 mb-6">¡Descubre productos increíbles y comienza a comprar!</p>
              <Link href="/">
                <Button className="theme-gradient-bg hover:opacity-90">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al inicio
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {renderHeader()}
      
      <div className="container mx-auto min-w-0 px-3 py-5 sm:px-4 sm:py-8 flex-1">
        {/* Header */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Tu Carrito</h1>
          {!selectedCommune && (
            <div className="bg-white border theme-border rounded-lg p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 text-2xl">📍</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 mb-2">
                    Selecciona la comuna de despacho para calcular los costos de envío
                  </p>
                  <Button
                    onClick={() => setOpenLocationModal(true)}
                    size="sm"
                    className="theme-gradient-bg hover:opacity-90 text-white"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Seleccionar comuna
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LocationSelector oculto pero funcional */}
        <LocationSelector 
          triggerOpen={openLocationModal}
          onClose={() => setOpenLocationModal(false)}
          hideButton={true}
          onLocationChange={() => window.location.reload()} 
        />

        <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 sm:gap-6">
          {/* Columna Principal - Productos por Vendor */}
          <div className="min-w-0 space-y-4 sm:space-y-6">
            {/* Mensaje motivacional */}
            {totalVendors > 1 && (
              <div className="bg-white border theme-border rounded-lg p-4 shadow-sm">
                <p className="text-sm font-semibold theme-text">
                  Productos de {totalVendors} tiendas
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  El envío se calcula por separado para cada tienda.
                </p>
              </div>
            )}

            {/* Grupos de vendedores */}
            {vendorGroups.map((group) => {
              const message = getShippingMessage(group);
              
              return (
                <Card key={group.vendorId} className="min-w-0 overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b px-4 pt-3 [.border-b]:pb-3 sm:px-6 sm:pt-4 sm:[.border-b]:pb-4">
                    <CardTitle className="flex items-center gap-3 text-base sm:text-lg">
                      <Store className="h-5 w-5 shrink-0 theme-text" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="font-bold break-words">{group.vendorName}</div>
                        <div className="text-xs font-normal text-gray-600 mt-1">
                          Tienda oficial
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="p-3 sm:p-6 space-y-4">
                    {/* Productos del vendor */}
                    {group.items.map((item) => (
                      <div key={item.productId} className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2 pb-4 border-b sm:grid-cols-[96px_minmax(0,1fr)]">
                        {/* Imagen */}
                        <div className="h-16 w-16 sm:h-24 sm:w-24 bg-gray-100 rounded overflow-hidden">
                          {item.imageUrl ? (
                            <img
                              src={getImageUrl(item.imageUrl)}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                              <Disc3 className="h-6 w-6" aria-hidden="true" />
                            </div>
                          )}
                        </div>

                        {/* Info del producto */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm sm:text-base font-semibold leading-5 text-gray-800 break-words">
                            {item.title}
                          </h3>
                          {item.artist && (
                            <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">{item.artist}</p>
                          )}
                          
                            <div className="mt-2 text-base sm:text-lg font-bold theme-text">
                              ${item.price.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                            
                        </div>
                        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs text-gray-500">Stock: {item.stock}</div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                aria-label={`Disminuir cantidad de ${item.title}`}
                                title="Disminuir cantidad"
                                className="w-11 h-11 flex items-center justify-center border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span aria-label={`Cantidad de ${item.title}`} className="text-sm font-semibold w-8 text-center tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                aria-label={`Aumentar cantidad de ${item.title}`}
                                title="Aumentar cantidad"
                                className="w-11 h-11 flex items-center justify-center border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                                disabled={item.quantity >= item.stock}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeItem(item.productId)}
                                aria-label={`Eliminar ${item.title}`}
                                title="Eliminar producto"
                                className="ml-1 w-11 h-11 flex items-center justify-center text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                        </div>
                      </div>
                    ))}

                    {/* Información de envío del vendor */}
                    <div className="pt-1 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-gray-700 text-base">Envío</span>
                          {isFreeShippingActive(group) ? (
                            <div className="text-right">
                              <div className="font-bold theme-text text-xl">
                                Envío gratis
                              </div>
                            </div>
                          ) : loadingShipping ? (
                          <span className="text-gray-500 text-base">Calculando...</span>
                        ) : group.selectedShipping ? (
                          <div className="text-right">
                            <div className="font-bold theme-text text-xl">
                              ${group.shippingCost.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-base">Por calcular</span>
                        )}
                      </div>

                      {/* Mensaje motivacional */}
                      <div className={`rounded-lg p-3 text-sm ${
                        message.type === 'success' ? 'bg-green-50 theme-text border border-green-200' :
                        message.type === 'warning' ? 'bg-white text-gray-800 border border-gray-300' :
                        'bg-white text-gray-700 border border-gray-200'
                      }`}>
                        {message.text}
                      </div>

                      {/* Botón ver productos */}
                      <Link href={`/tiendas/${group.vendorSlug}`} className="block">
                        <Button variant="outline" className="w-full h-auto min-h-10 whitespace-normal py-2" size="sm">
                          Ver más productos de {group.vendorName}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Sidebar - Resumen (Sticky) */}
          <aside className="min-w-0 h-fit lg:sticky lg:top-[200px]">
            <Card>
              <CardHeader>
                <CardTitle>Resumen de compra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Productos */}
                <div className="space-y-1">
                  <div className="text-sm text-gray-600">
                    Productos ({totalItems})
                  </div>
                  <div className="text-xl font-bold text-gray-800">
                    ${totalProducts.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Envíos */}
                {selectedCommune && (
                  <div className="space-y-1 pb-4 border-b">
                    <div className="text-sm text-gray-600">
                      Envíos ({totalVendors})
                    </div>
                    {loadingShipping ? (
                      <div className="text-sm text-gray-500">Calculando...</div>
                    ) : (
                      <div className="text-xl font-bold theme-text">
                        ${totalShipping.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="pt-2 space-y-2">
                  <div className="text-lg font-semibold text-gray-700">
                    Total
                  </div>
                  <div className="text-3xl font-bold theme-text">
                    ${grandTotal.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Botón Continuar */}
                <Button
                  onClick={() => router.push('/checkout')}
                  className="w-full theme-gradient-bg hover:opacity-90 text-white py-6 text-lg font-semibold"
                  disabled={!selectedCommune || loadingShipping}
                >
                  <Truck className="w-5 h-5 mr-2" />
                  Continuar compra
                </Button>

                {!selectedCommune && (
                  <p className="text-xs text-center text-gray-500">
                    Selecciona tu ubicación para continuar
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {settings?.footerConfig && (
        <StoreFooter footerConfig={settings.footerConfig} />
      )}
    </div>
  );
}
