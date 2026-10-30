"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { useCheckoutProfiles, CheckoutProfile } from "@/hooks/useCheckoutProfiles";
import { getStoreUrl, getOrderUrl } from "@/lib/useCustomDomain";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import { ArrowLeft, CreditCard, Truck, Package, AlertTriangle } from "lucide-react";
import Link from "next/link";
import HeaderType1 from "@/components/headers/HeaderType1";
import HeaderType2 from "@/components/headers/HeaderType2";
import HeaderType3 from "@/components/headers/HeaderType3";
import StoreFooter from "@/components/StoreFooter";
import { createCheckoutSessionId } from "@/lib/checkout-idempotency";
import { DiscountCodeInput, discountFingerprint, type AppliedDiscount } from "@/components/orders/DiscountCodeInput";

const safeNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const formatCLP = (value: unknown) => safeNumber(value, 0).toLocaleString('es-CL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const getCartLineTotal = (item: any) => safeNumber(item?.price, 0) * Math.max(0, Math.trunc(safeNumber(item?.quantity, 0)));


export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const { items, getTotalPrice, clearCart, removeItem, addItem } = useCart();
  const hasResumedPendingOrderRef = useRef(false);
  
  const [vendor, setVendor] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [discount, setDiscount] = useState<AppliedDiscount | undefined>();
  
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
  
  // Save selected region/commune to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedRegion) {
      localStorage.setItem('checkoutSelectedRegion', selectedRegion.toString());
    }
  }, [selectedRegion]);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedCommune) {
      localStorage.setItem('checkoutSelectedCommune', selectedCommune.toString());
    }
  }, [selectedCommune]);
  
  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);

  // Stock validation state
  const [stockIssues, setStockIssues] = useState<Array<{ productId: string; title: string; available: number; requested: number }>>([]);
  const [checkingStock, setCheckingStock] = useState(false);
  const [resumingOrder, setResumingOrder] = useState(false);
  const [resumeOrderError, setResumeOrderError] = useState<string | null>(null);
  
  // Form state - Load from localStorage on mount
  const [formData, setFormData] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('checkoutFormData');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing saved form data:', e);
        }
      }
    }
    return {
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
    };
  });

  // Filter items for this vendor only
  const vendorItems = items.filter(item => item.vendorSlug === slug);
  const total = vendorItems.reduce((sum, item) => sum + getCartLineTotal(item), 0);
  const appliedDiscount = discount?.fingerprint === discountFingerprint(String(vendor?.id || ''), formData.email || '', vendorItems) ? discount : undefined;
  const discountAmount = appliedDiscount?.discountAmount || 0;
  const resumeOrderId = searchParams.get('resumeOrderId');

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('checkoutFormData', JSON.stringify(formData));
    }
  }, [formData]);

  // DEBUG VERSION 2026-02-01-v2
  useEffect(() => {
    console.log("🛒🛒🛒 [DEBUG V2] Checkout page mounted. Slug:", slug);
    console.log("🛒🛒🛒 [DEBUG V2] Timestamp:", new Date().toISOString());
    loadVendor();
    loadRegions();
    loadPaymentMethods();
    loadCarrierLogos();
    // Check stock on mount
    checkStock();
  }, [slug]);

  useEffect(() => {
    if (selectedRegion) {
      loadCommunesByRegion(selectedRegion);
      // Persistir en localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('checkoutSelectedRegion', selectedRegion.toString());
      }
    }
  }, [selectedRegion]);

  useEffect(() => {
    if (selectedCommune) {
      // Persistir en localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('checkoutSelectedCommune', selectedCommune.toString());
      }
      if (vendor?.id) {
        calculateShipping();
      }
    }
  }, [selectedCommune, vendor]);

  useEffect(() => {
    if (loading || !vendor || !resumeOrderId || hasResumedPendingOrderRef.current) {
      return;
    }

    hasResumedPendingOrderRef.current = true;

    const resumePendingOrder = async () => {
      try {
        setResumingOrder(true);
        setResumeOrderError(null);

        const resumeOrder = await api.getOrder(resumeOrderId);
        if (!resumeOrder) {
          setResumeOrderError('No pudimos recuperar tu pedido pendiente.');
          return;
        }

        if (resumeOrder.vendorSlug !== slug) {
          setResumeOrderError('Este enlace no corresponde a esta tienda.');
          return;
        }

        if (resumeOrder.status !== 'pending') {
          setResumeOrderError('Este pedido ya no esta pendiente.');
          return;
        }

        if (resumeOrder.paymentStatus === 'approved') {
          setResumeOrderError('Este pedido ya fue pagado.');
          return;
        }

        // Replace only current store items and restore pending-order items.
        const currentStoreItems = items.filter((item) => item.vendorSlug === slug);
        currentStoreItems.forEach((item) => removeItem(item.productId));

        const orderItems = Array.isArray(resumeOrder.items) ? resumeOrder.items : [];
        orderItems.forEach((orderItem: any) => {
          const productData = orderItem.product || {};
          const desiredQty = Math.max(1, Number(orderItem.quantity) || 1);
          const stock = Math.max(desiredQty, Number(productData.stock ?? desiredQty) || desiredQty);

          for (let i = 0; i < desiredQty; i++) {
            addItem(
              {
                productId: orderItem.productId,
                title: orderItem.productTitle || productData.title || 'Producto',
                artist: productData.artist || '',
                price: Number(orderItem.price) || 0,
                imageUrl: orderItem.productImage || '',
                stock,
                vendorId: vendor.id,
                vendorSlug: slug,
              },
              false,
            );
          }
        });

        setFormData((prev: any) => ({
          ...prev,
          name: resumeOrder.shippingName || prev.name,
          email: resumeOrder.customerEmail || prev.email,
          phone: resumeOrder.shippingPhone || prev.phone,
          address: resumeOrder.shippingAddress || prev.address,
          number: resumeOrder.shippingNumber || prev.number,
          city: resumeOrder.shippingCity || prev.city,
          country: resumeOrder.shippingCountry || prev.country,
          rut: resumeOrder.shippingRut || prev.rut,
          notes: resumeOrder.notes || prev.notes,
          paymentMethod: resumeOrder.paymentMethod || prev.paymentMethod,
        }));

        if (resumeOrder.shippingRegionId) {
          setSelectedRegion(Number(resumeOrder.shippingRegionId));
        }

        if (resumeOrder.shippingCommuneId) {
          setSelectedCommune(Number(resumeOrder.shippingCommuneId));
        }

        setSelectedShipping(null);
      } catch (error) {
        console.error('[CHECKOUT-TIENDA] Error restoring pending order:', error);
        setResumeOrderError('No pudimos recuperar tu pedido pendiente. Intenta nuevamente.');
      } finally {
        setResumingOrder(false);
      }
    };

    resumePendingOrder();
  }, [loading, vendor, resumeOrderId, slug, items, removeItem, addItem]);

  // Auto-select payment method if only one is available
  useEffect(() => {
    if (paymentMethods.length === 1 && !formData.paymentMethod) {
      setFormData((prev: any) => ({ ...prev, paymentMethod: paymentMethods[0].code }));
      console.log('[CHECKOUT-TIENDA] 🎯 Auto-selected single payment method:', paymentMethods[0].code);
    }
  }, [paymentMethods]);

  // Listener para cambios en la ubicación (cuando se selecciona en el header)
  useEffect(() => {
    console.log('[CHECKOUT-TIENDA] 🎧 INICIANDO listener de ubicación');
    console.log('[CHECKOUT-TIENDA] 🌍 window objeto disponible:', typeof window !== 'undefined');
    
    const handleLocationChange = (event: Event) => {
      console.log('[CHECKOUT-TIENDA] 📍 EVENTO locationChanged recibido!');
      const customEvent = event as CustomEvent;
      const { region, comuna, regionId, comunaId } = customEvent.detail || {};
      console.log('[CHECKOUT-TIENDA] 📍 Datos del evento:', { region, comuna, regionId, comunaId });
      
      if (regionId && comunaId) {
        console.log('[CHECKOUT-TIENDA] 📍 ACTUALIZANDO estado del checkout');
        setSelectedRegion(regionId);
        setSelectedCommune(comunaId);
      } else {
        console.error('[CHECKOUT-TIENDA] ❌ Datos inválidos en evento:', customEvent.detail);
      }
    };

    console.log('[CHECKOUT-TIENDA] 🎯 Registrando addEventListener...');
    window.addEventListener('locationChanged', handleLocationChange);
    console.log('[CHECKOUT-TIENDA] ✅ Listener locationChanged REGISTRADO');

    return () => {
      console.log('[CHECKOUT-TIENDA] 🗑️ LIMPIANDO listener locationChanged');
      window.removeEventListener('locationChanged', handleLocationChange);
    };
  }, []); // Dependencias vacías para que solo se ejecute una vez

  const loadVendor = async () => {
    try {
      console.log("🔍 Loading vendor for slug:", slug);
      const vendorData = await api.getVendorBySlug(slug);
      console.log("✅ Vendor loaded:", vendorData?.id, vendorData?.storeName);
      setVendor(vendorData);
      // Use vendor.id (UUID) instead of slug for settings
      const settingsData = await api.getVendorSettings(vendorData.id, false);
      setSettings(settingsData);
    } catch (error) {
      console.error("❌ Error loading vendor:", error);
    } finally {
      setLoading(false);
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
      setPaymentMethods(methods);
      
      // Auto-select if only one payment method is available
      if (methods.length === 1 && !formData.paymentMethod) {
        setFormData((prev: any) => ({ ...prev, paymentMethod: methods[0].code }));
        console.log('[CHECKOUT-TIENDA] 🎯 Auto-selected payment method:', methods[0].code);
      }
    } catch (error) {
      console.error("Error loading payment methods:", error);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

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

  const loadCommunesByRegion = async (regionId: number) => {
    try {
      const data = await api.getCommunesByRegion(regionId);
      setCommunes(data);
    } catch (error) {
      console.error("Error loading communes:", error);
    }
  };

  // Verify real-time stock for all items before allowing checkout
  const checkStock = async () => {
    if (vendorItems.length === 0) return;
    setCheckingStock(true);
    const issues: Array<{ productId: string; title: string; available: number; requested: number }> = [];
    await Promise.all(
      vendorItems.map(async (item) => {
        try {
          const product = await api.getProduct(item.productId);
          const available = Number(product.stock) || 0;
          if (available === 0 || available < item.quantity) {
            issues.push({
              productId: item.productId,
              title: item.title || product.title || 'Producto',
              available,
              requested: item.quantity,
            });
          }
        } catch (e) {
          // ignore individual errors
        }
      })
    );
    setStockIssues(issues);
    setCheckingStock(false);
  };

  const calculateShipping = async () => {
    if (!selectedCommune || !vendor?.id) return;

    try {
      setLoadingShipping(true);
      setShippingError(null);
      
      // Preparar productos con sus cantidades
      const products = vendorItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      }));
      
      const options = await api.calculateShippingWithProducts({
        vendorId: vendor.id,
        communeId: selectedCommune,
        products,
        declaredValue: total,
      });

      setShippingOptions(options);
      if (options.length > 0) {
        setSelectedShipping({ ...options[0], price: Math.round(options[0].price) });
      }
    } catch (error) {
      console.error("Error calculating shipping:", error);
      const message = error instanceof Error ? error.message : "No se pudo cotizar el envío";
      setShippingError(message);
      setShippingOptions([]);
      setSelectedShipping(null);
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
    
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (vendorItems.length === 0) {
      alert("No hay productos en el carrito para esta tienda");
      return;
    }

    // Validate stock before proceeding
    if (stockIssues.length > 0) {
      alert("Hay productos sin stock disponible. Por favor vuelve al carrito y elimínalos antes de continuar.");
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

    // Validate shipping method selection
    if (!selectedShipping) {
      alert("Por favor selecciona un método de envío");
      return;
    }

    // Validate payment method selection
    if (!formData.paymentMethod) {
      alert("Por favor selecciona un método de pago");
      return;
    }

    // Set Payku method to '99' if not selected (shows all available methods)
    if (formData.paymentMethod === 'payku' && !formData.paykuMethod) {
      formData.paykuMethod = '99';
    }

    setSubmitting(true);

    try {
      // Find selected commune name
      const selectedCommuneData = communes.find(c => c.id === selectedCommune);
      const selectedRegionData = regions.find(r => r.id === selectedRegion);

      // Validate vendor is loaded
      if (!vendor?.id) {
        console.error("Vendor not loaded. Vendor:", vendor, "Slug:", slug);
        alert("Error: No se pudo cargar la información del vendedor. Por favor recarga la página.");
        setSubmitting(false);
        return;
      }

      // Prepare order data with proper type conversions
      const currentHostname = typeof window !== 'undefined' ? window.location.hostname : undefined;
      console.log('🌐 [Checkout] Sending originHostname to backend:', currentHostname);
      
      const orderData: any = {
        discountCode: appliedDiscount?.code,
        vendorId: String(vendor.id),
        vendorSlug: slug,
        originHostname: currentHostname, // Para que Payku redirija al dominio correcto
        items: vendorItems.map(item => ({
          productId: String(item.productId),
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
        shippingCommuneId: selectedCommune ? Number(selectedCommune) : undefined,
        email: formData.email,
        notes: formData.notes,
        paymentMethod: formData.paymentMethod,
        shippingMethod: selectedShipping.method,
        shippingMethodCode: selectedShipping.methodCode,
        // Envia.com fields
        enviaCarrier: selectedShipping.enviaCarrier,
        enviaService: selectedShipping.enviaService,
        enviaServiceDescription: selectedShipping.enviaServiceDescription,
        enviaQuotedPrice: selectedShipping.enviaCarrier
          ? Math.round(Number(selectedShipping.enviaQuotedPrice ?? selectedShipping.originalPrice ?? selectedShipping.price ?? 0))
          : undefined,
        subtotal: Math.round(total),
        shippingCost: Math.round(selectedShipping.price),
        tax: 0,
        total: Math.round(total + selectedShipping.price),
        orderSource: 'marketplace' as const,
      };

      orderData.checkoutSessionId = createCheckoutSessionId({
        scope: 'vendor-store',
        vendorId: String(vendor.id),
        vendorSlug: slug,
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
        shippingCommuneId: selectedCommune ? Number(selectedCommune) : undefined,
        email: formData.email,
        notes: formData.notes,
        paymentMethod: formData.paymentMethod,
        shippingMethod: selectedShipping.method,
        shippingMethodCode: selectedShipping.methodCode,
        enviaCarrier: selectedShipping.enviaCarrier,
        enviaService: selectedShipping.enviaService,
        enviaServiceDescription: selectedShipping.enviaServiceDescription,
        enviaQuotedPrice: selectedShipping.enviaCarrier
          ? Math.round(Number(selectedShipping.enviaQuotedPrice ?? selectedShipping.originalPrice ?? selectedShipping.price ?? 0))
          : undefined,
        subtotal: Math.round(total),
        shippingCost: Math.round(selectedShipping.price),
        tax: 0,
        total: Math.round(total + selectedShipping.price),
        orderSource: 'marketplace',
      });

      if (appliedDiscount) orderData.checkoutSessionId += `_${appliedDiscount.code}`;

      // Only add estimatedDeliveryDays if it's a valid number
      if (selectedShipping.estimatedDays !== undefined && selectedShipping.estimatedDays !== null) {
        orderData.estimatedDeliveryDays = Number(selectedShipping.estimatedDays);
      }

      // Create order via API
      const order = await api.createOrder(orderData);

      // Save checkout profile for future use
      try {
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

      // Check if payment initialization failed
      if (order.paymentStatus === 'payment_error') {
        alert('Error al inicializar el pago. La tienda no tiene configurado correctamente el sistema de pagos. Por favor contacta al vendedor.');
        return;
      }

      // If payment method requires redirect (Flow or Payku) and we have a payment URL, redirect to payment gateway
      if ((formData.paymentMethod === 'flow' || formData.paymentMethod === 'payku') && order.paymentUrl) {
        // Do NOT clear the cart before redirecting to payment gateway to avoid showing "Carrito vacío" transiently.
        window.location.href = order.paymentUrl;
        return;
      }

      // For other payment methods, remove only the items for this vendor and redirect to confirmation page
      vendorItems.forEach(item => {
        removeItem(item.productId);
      });

      router.push(getOrderUrl(slug, order.id));
    } catch (error: any) {
      console.error("Error creating order:", error);
      
      // Check if it's a payment configuration error with detailed info
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

  if (loading || resumingOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Recuperando tu carrito pendiente...</p>
        </div>
      </div>
    );
  }

  // Si estamos procesando (submitting), mostrar loading en lugar del mensaje de carrito vacío
  if (submitting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirigiendo al pago...</p>
        </div>
      </div>
    );
  }

  if (vendorItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">Carrito vacío</h1>
              <p className="text-gray-600 mb-6">No tienes productos en el carrito de esta tienda.</p>
              <Link href={`/tiendas/${slug}`}>
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
      {/* Renderizar Header dinámico */}
      {settings && (
        <>
          {(() => {
            const headerType = settings?.headerType || 1;
            const headerConfig = {
              ...(settings?.headerConfig || {}),
              menus: settings?.menus || {},
              customMenus: settings?.customMenus || {},
              headerConfig: settings?.headerConfig || {},
            };
            switch (headerType) {
              case 1:
                return <HeaderType1 vendor={vendor} config={headerConfig} slug={slug} />;
              case 2:
                return <HeaderType2 vendor={vendor} config={headerConfig} slug={slug} />;
              case 3:
                return <HeaderType3 vendor={vendor} config={headerConfig} slug={slug} />;
              default:
                return <HeaderType1 vendor={vendor} config={headerConfig} slug={slug} />;
            }
          })()}
        </>
      )}
      
      <div className="container mx-auto px-4 py-8">
        {resumeOrderError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {resumeOrderError}
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <Link href={`/tiendas/${slug}`}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a {vendor?.storeName}
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">Finalizar Compra</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            {/* Advertencia de stock */}
            {stockIssues.length > 0 && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
                <p className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  Productos sin stock disponible
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
                <p className="text-sm text-red-600 font-medium">
                  Debes volver al carrito y eliminar estos productos para poder completar tu compra.
                </p>
                <Link href={`/tiendas/${slug}/cart`}>
                  <Button variant="outline" size="sm" className="mt-3 border-red-400 text-red-600 hover:bg-red-50">
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    Volver al carrito
                  </Button>
                </Link>
              </div>
            )}
            <form onSubmit={handleSubmit}>
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
              {selectedCommune && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Opciones de Envío
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Mensaje de descuento activo */}
                    {!loadingShipping && shippingOptions.length > 0 && shippingOptions.some(opt => opt.methodCode === 'free_shipping') && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg flex items-center gap-2">
                        <span className="text-2xl">🎁</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-green-800">
                            ¡Envío Gratis disponible!
                          </p>
                          <p className="text-xs text-green-700">
                            Has alcanzado el monto mínimo para obtener envío completamente gratis
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {!loadingShipping && shippingOptions.length > 0 && shippingOptions.some(opt => opt.hasDiscount) && !shippingOptions.some(opt => opt.methodCode === 'free_shipping') && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                        <span className="text-2xl">🎉</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-green-800">
                            ¡Descuento en envío aplicado!
                          </p>
                          <p className="text-xs text-green-700">
                            Has alcanzado el monto para obtener 50% de descuento en el envío
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {loadingShipping ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-600">Calculando opciones de envío...</span>
                      </div>
                    ) : shippingOptions.length > 0 ? (
                      <div className="space-y-3">
                        {shippingOptions.map((option, index) => (
                          <div
                            key={index}
                            className={`border rounded-lg p-4 cursor-pointer transition-all ${
                              selectedShipping?.method === option.method
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-300 hover:border-blue-400'
                            }`}
                            onClick={() => setSelectedShipping({ ...option, price: Math.round(option.price) })}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  selectedShipping?.method === option.method
                                    ? 'border-blue-600'
                                    : 'border-gray-300'
                                }`}>
                                  {selectedShipping?.method === option.method && (
                                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    {option.enviaCarrier && carrierLogos[String(option.enviaCarrier).toLowerCase()] && (
                                      <img
                                        src={carrierLogos[String(option.enviaCarrier).toLowerCase()]}
                                        alt={option.method}
                                        className="w-7 h-7 object-contain rounded bg-white border p-0.5"
                                      />
                                    )}
                                    <h4 className="font-semibold text-gray-800">{option.method}</h4>
                                    {option.hasDiscount && (
                                      <span className="text-xs font-bold text-white bg-green-500 px-2 py-0.5 rounded">
                                        -{option.discountPercentage}%
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    Entrega estimada: {option.estimatedDays} {option.estimatedDays === 1 ? 'día' : 'días'}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                {option.hasDiscount && option.originalPrice ? (
                                  <div>
                                    <p className="text-sm text-gray-400 line-through">
                                      ${Math.round(option.originalPrice).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </p>
                                    <p className="text-lg font-bold text-green-600">
                                      ${Math.round(option.price).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-lg font-bold text-gray-800">
                                    ${Math.round(option.price).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No hay opciones de envío disponibles para esta comuna.</p>
                        <p className="text-sm mt-1">Por favor, contacta al vendedor para más información.</p>
                      </div>
                    )}

                    {shippingError && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 space-y-2">
                        <p className="font-semibold">Error al cotizar el envío</p>
                        <p>{shippingError}</p>
                        <Button variant="outline" size="sm" onClick={calculateShipping}>
                          Reintentar cotización
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Payment Method */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Método de Pago</CardTitle>
                  <CardDescription>
                    Selecciona cómo deseas pagar tu pedido
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPaymentMethods ? (
                    <div className="text-center py-4 text-gray-500">
                      Cargando métodos de pago...
                    </div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      No hay métodos de pago disponibles
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {paymentMethods.map((method) => (
                        <div key={method.id}>
                          <label
                            className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={method.code}
                              checked={formData.paymentMethod === method.code}
                              onChange={handleInputChange}
                              className="w-4 h-4 text-purple-600"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{method.name}</div>
                              {method.description && (
                                <div className="text-sm text-gray-600">{method.description}</div>
                              )}
                            </div>
                            {method.code === 'flow' && (
                              <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                Tarjetas y Más
                              </div>
                            )}
                          </label>

                          {/* Payku will use code '99' to show all available methods */}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting || !selectedShipping || stockIssues.length > 0}
              >
                {submitting ? "Procesando..." : `Confirmar Pedido - $${(total - discountAmount + (selectedShipping?.price || 0)).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              </Button>
            </form>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Resumen del Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Products */}
                <div className="space-y-3">
                  {vendorItems.map((item) => (
                    <div key={item.productId} className="flex gap-3">
                      <div className="w-16 h-16 bg-gray-100 rounded flex-shrink-0">
                        {item.imageUrl ? (
                          <img
                            src={getImageUrl(item.imageUrl)}
                            alt={item.title}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            🎵
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                        <p className="text-xs text-gray-600">{item.artist}</p>
                        <p className="text-sm text-gray-700">
                          {item.quantity} × ${Math.round(item.price).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div className="font-semibold">
                        ${formatCLP(getCartLineTotal(item))}
                      </div>
                    </div>
                  ))}
                </div>

                {vendor?.id && <DiscountCodeInput vendorId={vendor.id} email={formData.email || ''} items={vendorItems} applied={discount} onChange={setDiscount} />}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>${Math.round(total).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Envío</span>
                    {selectedShipping ? (
                      <span>${Math.round(selectedShipping.price).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    ) : (
                      <span className="text-gray-500">Por calcular</span>
                    )}
                  </div>
                  {discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-700"><span>Descuento</span><span>-${formatCLP(discountAmount)}</span></div>}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total</span>
                    <span>${Math.round(total - discountAmount + (selectedShipping?.price || 0)).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                </div>

                {selectedShipping && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    <p className="font-medium mb-1">📦 Información de entrega</p>
                    <p className="text-xs">
                      Método: {selectedShipping.method} • Entrega estimada: {selectedShipping.estimatedDays} {selectedShipping.estimatedDays === 1 ? 'día' : 'días'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer de la Tienda */}
      <StoreFooter footerConfig={settings?.footerConfig} vendorSlug={slug} />
    </div>
  );
}
