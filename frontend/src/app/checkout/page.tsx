"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { useCheckoutProfiles, CheckoutProfile } from "@/hooks/useCheckoutProfiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import { ArrowLeft, CreditCard, Truck, Package } from "lucide-react";
import Link from "next/link";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import { applyThemeToDocument, getTheme } from "@/lib/colorThemes";
import { getStoreUrl } from "@/lib/useCustomDomain";
import { createCheckoutSessionId } from "@/lib/checkout-idempotency";
import { DiscountCodeInput, discountFingerprint, type AppliedDiscount } from "@/components/orders/DiscountCodeInput";

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
  document.head.appendChild(style);
}

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

const safeNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const formatCLP = (value: unknown) => safeNumber(value, 0).toLocaleString('es-CL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const getCartLineTotal = (item: any) => safeNumber(item?.price, 0) * Math.max(0, Math.trunc(safeNumber(item?.quantity, 0)));


// Aplicar tema INMEDIATAMENTE al cargar el módulo (antes de que React monte)
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('checkoutTheme');
  console.log('🎨 [MODULE LOAD] Buscando tema en localStorage:', savedTheme);
  if (savedTheme) {
    const theme = getTheme(savedTheme);
    console.log('🎨 [MODULE LOAD] Tema encontrado:', theme);
    document.documentElement.style.setProperty('--color-primary', theme.primary);
    document.documentElement.style.setProperty('--color-secondary', theme.secondary);
    document.documentElement.style.setProperty('--color-accent', theme.accent);
    console.log('🎨 [MODULE LOAD] Tema aplicado:', {
      primary: document.documentElement.style.getPropertyValue('--color-primary'),
      secondary: document.documentElement.style.getPropertyValue('--color-secondary'),
      accent: document.documentElement.style.getPropertyValue('--color-accent')
    });
  } else {
    console.log('⚠️ [MODULE LOAD] No hay tema guardado en localStorage');
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotalPrice, clearCart } = useCart();

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [discounts, setDiscounts] = useState<Record<string, AppliedDiscount | undefined>>({});
  
  // Checkout profiles for autocomplete
  const { profiles, saveProfile, searchProfiles } = useCheckoutProfiles();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [profileSearchResults, setProfileSearchResults] = useState<CheckoutProfile[]>([]);

  // Shipping state - Load from localStorage (primero intenta del header, sino del checkout)
  const [regions, setRegions] = useState<any[]>([]);
  const [communes, setCommunes] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      // Intentar primero la selección del header
      const headerRegionId = localStorage.getItem('selectedRegionId');
      if (headerRegionId) return parseInt(headerRegionId);
      
      // Sino, usar la del checkout
      const checkoutRegionId = localStorage.getItem('checkoutSelectedRegion');
      return checkoutRegionId ? parseInt(checkoutRegionId) : null;
    }
    return null;
  });
  const [selectedCommune, setSelectedCommune] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      // Intentar primero la selección del header
      const headerComunaId = localStorage.getItem('selectedComunaId');
      if (headerComunaId) return parseInt(headerComunaId);
      
      // Sino, usar la del checkout
      const checkoutComunaId = localStorage.getItem('checkoutSelectedCommune');
      return checkoutComunaId ? parseInt(checkoutComunaId) : null;
    }
    return null;
  });
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<any>(null);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [carrierLogos, setCarrierLogos] = useState<Record<string, string>>({});
  // Shipping por vendor (para múltiples vendedores)
  const [vendorShippingOptions, setVendorShippingOptions] = useState<Record<string, any[]>>({});
  const [selectedVendorShipping, setSelectedVendorShipping] = useState<Record<string, any>>({});

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    number: "",
    city: "",
    country: "Chile",
    rut: "",
    notes: "",
    paymentMethod: "",
  });

  // All items from marketplace (all vendors)
  const total = items.reduce((sum, item) => sum + getCartLineTotal(item), 0);
  const totalDiscount = Object.entries(discounts).reduce((sum, [vendorId, discount]) => {
    const vendorItems = items.filter((item) => (item.vendorId || MARKETPLACE_VENDOR_ID) === vendorId);
    return sum + (discount?.fingerprint === discountFingerprint(vendorId, formData.email, vendorItems) ? discount.discountAmount : 0);
  }, 0);

  useEffect(() => {
    // Aplicar tema INMEDIATAMENTE desde localStorage si existe
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('checkoutTheme');
      if (savedTheme) {
        console.log('🎨 [CHECKOUT useEffect] Aplicando tema guardado:', savedTheme);
        applyThemeToDocument(savedTheme);
        
        // Re-aplicar después de un delay corto por si algo lo sobrescribe
        setTimeout(() => {
          console.log('🎨 [CHECKOUT setTimeout] Re-aplicando tema:', savedTheme);
          applyThemeToDocument(savedTheme);
        }, 100);
      }
    }
    
    loadMarketplaceSettings();
    loadRegions();
    loadPaymentMethods();
    loadCarrierLogos();
  }, []);

  const loadCarrierLogos = async () => {
    try {
      const carriers = await api.getEnviaCarriers();
      const nextLogos = (Array.isArray(carriers) ? carriers : []).reduce((acc: Record<string, string>, carrier: any) => {
        if (carrier?.code && carrier?.logo) {
          acc[String(carrier.code).toLowerCase()] = carrier.logo;
        }
        return acc;
      }, {});
      setCarrierLogos(nextLogos);
    } catch (error) {
      console.error('Error loading carrier logos:', error);
    }
  };

  // Aplicar tema cada vez que cambian los settings (por si se sobreescribió)
  useEffect(() => {
    if (settings?.colorTheme) {
      console.log('🎨 [CHECKOUT settings] Re-aplicando tema desde settings:', settings.colorTheme);
      applyThemeToDocument(settings.colorTheme, settings.customColors);
      
      // Re-aplicar después de un delay corto
      setTimeout(() => {
        console.log('🎨 [CHECKOUT settings setTimeout] Re-aplicando tema:', settings.colorTheme);
        applyThemeToDocument(settings.colorTheme, settings.customColors);
      }, 100);
    }
  }, [settings]);

  useEffect(() => {
    console.log('[CHECKOUT] 🏛️ selectedRegion cambió:', selectedRegion);
    if (selectedRegion) {
      loadCommunesByRegion(selectedRegion);
      // Persistir en localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('checkoutSelectedRegion', selectedRegion.toString());
      }
    }
  }, [selectedRegion]);

  useEffect(() => {
    console.log('[CHECKOUT] 🏘️ selectedCommune cambió:', selectedCommune);
    if (selectedCommune) {
      // Persistir en localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('checkoutSelectedCommune', selectedCommune.toString());
      }
      calculateShipping();
    }
  }, [selectedCommune, items]); // Agregar items como dependencia para recalcular si cambian

  // Listener para cambios en la ubicación (cuando se selecciona en el header)
  useEffect(() => {
    const handleLocationChange = (event: Event) => {
      console.log('[CHECKOUT] 📍 Ubicación cambiada desde header');
      const customEvent = event as CustomEvent;
      const { region, comuna, regionId, comunaId } = customEvent.detail || {};
      
      if (regionId && comunaId) {
        console.log('[CHECKOUT] 📍 Actualizando:', { region, comuna });
        setSelectedRegion(regionId);
        setSelectedCommune(comunaId);
      }
    };

    window.addEventListener('locationChanged', handleLocationChange);

    return () => {
      window.removeEventListener('locationChanged', handleLocationChange);
    };
  }, []); // Dependencias vacías para que solo se ejecute una vez

  // Invalidar caché si cambian los items del carrito
  useEffect(() => {
    if (typeof window !== 'undefined' && items.length > 0) {
      const cachedData = sessionStorage.getItem('shippingCache');
      if (cachedData) {
        try {
          const cache = JSON.parse(cachedData);
          const itemsChanged = 
            cache.cartItems.length !== items.length ||
            !cache.cartItems.every((cachedItem: any) => 
              items.some(item => 
                item.productId === cachedItem.productId && 
                item.quantity === cachedItem.quantity
              )
            );
          
          if (itemsChanged) {
            console.log('[CHECKOUT] 🗑️ Invalidando caché por cambios en el carrito');
            sessionStorage.removeItem('shippingCache');
            if (selectedCommune) {
              calculateShipping();
            }
          }
        } catch (error) {
          console.error('[CHECKOUT] Error al verificar caché:', error);
        }
      }
    }
  }, [items]);

  const loadMarketplaceSettings = async () => {
    try {
      // Load marketplace settings
      const marketplaceSettings = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/marketplace/settings`);
      const settingsData = await marketplaceSettings.json();
      const settingsObj = settingsData.reduce((acc: any, setting: any) => {
        acc[setting.settingKey] = setting.settingValue;
        return acc;
      }, {});
      
      // Load marketplace vendor settings (includes headerConfig)
      try {
        const vendorSettings = await api.getVendorSettings(MARKETPLACE_VENDOR_ID, false);
        // Merge vendor settings with marketplace settings
        Object.assign(settingsObj, {
          headerConfig: vendorSettings.headerConfig,
          headerType: vendorSettings.headerType,
          footerConfig: vendorSettings.footerConfig,
          colorTheme: vendorSettings.colorTheme, // Add colorTheme from vendor settings
        });
      } catch (error) {
        console.log('Could not load vendor settings for marketplace:', error);
      }
      
      console.log('🔍 [loadMarketplaceSettings] settingsObj completo:', settingsObj);
      console.log('🔍 [loadMarketplaceSettings] colorTheme value:', settingsObj.colorTheme);
      
      // Apply theme FIRST (before setSettings to avoid flicker)
      if (settingsObj.colorTheme) {
        console.log('✅ [loadMarketplaceSettings] Aplicando tema:', settingsObj.colorTheme);
        applyThemeToDocument(settingsObj.colorTheme, settingsObj.customColors);
        // Guardar tema en localStorage para aplicarlo inmediatamente en F5
        if (typeof window !== 'undefined') {
          localStorage.setItem('checkoutTheme', settingsObj.colorTheme);
          console.log('💾 [loadMarketplaceSettings] Tema guardado en localStorage');
        }
      } else {
        console.log('⚠️ [loadMarketplaceSettings] No hay colorTheme en settingsObj');
      }
      
      setSettings(settingsObj);
    } catch (error) {
      console.error("Error loading marketplace settings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Render header based on marketplace settings
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

  const loadRegions = async () => {
    try {
      const data = await api.getRegions();
      setRegions(data);
    } catch (error) {
      console.error("Error loading regions:", error);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      setLoadingPaymentMethods(true);
      const methods = await api.getActiveMarketplacePaymentMethods();
      console.log('[CHECKOUT] Métodos de pago cargados:', methods);
      setPaymentMethods(methods);
      
      // Set default payment method to first available
      if (methods.length > 0 && !formData.paymentMethod) {
        setFormData(prev => ({ ...prev, paymentMethod: methods[0].code }));
      }
    } catch (error) {
      console.error("Error loading payment methods:", error);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const loadCommunesByRegion = async (regionId: number) => {
    try {
      const data = await api.getCommunesByRegion(regionId);
      setCommunes(data);
    } catch (error) {
      console.error("Error loading communes:", error);
    }
  };

  // Autodetección de ubicación por geolocalización
  const autoDetectLocation = async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    
    console.log('[CHECKOUT] 📍 Iniciando autodetección de ubicación...');
    
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            console.log('[CHECKOUT] 📍 Coordenadas obtenidas:', { latitude, longitude });
            
            // Usar API de geocodificación inversa (puedes usar Google, OpenStreetMap, etc.)
            // Por simplicidad, uso OpenStreetMap Nominatim que es gratuito
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=es`
            );
            const data = await response.json();
            
            console.log('[CHECKOUT] 🌍 Datos de geocodificación:', data);
            
            if (data && data.address) {
              const { city, town, municipality, county, state } = data.address;
              const detectedLocation = city || town || municipality || county || '';
              
              if (detectedLocation) {
                // Buscar la comuna más parecida en nuestros datos
                await findMatchingLocation(detectedLocation, state);
              }
            }
          } catch (error) {
            console.error('[CHECKOUT] ❌ Error en geocodificación:', error);
          } finally {
            resolve();
          }
        },
        (error) => {
          console.log('[CHECKOUT] ⚠️ Error al obtener ubicación:', error.message);
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
      console.log('[CHECKOUT] 🔍 Buscando coincidencia para:', { detectedCity, detectedRegion });
      
      if (regions.length === 0) {
        await loadRegions();
      }
      
      // Buscar región que coincida
      let matchedRegion = null;
      if (detectedRegion) {
        matchedRegion = regions.find(region => 
          region.name.toLowerCase().includes(detectedRegion.toLowerCase()) ||
          detectedRegion.toLowerCase().includes(region.name.toLowerCase())
        );
      }
      
      // Si no encuentra región, usar Región Metropolitana como default (donde está la mayoría)
      if (!matchedRegion) {
        matchedRegion = regions.find(region => 
          region.name.toLowerCase().includes('metropolitana') ||
          region.name.toLowerCase().includes('santiago')
        );
      }
      
      if (matchedRegion) {
        console.log('[CHECKOUT] 🎯 Región encontrada:', matchedRegion.name);
        
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
          console.log('[CHECKOUT] ✅ Comuna detectada automáticamente:', matchedCommune.name);
          
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
          console.log('[CHECKOUT] ⚠️ No se encontró comuna coincidente para:', detectedCity);
        }
      }
    } catch (error) {
      console.error('[CHECKOUT] ❌ Error buscando ubicación:', error);
    }
  };

  // Verificar si necesita autodetección al cargar
  useEffect(() => {
    const checkAutoDetection = async () => {
      if (typeof window === 'undefined') return;
      
      // Solo autodetectar si no hay ubicación seleccionada y no se ha autodetectado antes
      const hasSelectedLocation = selectedRegion && selectedCommune;
      const wasAutoDetected = localStorage.getItem('locationAutoDetected');
      
      if (!hasSelectedLocation && !wasAutoDetected && regions.length > 0) {
        console.log('[CHECKOUT] 🎯 No hay ubicación seleccionada, iniciando autodetección...');
        await autoDetectLocation();
      }
    };
    
    if (regions.length > 0) {
      checkAutoDetection();
    }
  }, [regions, selectedRegion, selectedCommune]);

  const calculateShipping = async () => {
    if (!selectedCommune || items.length === 0) return;

    // Verificar si hay caché válida
    if (typeof window !== 'undefined') {
      try {
        const cachedData = sessionStorage.getItem('shippingCache');
        if (cachedData) {
          const cache = JSON.parse(cachedData);
          
          // Verificar si el caché es válido (misma ubicación y mismo carrito)
          const cacheValid = 
            cache.communeId === selectedCommune &&
            cache.regionId === selectedRegion &&
            cache.cartItems.length === items.length &&
            cache.cartItems.every((cachedItem: any) => 
              items.some(item => 
                item.productId === cachedItem.productId && 
                item.quantity === cachedItem.quantity
              )
            ) &&
            (Date.now() - cache.timestamp) < 5 * 60 * 1000; // Válido por 5 minutos
          
          if (cacheValid) {
            console.log('[CHECKOUT] ✅ Usando caché de envío desde /cart');
            
            // Reconstruir vendorShippingOptions y selectedVendorShipping desde la caché
            const newVendorShippingOptions: Record<string, any[]> = {};
            const newSelectedVendorShipping: Record<string, any> = {};
            
            cache.vendorShipping.forEach((vendorData: any) => {
              // Agregar vendorName a cada opción de shipping
              const optionsWithVendor = vendorData.shippingOptions.map((opt: any) => ({
                ...opt,
                vendorName: vendorData.vendorName,
                vendorSlug: vendorData.vendorSlug,
              }));
              
              newVendorShippingOptions[vendorData.vendorId] = optionsWithVendor;
              newSelectedVendorShipping[vendorData.vendorId] = {
                ...vendorData.selectedShipping,
                vendorName: vendorData.vendorName,
                vendorSlug: vendorData.vendorSlug,
              };
            });
            
            setVendorShippingOptions(newVendorShippingOptions);
            setSelectedVendorShipping(newSelectedVendorShipping);
            
            // Construir allOptions para shippingOptions
            const allOptions = Object.values(newSelectedVendorShipping).filter(Boolean);
            setShippingOptions(allOptions);
            if (allOptions.length > 0) {
              setSelectedShipping(allOptions[0]);
            }
            
            return; // No recalcular, usar caché
          } else {
            console.log('[CHECKOUT] ⚠️ Caché inválida, recalculando...');
            sessionStorage.removeItem('shippingCache');
          }
        }
      } catch (error) {
        console.error('[CHECKOUT] Error al leer caché:', error);
      }
    }

    console.log('[CHECKOUT] 🔄 Calculando envío...');
    try {
      setLoadingShipping(true);
      setShippingError(null);

      // Enrich cart items with CORRECT vendorId from product API
      // ALWAYS fetch to ensure we have vendor.id (not product.vendorId which is incorrect)
      console.log("[SHIPPING] Fetching products to get correct vendorId...");
      const enrichedItems = await Promise.all(items.map(async (item) => {
        try {
          const product = await api.getProduct(item.productId);
          console.log("[SHIPPING] Fetched product vendorId:", product.vendor?.id || product.vendorId, "slug:", product.vendor?.slug || product.vendorSlug);
          return {
            ...item,
            vendorId: product.vendor?.id || product.vendorId || '',
            vendorSlug: product.vendor?.slug || product.vendorSlug || '',
          };
        } catch (error) {
          console.error("[SHIPPING] Error fetching product for vendorId:", error);
          return item;
        }
      }));

      // Agrupar productos por vendorId
      const itemsByVendor: Record<string, typeof items> = {};
      for (const item of enrichedItems) {
        const vendorId = item.vendorId || MARKETPLACE_VENDOR_ID;
        if (!itemsByVendor[vendorId]) {
          itemsByVendor[vendorId] = [];
        }
        itemsByVendor[vendorId].push(item);
      }

      console.log("[SHIPPING] Items grouped by vendor:", Object.keys(itemsByVendor).map(v => ({
        vendorId: v,
        itemCount: itemsByVendor[v].length,
        vendorSlug: itemsByVendor[v][0]?.vendorSlug
      })));

      const vendorIds = Object.keys(itemsByVendor);
      const newVendorShippingOptions: Record<string, any[]> = {};
      const newSelectedVendorShipping: Record<string, any> = {};

      // Cotizar envío para cada vendor
      for (const vendorId of vendorIds) {
        const vendorItems = itemsByVendor[vendorId];
        
        console.log(`[SHIPPING] Calculando envío para vendor ${vendorId}, items:`, vendorItems.length);
        
        // Calcular valor total para este vendor
        const vendorValue = vendorItems.reduce((sum, item) => sum + getCartLineTotal(item), 0);

        // Preparar productos con sus cantidades
        const products = vendorItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        }));

        console.log(`[SHIPPING] Vendor ${vendorId} - Value: ${vendorValue}, Products:`, products);

        try {
          const options = await api.calculateShippingWithProducts({
            vendorId,
            communeId: selectedCommune,
            products,
            declaredValue: vendorValue,
          });

          console.log(`[SHIPPING] ✅ Vendor ${vendorId} - Opciones recibidas:`, options?.length || 0);

          if (options && options.length > 0) {
            // Agregar info del vendor a cada opción
            const vendorSlug = vendorItems[0]?.vendorSlug || 'tienda';
            const vendorName = vendorSlug.charAt(0).toUpperCase() + vendorSlug.slice(1);
            const optionsWithVendor = options.map((opt: any) => ({
              ...opt,
              vendorId,
              vendorName,
              price: Math.round(opt.price),
            }));
            newVendorShippingOptions[vendorId] = optionsWithVendor;
            // Seleccionar la primera opción (más barata) por defecto
            newSelectedVendorShipping[vendorId] = optionsWithVendor[0];
          } else {
            // Sin opciones de envío para este vendor
            console.warn(`[SHIPPING] ⚠️ Vendor ${vendorId} - Sin opciones de envío`);
            newVendorShippingOptions[vendorId] = [];
          }
        } catch (error: any) {
          console.error(`[SHIPPING] ❌ Error calculating shipping for vendor ${vendorId}:`, error.message || error);
          newVendorShippingOptions[vendorId] = [];
        }
      }

      setVendorShippingOptions(newVendorShippingOptions);
      setSelectedVendorShipping(newSelectedVendorShipping);

      // Obtener todas las opciones de todos los vendors
      const allOptions: any[] = [];
      Object.entries(newVendorShippingOptions).forEach(([vendorId, options]) => {
        if (options && options.length > 0) {
          allOptions.push(...options);
        }
      });

      // Si hay opciones, establecerlas y seleccionar la primera (más barata)
      if (allOptions.length > 0) {
        setShippingOptions(allOptions);
        setSelectedShipping(allOptions[0]);
      } else {
        setShippingOptions([]);
        setSelectedShipping(null);
      }

    } catch (error) {
      console.error("Error calculating shipping:", error);
      setShippingError("No se pudo calcular el envío. Intente nuevamente.");
    } finally {
      setLoadingShipping(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let { name, value } = e.target;
    
    // Format RUT automatically
    if (name === 'rut') {
      // Remove all non-numeric characters except hyphen
      value = value.replace(/[^\d\-]/g, '');
      
      // Remove existing hyphen to rebuild format
      const cleanRut = value.replace('-', '');
      
      // Apply format based on total length
      if (cleanRut.length > 0) {
        if (cleanRut.length <= 7) {
          // Less than 7 digits, no formatting yet
          value = cleanRut;
        } else if (cleanRut.length === 8) {
          // 7 digits + 1 check digit: format as XXXXXXX-X
          value = cleanRut.substring(0, 7) + '-' + cleanRut.substring(7);
        } else if (cleanRut.length >= 9) {
          // 8+ digits: format as XXXXXXXX-X and ignore extra
          value = cleanRut.substring(0, 8) + '-' + cleanRut.substring(8, 9);
        }
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      alert("No hay productos en el carrito para esta tienda");
      return;
    }

    // Validate form
    if (!formData.name || !formData.email || !formData.phone || !formData.address) {
      alert("Por favor completa todos los campos obligatorios");
      return;
    }

    // Validate region and commune selection
    if (!selectedRegion || !selectedCommune) {
      alert("Por favor selecciona una región y comuna");
      return;
    }

    // Validate payment method selection
    if (!formData.paymentMethod) {
      alert("Por favor selecciona un método de pago");
      return;
    }

    // Validate shipping method selection
    if (!selectedShipping) {
      alert("Por favor selecciona un método de envío");
      return;
    }

    setSubmitting(true);

    try {
      // Find selected commune name
      const selectedCommuneData = communes.find(c => c.id === selectedCommune);
      const selectedRegionData = regions.find(r => r.id === selectedRegion);

      // Enrich cart items with vendorId if missing (legacy items from localStorage)
      let enrichedItems = items;
      const itemsMissingVendorId = items.filter(item => !item.vendorId);
      
      if (itemsMissingVendorId.length > 0) {
        console.log("⚠️ Some items missing vendorId, fetching from API...");
        // Fetch product details to get vendorId
        enrichedItems = await Promise.all(items.map(async (item) => {
          if (item.vendorId) return item;
          try {
            const product = await api.getProduct(item.productId);
            return {
              ...item,
              vendorId: product.vendor?.id || product.vendorId || '',
              vendorSlug: product.vendor?.slug || product.vendorSlug || '',
            };
          } catch (error) {
            console.error("Error fetching product for vendorId:", error);
            return item;
          }
        }));
      }

      // Debug: log cart items to see vendorId
      console.log("🛒 Enriched cart items:", enrichedItems.map(i => ({ 
        productId: i.productId, 
        vendorId: i.vendorId, 
        vendorSlug: i.vendorSlug,
        title: i.title 
      })));

      // Group items by vendorId to create separate orders
      const itemsByVendor: Record<string, typeof enrichedItems> = {};
      for (const item of enrichedItems) {
        const vendorId = item.vendorId;
        if (!vendorId) {
          console.error("❌ Item without vendorId:", item);
          continue;
        }
        if (!itemsByVendor[vendorId]) {
          itemsByVendor[vendorId] = [];
        }
        itemsByVendor[vendorId].push(item);
      }

      const vendorIds = Object.keys(itemsByVendor);
      console.log(`📦 Creating ${vendorIds.length} separate orders for vendors:`, vendorIds);

      if (vendorIds.length === 0) {
        alert("Error: No se encontró información del vendedor. Por favor vacía el carrito y agrega los productos de nuevo.");
        setSubmitting(false);
        return;
      }

      // ⚠️ IMPORTANTE: Si hay múltiples vendedores, NO crear transacciones de pago individuales
      // El pago se creará después con el total combinado
      const isMultiVendorOrder = vendorIds.length > 1;
      const deferPaymentCreation = isMultiVendorOrder && (formData.paymentMethod === 'payku' || formData.paymentMethod === 'flow');
      
      let groupTotal: number | undefined;
      
      if (isMultiVendorOrder) {
        // Calculate total of all orders
        groupTotal = Object.keys(itemsByVendor).reduce((sum, vendorId) => {
          const vendorItems = itemsByVendor[vendorId];
          const vendorSubtotal = vendorItems.reduce((s, item) => s + getCartLineTotal(item), 0);
          const vendorShipping = selectedVendorShipping[vendorId];
          const vendorShippingCost = vendorShipping?.price || 0;
          return sum + vendorSubtotal + vendorShippingCost;
        }, 0);
        
        console.log('🔔 Multi-vendor order detected - generating grouped totals');
        console.log('  💰 Group Total:', groupTotal);
      }
      
      if (deferPaymentCreation) {
        console.log('🔔 Payment creation will be deferred until all orders are created');
      }

      // Create one order per vendor
      const createdOrders: any[] = [];
      
      for (const vendorId of vendorIds) {
        const vendorItems = itemsByVendor[vendorId];
        const vendorSlug = vendorItems[0]?.vendorSlug || '';
        
        // Calculate subtotal for this vendor
        const vendorSubtotal = vendorItems.reduce((sum, item) => sum + getCartLineTotal(item), 0);
        
        // Get shipping cost for this vendor from selectedVendorShipping
        const vendorShipping = selectedVendorShipping[vendorId];
        const vendorShippingCost = vendorShipping?.price || 0;
        
        console.log(`📦 Creating order for vendor ${vendorId}:`, {
          items: vendorItems.length,
          subtotal: vendorSubtotal,
          shipping: vendorShippingCost,
          total: vendorSubtotal + vendorShippingCost
        });

        const currentHostname = typeof window !== 'undefined' ? window.location.hostname : undefined;
        console.log('🌐 [Marketplace Checkout] Vendor', vendorSlug, 'sending hostname:', currentHostname);

        const appliedDiscount = discounts[vendorId]?.fingerprint === discountFingerprint(vendorId, formData.email, vendorItems) ? discounts[vendorId] : undefined;
        const orderData: any = {
          discountCode: appliedDiscount?.code,
          vendorId: String(vendorId),
          vendorSlug,
          originHostname: currentHostname, // Para que Payku redirija al dominio correcto
          isMarketplaceOrder: true,
          items: vendorItems.map(item => ({
            productId: String(item.productId),
            vendorId: String(item.vendorId),
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
          })),
          shippingName: formData.name,
          shippingAddress: formData.address,
          shippingNumber: formData.number,
          shippingCity: selectedCommuneData?.name || '',
          shippingCountry: 'Chile',
          shippingRut: formData.rut,
          shippingPhone: formData.phone,
          shippingRegion: selectedRegionData?.name || '',
          shippingCommune: selectedCommuneData?.name || '',
          shippingRegionId: selectedRegion ? Number(selectedRegion) : undefined,
          shippingCommuneId: selectedCommune ? Number(selectedCommune) : undefined,
          email: formData.email,
          notes: formData.notes,
          paymentMethod: formData.paymentMethod,
          shippingMethod: vendorShipping?.displayMethod || vendorShipping?.method || 'Envío',
          shippingMethodCode: vendorShipping?.methodCode,
          enviaCarrier: vendorShipping?.enviaCarrier,
          enviaService: vendorShipping?.enviaService,
          enviaServiceDescription: vendorShipping?.enviaServiceDescription,
          enviaQuotedPrice: Math.round(Number(vendorShipping?.enviaQuotedPrice ?? vendorShipping?.originalPrice ?? vendorShipping?.price ?? 0)),
          subtotal: Math.round(vendorSubtotal),
          shippingCost: Math.round(vendorShippingCost),
          tax: 0,
          total: Math.round(vendorSubtotal + vendorShippingCost),
          orderSource: 'marketplace' as const,
          // ⚠️ Defer payment creation for multi-vendor orders
          deferPaymentCreation: deferPaymentCreation,
          isMultiVendorOrder: isMultiVendorOrder,
        };

        orderData.checkoutSessionId = createCheckoutSessionId({
          scope: 'marketplace',
          vendorId: String(vendorId),
          vendorSlug,
          items: vendorItems
            .map((item) => ({
              productId: String(item.productId),
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
            }))
            .sort((left, right) => left.productId.localeCompare(right.productId)),
          shippingName: formData.name,
          shippingAddress: formData.address,
          shippingNumber: formData.number,
          shippingCity: selectedCommuneData?.name || '',
          shippingCountry: 'Chile',
          shippingRut: formData.rut,
          shippingPhone: formData.phone,
          shippingRegion: selectedRegionData?.name || '',
          shippingCommune: selectedCommuneData?.name || '',
          shippingRegionId: selectedRegion ? Number(selectedRegion) : undefined,
          shippingCommuneId: selectedCommune ? Number(selectedCommune) : undefined,
          email: formData.email,
          notes: formData.notes,
          paymentMethod: formData.paymentMethod,
          shippingMethod: vendorShipping?.displayMethod || vendorShipping?.method || 'Envío',
          shippingMethodCode: vendorShipping?.methodCode,
          enviaCarrier: vendorShipping?.enviaCarrier,
          enviaService: vendorShipping?.enviaService,
          enviaServiceDescription: vendorShipping?.enviaServiceDescription,
          enviaQuotedPrice: Math.round(Number(vendorShipping?.enviaQuotedPrice ?? vendorShipping?.originalPrice ?? vendorShipping?.price ?? 0)),
          subtotal: Math.round(vendorSubtotal),
          shippingCost: Math.round(vendorShippingCost),
          tax: 0,
          total: Math.round(vendorSubtotal + vendorShippingCost),
          orderSource: 'marketplace' as const,
        });

        if (appliedDiscount) orderData.checkoutSessionId += `_${appliedDiscount.code}`;

        // Only add estimatedDeliveryDays if it's a valid number
        if (vendorShipping?.estimatedDays !== undefined && vendorShipping?.estimatedDays !== null) {
          orderData.estimatedDeliveryDays = Number(vendorShipping.estimatedDays);
        }

        try {
          const order = await api.createOrder(orderData);
          createdOrders.push(order);
          console.log(`✅ Order created for vendor ${vendorId}:`, order.id);
        } catch (error: any) {
          console.error(`❌ Error creating order for vendor ${vendorId}:`, error);
          // If it's a payment config error, preserve the original error
          if (error.details && error.vendorContact) {
            throw error;
          }
          // Otherwise, wrap with context
          throw new Error(error.message || `Error al crear orden para tienda ${vendorSlug}`);
        }
      }

      console.log(`✅ Successfully created ${createdOrders.length} orders`);

      // Save checkout profile for future use
      try {
        const selectedRegionData = regions.find(r => r.id === selectedRegion);
        const selectedCommuneData = communes.find(c => c.id === selectedCommune);
        
        saveProfile({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          rut: formData.rut,
          address: formData.address,
          number: formData.number,
          regionId: selectedRegion,
          regionName: selectedRegionData?.name || '',
          communeId: selectedCommune,
          communeName: selectedCommuneData?.name || '',
          notes: formData.notes,
        });
        console.log('✅ Checkout profile saved');
      } catch (error) {
        console.error('⚠️ Error saving checkout profile:', error);
        // Don't block the checkout process if profile save fails
      }

      // Handle payment for Payku or Flow
      if (formData.paymentMethod === 'payku' || formData.paymentMethod === 'flow') {
        // For multiple orders, create a unified payment transaction
        if (createdOrders.length > 1) {
          const existingPayment = createdOrders.find(order => order.paymentUrl && order.paymentTransactionId);
          if (existingPayment) {
            console.log('💳 Reusing existing multi-order payment URL:', existingPayment.paymentUrl);
            window.location.href = existingPayment.paymentUrl;
            return;
          }

          console.log('💳 Múltiples órdenes - creando transacción de pago unificada');
          
          try {
            const orderIds = createdOrders.map(o => o.id);
            const totalAmount = createdOrders.reduce((sum, o) => sum + o.total, 0);
            
            console.log('💳 Order IDs:', orderIds);
            console.log('💳 Total amount:', totalAmount);
            
            // Call backend to create unified payment
            const currentHostname = typeof window !== 'undefined' ? window.location.hostname : undefined;
            console.log('🌐 [Multi-Order Payment] Sending hostname:', currentHostname, 'for orders:', orderIds);
            
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const response = await fetch(`${apiUrl}/payment/${formData.paymentMethod}/create-multi-order-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                orderIds,
                paymentMethod: formData.paymentMethod,
                originHostname: currentHostname, // Para que Payku redirija al dominio correcto
              }),
            });

            if (!response.ok) {
              throw new Error('Error al crear el pago unificado');
            }

            const paymentData = await response.json();
            
            if (paymentData.paymentUrl) {
              console.log('💳 Redirigiendo a pasarela de pago unificada:', paymentData.paymentUrl);
              window.location.href = paymentData.paymentUrl;
              return;
            } else {
              throw new Error('No se recibió URL de pago');
            }
          } catch (error) {
            console.error('❌ Error al crear pago unificado:', error);
            alert('Error al procesar el pago. Por favor intenta nuevamente.');
            setSubmitting(false);
            return;
          }
        } else {
          // Single order - use the paymentUrl from the order
          const firstOrderWithPaymentUrl = createdOrders.find(order => order.paymentUrl);
          if (firstOrderWithPaymentUrl) {
            console.log('💳 Redirigiendo a pasarela de pago:', firstOrderWithPaymentUrl.paymentUrl);
            window.location.href = firstOrderWithPaymentUrl.paymentUrl;
            return;
          }
        }
      }

      // Clear cart for non-redirect payment methods
      clearCart();

      // Redirect to success page with offer to create account
      const firstOrder = createdOrders[0];
      const successUrl = `/checkout/success?order=${encodeURIComponent(firstOrder.orderNumber)}&email=${encodeURIComponent(formData.email)}`;
      router.push(successUrl);
    } catch (error: any) {
      console.error("Error creating order:", error);
      
      // Check if it's a payment configuration error
      if (error.details && error.vendorContact) {
        alert(`${error.message}\n\n${error.details}`);
      } else if (error.message) {
        alert(error.message);
      } else {
        alert("Error al procesar el pedido. Por favor intenta nuevamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        {renderHeader()}
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">Carrito vacío</h1>
              <p className="text-gray-600 mb-6">No tienes productos en el carrito de esta tienda.</p>
              <Link href={getStoreUrl()}>
                <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a la tienda
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {renderHeader()}
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={getStoreUrl()}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">Finalizar Compra</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form id="checkout-form" onSubmit={handleSubmit}>
              {/* Customer Information */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Información de Envío
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Label htmlFor="name">Nombre Completo *</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={(e) => {
                          handleInputChange(e);
                          const query = e.target.value;
                          if (query.length > 0) {
                            const results = searchProfiles(query);
                            setProfileSearchResults(results);
                            setShowProfileDropdown(results.length > 0);
                          } else {
                            setShowProfileDropdown(false);
                          }
                        }}
                        onFocus={() => {
                          if (formData.name.length > 0) {
                            const results = searchProfiles(formData.name);
                            setProfileSearchResults(results);
                            setShowProfileDropdown(results.length > 0);
                          }
                        }}
                        onBlur={() => {
                          // Delay to allow clicking on dropdown items
                          setTimeout(() => setShowProfileDropdown(false), 200);
                        }}
                        required
                        placeholder="Juan Pérez"
                        autoComplete="off"
                      />
                      {showProfileDropdown && profileSearchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          {profileSearchResults.map((profile) => (
                            <button
                              key={profile.id}
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                              onClick={async () => {
                                // Autofill form data
                                setFormData({
                                  ...formData,
                                  name: profile.name,
                                  email: profile.email,
                                  phone: profile.phone,
                                  rut: profile.rut,
                                  address: profile.address,
                                  number: profile.number,
                                  notes: profile.notes,
                                });
                                
                                // Set region and load communes
                                if (profile.regionId) {
                                  setSelectedRegion(profile.regionId);
                                  setSelectedCommune(null);
                                  
                                  try {
                                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
                                    const response = await fetch(`${apiUrl}/shipping/communes?regionId=${profile.regionId}`);
                                    if (response.ok) {
                                      const data = await response.json();
                                      setCommunes(data);
                                      // Set commune after communes are loaded
                                      if (profile.communeId) {
                                        setTimeout(() => setSelectedCommune(profile.communeId), 100);
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Error loading communes:', error);
                                  }
                                }
                                
                                setShowProfileDropdown(false);
                              }}
                            >
                              <div className="font-medium text-gray-900">{profile.name}</div>
                              <div className="text-sm text-gray-500">{profile.email}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        placeholder="juan@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Teléfono *</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        placeholder="+56 9 1234 5678"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rut">RUT *</Label>
                      <Input
                        id="rut"
                        name="rut"
                        value={formData.rut}
                        onChange={handleInputChange}
                        required
                        placeholder="16563624-4"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="region">Región *</Label>
                      <select
                        id="region"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedRegion || ''}
                        onChange={(e) => {
                          const regionId = e.target.value ? Number(e.target.value) : null;
                          setSelectedRegion(regionId);
                          setSelectedCommune(null);
                          setShippingOptions([]);
                          setSelectedShipping(null);
                        }}
                        required
                      >
                        <option value="">Selecciona una región</option>
                        {regions.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="commune">Comuna *</Label>
                      <select
                        id="commune"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedCommune || ''}
                        onChange={(e) => {
                          const communeId = e.target.value ? Number(e.target.value) : null;
                          setSelectedCommune(communeId);
                        }}
                        required
                        disabled={!selectedRegion}
                      >
                        <option value="">Selecciona una comuna</option>
                        {communes.map((commune) => (
                          <option key={commune.id} value={commune.id}>
                            {commune.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">Dirección (Calle/Avenida) *</Label>
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                      placeholder="Ej: Av. Libertador Bernardo O'Higgins"
                    />
                  </div>

                  <div>
                    <Label htmlFor="number">Número *</Label>
                    <Input
                      id="number"
                      name="number"
                      value={formData.number}
                      onChange={handleInputChange}
                      required
                      maxLength={10}
                      placeholder="Ej: 123, 45-B, S/N"
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Notas del pedido (opcional)</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Instrucciones adicionales para la entrega (Número de Oficina, Departamento, Casa, etc. Ejemplo: Oficina 323, Depto 213) u otra información de complemento."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Options */}
              {/* Debug info - remover en producción */}
              {process.env.NODE_ENV === 'development' && (
                <Card className="mb-4 border-yellow-200 bg-yellow-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-yellow-800">🐛 Debug Info</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-yellow-700 space-y-1">
                    <p><strong>Selected Region:</strong> {selectedRegion || 'null'}</p>
                    <p><strong>Selected Commune:</strong> {selectedCommune || 'null'}</p>
                    <p><strong>Shipping Options:</strong> {shippingOptions.length}</p>
                    <p><strong>Loading Shipping:</strong> {loadingShipping ? 'true' : 'false'}</p>
                    <p><strong>Shipping Error:</strong> {shippingError || 'none'}</p>
                    <button 
                      onClick={() => {
                        console.log('🐛 Debug info:', {
                          selectedRegion,
                          selectedCommune,
                          shippingOptions,
                          vendorShippingOptions,
                          localStorage: {
                            selectedRegionId: localStorage.getItem('selectedRegionId'),
                            selectedComunaId: localStorage.getItem('selectedComunaId'),
                            checkoutSelectedRegion: localStorage.getItem('checkoutSelectedRegion'),
                            checkoutSelectedCommune: localStorage.getItem('checkoutSelectedCommune')
                          }
                        });
                      }}
                      className="text-xs bg-yellow-200 px-2 py-1 rounded hover:bg-yellow-300 mr-2"
                    >
                      Log Full State
                    </button>
                    <button 
                      onClick={() => {
                        sessionStorage.removeItem('shippingCache');
                        if (selectedCommune) {
                          calculateShipping();
                        }
                        console.log('🧹 Cache limpiado y shipping recalculado');
                      }}
                      className="text-xs bg-red-200 px-2 py-1 rounded hover:bg-red-300 mr-2"
                    >
                      Clear Cache & Recalc
                    </button>
                    <button 
                      onClick={() => {
                        const currentRegionId = localStorage.getItem('selectedRegionId');
                        const currentCommuneId = localStorage.getItem('selectedComunaId');
                        console.log('🔄 Forzando sync desde localStorage:', {
                          currentRegionId,
                          currentCommuneId,
                          stateRegion: selectedRegion,
                          stateCommune: selectedCommune
                        });
                        if (currentRegionId) setSelectedRegion(parseInt(currentRegionId));
                        if (currentCommuneId) setSelectedCommune(parseInt(currentCommuneId));
                      }}
                      className="text-xs bg-blue-200 px-2 py-1 rounded hover:bg-blue-300"
                    >
                      Force Sync
                    </button>
                  </CardContent>
                </Card>
              )}
              
              {selectedCommune && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Costo de Envío
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingShipping ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600">Calculando costo de envío...</span>
                      </div>
                    ) : shippingError ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 space-y-2">
                        <p className="font-semibold">Error al calcular el envío</p>
                        <p>{shippingError}</p>
                        <Button variant="outline" size="sm" onClick={calculateShipping}>
                          Reintentar cálculo
                        </Button>
                      </div>
                    ) : Object.keys(vendorShippingOptions).length > 0 ? (
                      <div className="space-y-4">
                        {/* Mostrar desglose por vendor si hay múltiples */}
                        {Object.keys(vendorShippingOptions).length > 1 && (
                          <div className="bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-200">
                            <p className="text-sm font-semibold text-blue-900">
                              Tu pedido incluye productos de {Object.keys(vendorShippingOptions).length} tiendas diferentes
                            </p>
                            <div className="space-y-2">
                              {Object.entries(selectedVendorShipping).map(([vendorId, option]) => (
                                <div key={vendorId} className="flex justify-between items-center text-sm bg-white rounded px-3 py-2">
                                  <span className="font-medium text-gray-700 flex items-center gap-2">
                                    {option?.enviaCarrier && carrierLogos[String(option.enviaCarrier).toLowerCase()] && (
                                      <img
                                        src={carrierLogos[String(option.enviaCarrier).toLowerCase()]}
                                        alt={option?.vendorName || 'Carrier'}
                                        className="w-5 h-5 object-contain rounded bg-white border p-0.5"
                                      />
                                    )}
                                    {option?.vendorName || 'Tienda'}
                                  </span>
                                  <span className="font-semibold text-gray-900">
                                    ${(option?.price || 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Costo total de envío */}
                        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-800">Costo de envío</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Envío calculado automáticamente al mejor precio disponible
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-green-700">
                                ${formatCLP(shippingOptions[0]?.price)}
                              </p>
                              {Object.keys(vendorShippingOptions).length > 1 && (
                                <p className="text-xs text-gray-600 mt-1">Total envío</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : shippingOptions.length > 0 ? (
                      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-800">Costo de envío</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Envío calculado automáticamente
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-700">
                              ${formatCLP(shippingOptions[0]?.price)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No hay opciones de envío disponibles para esta comuna.</p>
                        <p className="text-sm mt-1">Por favor, contacta al vendedor para más información.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Payment Method */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Método de Pago
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingPaymentMethods ? (
                    <div className="text-center py-4 text-gray-500">Cargando métodos de pago...</div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">No hay métodos de pago disponibles</div>
                  ) : (
                    <div className="space-y-3">
                      {paymentMethods.map((method) => (
                        <label 
                          key={method.code}
                          className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method.code}
                            checked={formData.paymentMethod === method.code}
                            onChange={handleInputChange}
                            className="w-4 h-4"
                          />
                          <div>
                            <div className="font-medium">{method.name}</div>
                            <div className="text-sm text-gray-600">{method.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </form>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle>Resumen del Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Products grouped by vendor */}
                {(() => {
                  // Agrupar items por vendorId
                  const itemsByVendor: Record<string, typeof items> = {};
                  items.forEach(item => {
                    const vendorId = item.vendorId || MARKETPLACE_VENDOR_ID;
                    if (!itemsByVendor[vendorId]) {
                      itemsByVendor[vendorId] = [];
                    }
                    itemsByVendor[vendorId].push(item);
                  });

                  return Object.entries(itemsByVendor).map(([vendorId, vendorItems]) => {
                    const vendorName = vendorItems[0]?.vendorSlug 
                      ? vendorItems[0].vendorSlug.charAt(0).toUpperCase() + vendorItems[0].vendorSlug.slice(1)
                      : 'Tienda';

                    return (
                      <div key={vendorId} className="space-y-2 border-b pb-3 last:border-b-0">
                        {/* Vendor header */}
                        <div className="text-xs font-semibold text-gray-600">
                          {vendorName}
                        </div>

                        {/* Vendor products */}
                        <div className="space-y-2">
                          {vendorItems.map((item) => (
                            <div key={item.productId} className="flex items-center gap-2">
                              <div className="w-9 h-9 bg-gray-100 rounded flex-shrink-0">
                                {item.imageUrl ? (
                                  <img
                                    src={getImageUrl(item.imageUrl)}
                                    alt={item.title}
                                    className="w-full h-full object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                    🎵
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p title={item.title} className="font-medium text-sm line-clamp-2 leading-4">{item.title}</p>
                                <p className="text-xs text-gray-500">Cantidad: {Math.max(0, Math.trunc(safeNumber(item.quantity, 0)))}</p>
                              </div>
                              <div className="shrink-0 whitespace-nowrap text-sm font-semibold">
                                ${formatCLP(getCartLineTotal(item))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <details className="text-xs text-gray-600">
                          <summary className="cursor-pointer py-1 hover:text-gray-900">Código de descuento{discounts[vendorId]?.fingerprint === discountFingerprint(vendorId, formData.email, vendorItems) ? `: -$${formatCLP(discounts[vendorId]!.discountAmount)}` : ''}</summary>
                          <DiscountCodeInput vendorId={vendorId} email={formData.email} items={vendorItems} applied={discounts[vendorId]} excludedCodes={Object.entries(discounts).filter(([id, value]) => id !== vendorId && value?.fingerprint === discountFingerprint(id, formData.email, items.filter((item) => (item.vendorId || MARKETPLACE_VENDOR_ID) === id))).map(([, value]) => value!.code)} onChange={(value) => setDiscounts((current) => ({ ...current, [vendorId]: value }))} />
                        </details>
                      </div>
                    );
                  });
                })()}

                {/* Final totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">TOTAL PRODUCTOS</span>
                    <span className="font-semibold">${total.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">TOTAL ENVÍOS</span>
                    {(() => {
                      const totalShipping = Object.values(selectedVendorShipping).reduce((sum, s: any) => sum + (s?.price || 0), 0);
                      return totalShipping > 0 ? (
                        <span className="font-semibold">${totalShipping.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      ) : (
                        <span className="text-gray-500">Por calcular</span>
                      );
                    })()}
                  </div>
                  {totalDiscount > 0 && <div className="flex justify-between text-sm text-emerald-700"><span>DESCUENTOS</span><span>-${formatCLP(totalDiscount)}</span></div>}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>TOTAL A PAGAR</span>
                    <span>${(() => {
                      const totalShipping = Object.values(selectedVendorShipping).reduce((sum, s: any) => sum + (s?.price || 0), 0);
                      return (total - totalDiscount + totalShipping).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    })()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              type="submit"
              form="checkout-form"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-6 text-lg mt-4"
              disabled={submitting || Object.keys(selectedVendorShipping).length === 0}
            >
              {submitting ? "Procesando..." : `Confirmar Pedido - $${(() => {
                const totalShipping = Object.values(selectedVendorShipping).reduce((sum, s: any) => sum + (s?.price || 0), 0);
                return (total - totalDiscount + totalShipping).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              })()}`}
            </Button>
          </div>
        </div>
      </div>
      
      {settings?.footerConfig && (
        <StoreFooter footerConfig={settings.footerConfig} />
      )}
    </div>
  );
}
