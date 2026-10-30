"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, Plus, Edit, Trash2, Power, PowerOff, DollarSign, Package, ShoppingCart, Truck, Check, X, Percent, Building2, Globe, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import AssistedCommissionFields from "@/components/admin/AssistedCommissionFields";

interface Vendor {
  id: string;
  storeName: string;
  slug: string;
  email: string;
  isActive: boolean;
  paykuClientId?: string;
  paykuAffiliationToken?: string;
  paykuPublicToken?: string;
  paykuWebhookUrl?: string;
  paykuReturnUrl?: string;
  // Envia.com fields
  enviaEnabled?: boolean;
  enviaOriginName?: string;
  enviaOriginPhone?: string;
  enviaOriginStreet?: string;
  enviaOriginCity?: string;
  enviaOriginState?: string;
  enviaOriginCountry?: string;
  enviaOriginPostalCode?: string;
  enviaEnabledCarriers?: string[];
  aiImageGenerationEnabled?: boolean;
  // Commission settings
  settings?: {
    isWholesaleEnabled?: boolean;
    isWholesaleEnabledByAdmin?: boolean;
    commissionPercentage?: number;
    wholesaleCommissionPercentage?: number;
  };
  stats?: {
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
  };
}

export default function ListarVendedoresPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'payku' | 'envia' | 'delete' | 'commission'>('edit');
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [loadingModalData, setLoadingModalData] = useState(false);
  
  const [formData, setFormData] = useState({
    storeName: "",
    slug: "",
    email: "",
    isActive: true,
    publishInMarketplace: true,
    // Campos de envÃ­o Envia.com (obligatorios al crear)
    enviaOriginName: "",
    enviaOriginPhone: "",
    enviaOriginStreet: "",
    enviaOriginCity: "",
    enviaOriginState: "",
    enviaOriginPostalCode: "",
  });
  
  // Estados para regiÃ³n/comuna en formulario de creaciÃ³n
  const [createRegions, setCreateRegions] = useState<any[]>([]);
  const [createCommunes, setCreateCommunes] = useState<any[]>([]);
  const [createSelectedRegionId, setCreateSelectedRegionId] = useState<number | null>(null);
  const [createSelectedCommuneId, setCreateSelectedCommuneId] = useState<number | null>(null);

  const [paykuFormData, setPaykuFormData] = useState({
    paykuPublicToken: "",
    paykuWebhookUrl: "",
    paykuReturnUrl: "",
  });

  const [commissionFormData, setCommissionFormData] = useState({
    assistedCommissionType: 'percentage',
    assistedCommissionPercentage: 10,
    assistedCommissionFixedAmount: 0,
    commissionPercentage: 10,
    wholesaleCommissionPercentage: 5,
    isWholesaleEnabledByAdmin: true,
  });

  // Envia.com form data
  const [enviaFormData, setEnviaFormData] = useState({
    enabled: false,
    originName: "",
    originPhone: "",
    originStreet: "",
    originCity: "",
    originState: "",
    originPostalCode: "",
    originRegionId: null as number | null,
    originCommuneId: null as number | null,
    enabledCarriers: [] as string[],
  });
  const [enviaCarriers, setEnviaCarriers] = useState<Array<{code: string; name: string}>>([]);
  const [testingEnviaQuote, setTestingEnviaQuote] = useState(false);
  const [enviaQuoteResult, setEnviaQuoteResult] = useState<any>(null);
  
  // Estados para regiones y comunas dinÃ¡micas
  const [enviaRegions, setEnviaRegions] = useState<any[]>([]);
  const [enviaCommunesForRegion, setEnviaCommunesForRegion] = useState<any[]>([]);
  const [enviaSelectedRegionId, setEnviaSelectedRegionId] = useState<number | null>(null);
  const [enviaSelectedCommuneId, setEnviaSelectedCommuneId] = useState<number | null>(null);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/marketplace/vendors`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cargar estadÃ­sticas para cada vendor
      const vendorsWithStats = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (vendor: Vendor) => {
          try {
            const statsResponse = await fetch(`${apiUrl}/vendors/${vendor.id}/stats`);
            if (statsResponse.ok) {
              const stats = await statsResponse.json();
              return { ...vendor, stats };
            }
          } catch (error) {
            console.error(`Error loading stats for vendor ${vendor.id}:`, error);
          }
          return vendor;
        })
      );
      
      setVendors(vendorsWithStats);
    } catch (error) {
      console.error('Error loading vendors:', error);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = async (mode: 'create' | 'edit' | 'payku' | 'envia' | 'delete' | 'commission', vendor: Vendor | null = null) => {
    setModalMode(mode);
    setSelectedVendor(vendor);
    setConnectionStatus('idle');
    setEnviaQuoteResult(null);
    
    if (mode === 'create') {
      setFormData({
        storeName: "",
        slug: "",
        email: "",
        isActive: true,
        publishInMarketplace: true,
        enviaOriginName: "",
        enviaOriginPhone: "",
        enviaOriginStreet: "",
        enviaOriginCity: "",
        enviaOriginState: "",
        enviaOriginPostalCode: "",
      });
      setCreateSelectedRegionId(null);
      setCreateSelectedCommuneId(null);
      setCreateCommunes([]);
      // Cargar regiones para el formulario de creaciÃ³n
      loadRegionsForCreate();
    } else if (mode === 'edit' && vendor) {
      // Cargar configuraciÃ³n del vendedor
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('token');
      
      try {
        const response = await fetch(`${apiUrl}/vendors/${vendor.id}/settings`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const settings = await response.json();
          setFormData({
            storeName: vendor.storeName,
            slug: vendor.slug,
            email: vendor.email,
            isActive: vendor.isActive,
            publishInMarketplace: settings.publishInMarketplace !== false,
            enviaOriginName: vendor.enviaOriginName || "",
            enviaOriginPhone: vendor.enviaOriginPhone || "",
            enviaOriginStreet: vendor.enviaOriginStreet || "",
            enviaOriginCity: vendor.enviaOriginCity || "",
            enviaOriginState: vendor.enviaOriginState || "",
            enviaOriginPostalCode: vendor.enviaOriginPostalCode || "",
          });
        } else {
          // Si falla la carga, usar valor por defecto
          setFormData({
            storeName: vendor.storeName,
            slug: vendor.slug,
            email: vendor.email,
            isActive: vendor.isActive,
            publishInMarketplace: true,
            enviaOriginName: vendor.enviaOriginName || "",
            enviaOriginPhone: vendor.enviaOriginPhone || "",
            enviaOriginStreet: vendor.enviaOriginStreet || "",
            enviaOriginCity: vendor.enviaOriginCity || "",
            enviaOriginState: vendor.enviaOriginState || "",
            enviaOriginPostalCode: vendor.enviaOriginPostalCode || "",
          });
        }
      } catch (error) {
        console.error('Error loading vendor settings:', error);
        setFormData({
          storeName: vendor.storeName,
          slug: vendor.slug,
          email: vendor.email,
          isActive: vendor.isActive,
          publishInMarketplace: true,
          enviaOriginName: vendor.enviaOriginName || "",
          enviaOriginPhone: vendor.enviaOriginPhone || "",
          enviaOriginStreet: vendor.enviaOriginStreet || "",
          enviaOriginCity: vendor.enviaOriginCity || "",
          enviaOriginState: vendor.enviaOriginState || "",
          enviaOriginPostalCode: vendor.enviaOriginPostalCode || "",
        });
      }
    } else if (mode === 'payku' && vendor) {
      setPaykuFormData({
        paykuPublicToken: vendor.paykuPublicToken || "",
        paykuWebhookUrl: vendor.paykuWebhookUrl || "",
        paykuReturnUrl: vendor.paykuReturnUrl || "",
      });
    } else if (mode === 'envia' && vendor) {
      // Resetear estado inicial
      setEnviaFormData({
        enabled: false,
        originName: "",
        originPhone: "",
        originStreet: "",
        originCity: "",
        originState: "",
        originPostalCode: "",
        originRegionId: null,
        originCommuneId: null,
        enabledCarriers: [],
      });
      setEnviaCarriers([]);
      setEnviaRegions([]);
      setEnviaCommunesForRegion([]);
      setEnviaSelectedRegionId(null);
      setEnviaSelectedCommuneId(null);
    } else if (mode === 'commission' && vendor) {
      // Resetear estado inicial
      setCommissionFormData({
        assistedCommissionType: 'percentage',
        assistedCommissionPercentage: 10,
        assistedCommissionFixedAmount: 0,
        commissionPercentage: 10,
        wholesaleCommissionPercentage: 5,
        isWholesaleEnabledByAdmin: true,
      });
    }
    
    // Abrir el modal inmediatamente
    setShowModal(true);
    
    // Cargar datos asÃ­ncronamente DESPUÃ‰S de abrir el modal
    if (mode === 'envia' && vendor) {
      setLoadingModalData(true);
      loadEnviaModalData(vendor).finally(() => setLoadingModalData(false));
    } else if (mode === 'commission' && vendor) {
      setLoadingModalData(true);
      loadCommissionModalData(vendor).finally(() => setLoadingModalData(false));
    }
  };

  // FunciÃ³n separada para cargar datos de Envia.com
  const loadEnviaModalData = async (vendor: Vendor) => {
    // Cargar carriers disponibles
    try {
      const carriers = await api.getEnviaCarriers();
      setEnviaCarriers(carriers);
    } catch (error) {
      console.error('Error loading Envia carriers:', error);
    }
    
    // Cargar regiones para el select
    let loadedRegions: any[] = [];
    try {
      loadedRegions = await api.getShippingRegions();
      setEnviaRegions(loadedRegions);
    } catch (error) {
      console.error('Error loading regions:', error);
    }
    
    // Cargar config del vendor desde API
    try {
      const config = await api.getEnviaVendorConfig(vendor.id);
      console.log('[ENVIA DEBUG] Config received:', config);
      console.log('[ENVIA DEBUG] regionId:', config.origin?.regionId);
      console.log('[ENVIA DEBUG] communeId:', config.origin?.communeId);
      
      setEnviaFormData({
        enabled: config.enabled || false,
        originName: config.origin?.name || "",
        originPhone: config.origin?.phone || "",
        originStreet: config.origin?.street || "",
        originCity: config.origin?.city || "",
        originState: config.origin?.state || "",
        originPostalCode: config.origin?.postalCode || "",
        originRegionId: config.origin?.regionId || null,
        originCommuneId: config.origin?.communeId || null,
        enabledCarriers: config.enabledCarriers || [],
      });
      
      // Si hay regionId y communeId guardados, cargar directamente
      if (config.origin?.regionId && config.origin?.communeId) {
        console.log('[ENVIA DEBUG] Using FAST path with IDs');
        setEnviaSelectedRegionId(config.origin.regionId);
        setEnviaSelectedCommuneId(config.origin.communeId);
        
        // Cargar comunas de esa regiÃ³n para el dropdown
        try {
          const communes = await api.getCommunesByRegion(config.origin.regionId);
          setEnviaCommunesForRegion(communes);
          console.log('[ENVIA DEBUG] FAST path completed');
        } catch (error) {
          console.error('Error loading communes for region:', error);
        }
      }
      // Fallback: Si no hay IDs pero hay ciudad, buscar (mÃ©todo antiguo)
      else if (config.origin?.city && loadedRegions.length > 0) {
        console.log('[ENVIA DEBUG] Using SLOW fallback path - no IDs found');
        await loadCommuneFromCity(config.origin.city, loadedRegions);
      }
    } catch (error) {
      console.error('Error loading Envia vendor config:', error);
    }
  };

  // FunciÃ³n separada para cargar datos de comisiones
  const loadCommissionModalData = async (vendor: Vendor) => {
    try {
      const settings = await api.getVendorSettings(vendor.id);
      setCommissionFormData({
        assistedCommissionType: settings?.assistedCommissionType ?? 'percentage',
        assistedCommissionPercentage: Number(settings?.assistedCommissionPercentage ?? 10),
        assistedCommissionFixedAmount: Number(settings?.assistedCommissionFixedAmount ?? 0),
        commissionPercentage: settings?.commissionPercentage ?? 10,
        wholesaleCommissionPercentage: settings?.wholesaleCommissionPercentage ?? 5,
        isWholesaleEnabledByAdmin: settings?.isWholesaleEnabledByAdmin ?? true,
      });
    } catch (error) {
      console.error('Error loading vendor settings:', error);
    }
  };
  
  // Cargar regiones para formulario de creaciÃ³n
  const loadRegionsForCreate = async () => {
    try {
      const regions = await api.getShippingRegions();
      setCreateRegions(regions);
    } catch (error) {
      console.error('Error loading regions:', error);
    }
  };
  
  // Manejar cambio de regiÃ³n en formulario de creaciÃ³n
  const handleCreateRegionChange = async (regionId: number) => {
    setCreateSelectedRegionId(regionId);
    setCreateSelectedCommuneId(null);
    setCreateCommunes([]);
    
    const region = createRegions.find(r => r.id === regionId);
    if (region) {
      setFormData(prev => ({
        ...prev,
        enviaOriginState: region.code,
        enviaOriginCity: "",
        enviaOriginPostalCode: "",
      }));
      
      try {
        const communes = await api.getCommunesByRegion(regionId);
        setCreateCommunes(communes);
      } catch (error) {
        console.error('Error loading communes:', error);
      }
    }
  };
  
  // Manejar cambio de comuna en formulario de creaciÃ³n
  const handleCreateCommuneChange = (communeId: number) => {
    setCreateSelectedCommuneId(communeId);
    
    const commune = createCommunes.find((c: any) => c.id === communeId);
    if (commune) {
      setFormData(prev => ({
        ...prev,
        enviaOriginCity: commune.name,
        enviaOriginPostalCode: commune.enviaPostalCode || "",
      }));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedVendor(null);
    setModalMode('edit');
  };

  const handleCreateOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('token');
      
      if (modalMode === 'create') {
        // Crear vendor
        const response = await fetch(`${apiUrl}/vendors/admin/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result.temporaryPassword) {
            alert(
              `Tienda creada correctamente!\n\n` +
              `Se ha enviado un email a ${formData.email} con las credenciales.\n\n` +
              `ContraseÃ±a temporal (guÃ¡rdala):\n${result.temporaryPassword}\n\n` +
              `El vendedor deberÃ¡ cambiar esta contraseÃ±a en su primer inicio de sesiÃ³n.`
            );
          }
          
          loadVendors();
          closeModal();
        } else {
          const error = await response.json();
          alert(`Error: ${error.message || 'No se pudo crear la tienda'}`);
        }
      } else {
        // Editar vendor - actualizar datos bÃ¡sicos
        const { publishInMarketplace, ...vendorData } = formData;
        
        const vendorResponse = await fetch(`${apiUrl}/vendors/${selectedVendor?.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(vendorData),
        });

        if (!vendorResponse.ok) {
          const error = await vendorResponse.json();
          throw new Error(error.message || 'No se pudo actualizar la tienda');
        }

        // Actualizar settings (publishInMarketplace)
        const settingsResponse = await fetch(`${apiUrl}/vendors/${selectedVendor?.id}/settings`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ publishInMarketplace }),
        });

        if (!settingsResponse.ok) {
          const error = await settingsResponse.json();
          throw new Error(error.message || 'No se pudo actualizar la configuraciÃ³n');
        }

        alert("Tienda actualizada correctamente");
        loadVendors();
        closeModal();
      }
    } catch (error: any) {
      console.error("Error saving vendor:", error);
      alert(error.message || "Error al guardar la tienda");
    } finally {
      setSaving(false);
    }
  };

  const handlePaykuConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVendor) return;

    try {
      setSaving(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(
        `${apiUrl}/vendors/${selectedVendor.id}/settings`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(paykuFormData),
        }
      );

      if (response.ok) {
        alert("ConfiguraciÃ³n de Payku actualizada correctamente");
        loadVendors();
        closeModal();
      } else {
        alert("Error al actualizar configuraciÃ³n de Payku");
      }
    } catch (error) {
      console.error("Error updating Payku config:", error);
      alert("Error al actualizar configuraciÃ³n");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedVendor) return;

    try {
      setSaving(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(
        `${apiUrl}/vendors/${selectedVendor.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        alert("Tienda eliminada correctamente");
        loadVendors();
        closeModal();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'No se pudo eliminar la tienda'}`);
      }
    } catch (error) {
      console.error("Error deleting vendor:", error);
      alert("Error al eliminar la tienda");
    } finally {
      setSaving(false);
    }
  };

  // Envia.com handlers
  const handleEnviaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVendor) return;

    // Validar campos obligatorios
    if (!enviaFormData.originName?.trim()) {
      alert("âŒ El nombre de contacto es obligatorio");
      return;
    }
    
    if (!enviaFormData.originPhone?.trim()) {
      alert("âŒ El telÃ©fono es obligatorio");
      return;
    }
    
    if (!enviaFormData.originStreet?.trim()) {
      alert("âŒ La calle y nÃºmero son obligatorios");
      return;
    }
    
    if (!enviaSelectedRegionId) {
      alert("âŒ Debe seleccionar una regiÃ³n");
      return;
    }
    
    if (!enviaSelectedCommuneId) {
      alert("âŒ Debe seleccionar una comuna");
      return;
    }

    try {
      setSaving(true);
      
      console.log('[ENVIA SAVE] enviaSelectedRegionId:', enviaSelectedRegionId);
      console.log('[ENVIA SAVE] enviaSelectedCommuneId:', enviaSelectedCommuneId);
      
      const configToSend = {
        enabled: true, // Envia.com siempre habilitado (es el Ãºnico mÃ©todo de envÃ­o)
        origin: {
          name: enviaFormData.originName,
          phone: enviaFormData.originPhone,
          street: enviaFormData.originStreet,
          city: enviaFormData.originCity,
          state: enviaFormData.originState,
          country: 'CL',
          postalCode: enviaFormData.originPostalCode,
          regionId: enviaSelectedRegionId, // Usar el estado del dropdown, no del formData
          communeId: enviaSelectedCommuneId, // Usar el estado del dropdown, no del formData
        },
        enabledCarriers: enviaFormData.enabledCarriers,
      };
      
      console.log('[ENVIA SAVE] configToSend:', JSON.stringify(configToSend, null, 2));
      
      await api.updateEnviaVendorConfig(selectedVendor.id, configToSend);
      
      alert("âœ… ConfiguraciÃ³n de Envia.com actualizada correctamente");
      loadVendors();
      closeModal();
    } catch (error: any) {
      console.error("Error updating Envia.com config:", error);
      alert(`âŒ Error: ${error.message || 'No se pudo actualizar la configuraciÃ³n'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestEnviaQuote = async () => {
    if (!selectedVendor) return;
    
    try {
      setTestingEnviaQuote(true);
      setEnviaQuoteResult(null);
      
      const result = await api.testEnviaVendorQuote(selectedVendor.id);
      setEnviaQuoteResult(result);
      
      if (result.success) {
        alert(`âœ… CotizaciÃ³n exitosa: ${result.options?.length || 0} opciones encontradas`);
      } else {
        alert(`âŒ Error: ${result.message}`);
      }
    } catch (error: any) {
      console.error("Error testing Envia.com quote:", error);
      setEnviaQuoteResult({ success: false, message: error.message });
      alert(`âŒ Error: ${error.message}`);
    } finally {
      setTestingEnviaQuote(false);
    }
  };

  const toggleEnviaCarrier = (carrierCode: string) => {
    setEnviaFormData(prev => {
      const carriers = prev.enabledCarriers.includes(carrierCode)
        ? prev.enabledCarriers.filter(c => c !== carrierCode)
        : [...prev.enabledCarriers, carrierCode];
      return { ...prev, enabledCarriers: carriers };
    });
  };
  
  // FunciÃ³n para cargar comuna desde ciudad guardada (FALLBACK para datos antiguos sin IDs)
  // NOTA: Este mÃ©todo es lento (itera todas las regiones). Los nuevos datos usan regionId/communeId directamente
  const loadCommuneFromCity = async (cityName: string, regions: any[]) => {
    try {
      // Buscar en todas las regiones la comuna con ese nombre
      for (const region of regions) {
        const communes = await api.getCommunesByRegion(region.id);
        
        const foundCommune = communes.find((c: any) => 
          c.name.toLowerCase() === cityName.toLowerCase()
        );
        
        if (foundCommune) {
          setEnviaSelectedRegionId(region.id);
          setEnviaCommunesForRegion(communes);
          setEnviaSelectedCommuneId(foundCommune.id);
          // Actualizar state y postal code automÃ¡ticamente
          setEnviaFormData(prev => ({
            ...prev,
            originState: region.code,
            originPostalCode: foundCommune.enviaPostalCode || "",
            originRegionId: region.id,
            originCommuneId: foundCommune.id,
          }));
          break;
        }
      }
    } catch (error) {
      console.error('Error loading commune from city:', error);
    }
  };
  
  // Manejar cambio de regiÃ³n
  const handleEnviaRegionChange = async (regionId: number) => {
    setEnviaSelectedRegionId(regionId);
    setEnviaSelectedCommuneId(null);
    setEnviaCommunesForRegion([]);
    
    // Buscar el cÃ³digo de regiÃ³n
    const region = enviaRegions.find(r => r.id === regionId);
    if (region) {
      setEnviaFormData(prev => ({
        ...prev,
        originState: region.code,
        originCity: "",
        originPostalCode: "",
        originRegionId: regionId,
        originCommuneId: null,
      }));
      
      // Cargar comunas de esta regiÃ³n
      try {
        const communes = await api.getCommunesByRegion(regionId);
        setEnviaCommunesForRegion(communes);
      } catch (error) {
        console.error('Error loading communes:', error);
      }
    }
  };
  
  // Manejar cambio de comuna
  const handleEnviaCommuneChange = (communeId: number) => {
    setEnviaSelectedCommuneId(communeId);
    
    // Buscar la comuna y auto-rellenar cÃ³digo postal
    const commune = enviaCommunesForRegion.find((c: any) => c.id === communeId);
    if (commune) {
      setEnviaFormData(prev => ({
        ...prev,
        originCity: commune.name,
        originPostalCode: commune.enviaPostalCode || "",
        originCommuneId: communeId,
      }));
    }
  };

  const handleCommissionConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVendor) return;

    try {
      setSaving(true);
      
      await api.updateVendorSettings(selectedVendor.id, {
        commissionPercentage: Number(commissionFormData.commissionPercentage),
        assistedCommissionType: commissionFormData.assistedCommissionType,
        assistedCommissionPercentage: commissionFormData.assistedCommissionPercentage,
        assistedCommissionFixedAmount: commissionFormData.assistedCommissionFixedAmount,
        wholesaleCommissionPercentage: Number(commissionFormData.wholesaleCommissionPercentage),
        isWholesaleEnabledByAdmin: commissionFormData.isWholesaleEnabledByAdmin,
      });
      
      alert("âœ… ConfiguraciÃ³n de comisiones actualizada correctamente");
      loadVendors();
      closeModal();
    } catch (error: any) {
      console.error("Error updating commission config:", error);
      alert(`âŒ Error: ${error.message || 'No se pudo actualizar la configuraciÃ³n'}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleAiImagesAccess = async (vendor: Vendor) => {
    try {
      const nextEnabled = !vendor.aiImageGenerationEnabled;
      await api.setVendorAiImagesAccess(vendor.id, nextEnabled);
      setVendors(prev => prev.map(item =>
        item.id === vendor.id ? { ...item, aiImageGenerationEnabled: nextEnabled } : item
      ));
    } catch (error: any) {
      console.error('Error updating AI images access:', error);
      alert(error.message || 'No se pudo actualizar el acceso a IA');
    }
  };
  const toggleVendorStatus = async (vendor: Vendor) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(
        `${apiUrl}/vendors/${vendor.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ isActive: !vendor.isActive }),
        }
      );

      if (response.ok) {
        alert(`Tienda ${!vendor.isActive ? 'activada' : 'desactivada'} correctamente`);
        loadVendors();
      } else {
        alert("Error al cambiar el estado de la tienda");
      }
    } catch (error) {
      console.error("Error toggling vendor status:", error);
      alert("Error al cambiar el estado");
    }
  };

  const generateSlug = (storeName: string) => {
    return storeName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">AdministraciÃ³n de Tiendas</h1>
          <p className="text-gray-600 mt-2">Gestiona todas las tiendas del marketplace</p>
        </div>
        <Button
          onClick={() => openModal('create')}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Tienda
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Tiendas Registradas
          </CardTitle>
          <CardDescription>
            {vendors.length} {vendors.length === 1 ? 'tienda registrada' : 'tiendas registradas'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Cargando tiendas...</p>
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay tiendas registradas</p>
              <Button
                onClick={() => openModal('create')}
                variant="outline"
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Tienda
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{vendor.storeName}</h3>
                        <Badge variant={vendor.isActive ? "default" : "secondary"}>
                          {vendor.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                        {vendor.paykuPublicToken && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Payku âœ“
                          </Badge>
                        )}
                        {vendor.aiImageGenerationEnabled && (
                          <Badge variant="outline" className="text-blue-600 border-blue-600">
                            IA imágenes
                          </Badge>
                        )}
                        {vendor.enviaEnabled && (
                          <Badge variant="outline" className="text-purple-600 border-purple-600">
                            Envia.com âœ“
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Slug: <span className="font-mono text-gray-900">/{vendor.slug}</span></p>
                        <p>Email: {vendor.email || "-"}</p>
                      </div>
                      
                      {vendor.stats && (
                        <div className="flex gap-6 mt-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold">{vendor.stats.totalProducts}</span>
                            <span className="text-gray-600">productos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-green-600" />
                            <span className="font-semibold">{vendor.stats.totalOrders}</span>
                            <span className="text-gray-600">Ã³rdenes</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-purple-600" />
                            <span className="font-semibold">${vendor.stats.totalRevenue?.toLocaleString() || 0}</span>
                            <span className="text-gray-600">ingresos</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Link href={`/panel/vendedores/${vendor.id}/configurar`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Configurar
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openModal('envia', vendor)}
                        className="text-indigo-600 hover:text-indigo-700"
                      >
                        <Globe className="w-4 h-4 mr-1" />
                        Envia.com
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openModal('commission', vendor)}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        <Percent className="w-4 h-4 mr-1" />
                        Comisiones
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleAiImagesAccess(vendor)}
                        className={vendor.aiImageGenerationEnabled ? "text-blue-600 hover:text-blue-700" : "text-gray-600 hover:text-gray-700"}
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        {vendor.aiImageGenerationEnabled ? "Desactivar IA" : "Activar IA"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleVendorStatus(vendor)}
                        className={vendor.isActive ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                      >
                        {vendor.isActive ? (
                          <>
                            <PowerOff className="w-4 h-4 mr-1" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <Power className="w-4 h-4 mr-1" />
                            Activar
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openModal('delete', vendor)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {modalMode === 'create' && "Crear Nueva Tienda"}
                {modalMode === 'edit' && "Editar Tienda"}
                {modalMode === 'payku' && "Configurar Payku"}
                {modalMode === 'envia' && "Configurar Envia.com"}
                {modalMode === 'commission' && "Configurar Comisiones"}
                {modalMode === 'delete' && "Eliminar Tienda"}
              </h2>
              {selectedVendor && modalMode !== 'create' && (
                <p className="text-sm text-gray-600 mt-1">{selectedVendor.storeName}</p>
              )}
            </div>
            
            {modalMode === 'delete' ? (
              <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-red-800 font-semibold mb-2">âš ï¸ Advertencia</p>
                  <p className="text-red-700 text-sm">
                    Esta acciÃ³n eliminarÃ¡ permanentemente la tienda <strong>{selectedVendor?.storeName}</strong> y todos sus datos asociados (productos, Ã³rdenes, configuraciones, etc.).
                  </p>
                  <p className="text-red-700 text-sm mt-2">
                    Esta acciÃ³n no se puede deshacer.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleDelete}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    disabled={saving}
                  >
                    {saving ? "Eliminando..." : "SÃ­, Eliminar Tienda"}
                  </Button>
                </div>
              </div>
            ) : modalMode === 'payku' ? (
              <form onSubmit={handlePaykuConfig} className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-semibold text-blue-900 mb-2">ðŸ“‹ Credenciales de Payku (AfiliaciÃ³n)</p>
                  <p className="text-blue-800 text-sm mb-3">
                    Configura la afiliaciÃ³n de Payku para que esta tienda pueda recibir pagos.
                  </p>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p><strong>Importante:</strong> El vendedor debe crear una afiliaciÃ³n en su panel de Payku.</p>
                    <p>El marketplace se encarga de la configuraciÃ³n global de Payku.</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="paykuPublicToken">
                    Token PÃºblico de AfiliaciÃ³n <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="paykuPublicToken"
                    value={paykuFormData.paykuPublicToken}
                    onChange={(e) => setPaykuFormData({ ...paykuFormData, paykuPublicToken: e.target.value })}
                    placeholder="Ej: eecd92fdbb8bf615e8215d6f..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    El "TOKEN PÃšBLICO" que aparece en la afiliaciÃ³n del vendedor
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">URLs de ConfirmaciÃ³n de Pago</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="paykuWebhookUrl">
                        URL de Webhook
                      </Label>
                      <Input
                        id="paykuWebhookUrl"
                        value={paykuFormData.paykuWebhookUrl}
                        onChange={(e) => setPaykuFormData({ ...paykuFormData, paykuWebhookUrl: e.target.value })}
                        placeholder="Dejar vacÃ­o para usar configuraciÃ³n global"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        URL donde Payku enviarÃ¡ la confirmaciÃ³n del pago. Si estÃ¡ vacÃ­o, usa la configuraciÃ³n global del marketplace.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="paykuReturnUrl">
                        URL de Retorno
                      </Label>
                      <Input
                        id="paykuReturnUrl"
                        value={paykuFormData.paykuReturnUrl}
                        onChange={(e) => setPaykuFormData({ ...paykuFormData, paykuReturnUrl: e.target.value })}
                        placeholder="https://cdmania.mundobeat.cl/pedido/{orderId}"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        URL donde el cliente serÃ¡ redirigido despuÃ©s del pago. Usa {"{orderId}"} como placeholder.
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 border rounded-lg p-3 mt-4 text-sm">
                    <p className="font-semibold mb-2">ðŸ’¡ Ejemplos:</p>
                    <div className="space-y-1 text-gray-700">
                      <p><strong>Local:</strong></p>
                      <p className="font-mono text-xs">http://localhost:3001/api/payment/payku/webhook</p>
                      <p className="font-mono text-xs">http://localhost:3000/tiendas/cdmania/pedido/{"{orderId}"}</p>
                      <p className="mt-2"><strong>ProducciÃ³n:</strong></p>
                      <p className="font-mono text-xs">http://localhost:3001/payment/payku/webhook</p>
                      <p className="font-mono text-xs">https://cdmania.mundobeat.cl/pedido/{"{orderId}"}</p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4 text-sm">
                    <p className="text-yellow-800">
                      <strong>ðŸ“ Nota:</strong> Payku siempre redirige a la URL de retorno, independientemente del resultado del pago. 
                      El estado real se verifica desde la base de datos (actualizada por el webhook).
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar ConfiguraciÃ³n"}
                  </Button>
                </div>
              </form>
            ) : modalMode === 'commission' ? (
              <form onSubmit={handleCommissionConfig} className="p-6 space-y-4">
                {loadingModalData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <p className="text-blue-800 text-sm">Cargando configuraciÃ³n...</p>
                  </div>
                )}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-purple-800 mb-2">ðŸ’° Sistema de Comisiones del Marketplace</h3>
                  <p className="text-sm text-purple-700">
                    Configura el porcentaje de comisiÃ³n que el marketplace cobra al vendedor por cada venta realizada a travÃ©s de mundobeat.cl.
                    Las ventas directas desde el dominio del vendedor no tienen comisiÃ³n.
                  </p>
                </div>

                <div>
                  <Label htmlFor="commissionPercentage">
                    ComisiÃ³n Ventas Normales (%)
                  </Label>
                  <Input
                    id="commissionPercentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={commissionFormData.commissionPercentage}
                    onChange={(e) => setCommissionFormData({ 
                      ...commissionFormData, 
                      commissionPercentage: parseFloat(e.target.value) || 0 
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Porcentaje de comisiÃ³n para ventas normales en el marketplace (ej: 10 = 10%)
                  </p>
                </div>

                <div>
                  <Label htmlFor="wholesaleCommissionPercentage">
                    ComisiÃ³n Ventas Mayoristas (%)
                  </Label>
                  <Input
                    id="wholesaleCommissionPercentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={commissionFormData.wholesaleCommissionPercentage}
                    onChange={(e) => setCommissionFormData({ 
                      ...commissionFormData, 
                      wholesaleCommissionPercentage: parseFloat(e.target.value) || 0 
                    })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Porcentaje de comisiÃ³n para ventas mayoristas (normalmente menor que ventas normales)
                  </p>
                </div>

                <AssistedCommissionFields value={commissionFormData} onChange={values => setCommissionFormData({ ...commissionFormData, ...values })} />
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="isWholesaleEnabledByAdmin" className="font-medium">
                        Habilitar Modo Mayorista
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Permite que este vendedor acceda a funcionalidades mayoristas en el marketplace
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id="isWholesaleEnabledByAdmin"
                      checked={commissionFormData.isWholesaleEnabledByAdmin}
                      onChange={(e) => setCommissionFormData({ 
                        ...commissionFormData, 
                        isWholesaleEnabledByAdmin: e.target.checked 
                      })}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                  </div>
                </div>

                {selectedVendor?.settings?.isWholesaleEnabled && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                    <p className="text-green-800">
                      <strong>âœ… Vendedor con Wholesale habilitado:</strong> Este vendedor ha activado el modo mayorista desde su dashboard.
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 border rounded-lg p-3 text-sm">
                  <p className="font-semibold mb-2">ðŸ“Š Ejemplo de CÃ¡lculo:</p>
                  <div className="space-y-1 text-gray-700">
                    <p>Venta de <strong>$100.000</strong> en el marketplace:</p>
                    <p className="pl-4">â€¢ ComisiÃ³n ({commissionFormData.commissionPercentage}%): <strong>${(100000 * commissionFormData.commissionPercentage / 100).toLocaleString()}</strong></p>
                    <p className="pl-4">â€¢ Vendedor recibe: <strong>${(100000 - (100000 * commissionFormData.commissionPercentage / 100)).toLocaleString()}</strong></p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar Comisiones"}
                  </Button>
                </div>
              </form>
            ) : modalMode === 'envia' ? (
              <form onSubmit={handleEnviaConfig} className="p-6 space-y-6">
                {loadingModalData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <p className="text-blue-800 text-sm">Cargando configuraciÃ³n...</p>
                  </div>
                )}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="font-semibold text-indigo-900 mb-2">ðŸ“¦ ConfiguraciÃ³n Envia.com</p>
                  <p className="text-indigo-800 text-sm mb-3">
                    Configura la direcciÃ³n de origen y carriers habilitados para este vendor.
                  </p>
                  <div className="text-sm text-indigo-700">
                    <p><strong>Nota:</strong> Un solo token de Envia.com (del marketplace) se usa para todos los vendors. Cada vendor configura su direcciÃ³n de origen.</p>
                  </div>
                </div>

                {/* Nota: Envia.com siempre habilitado */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600">â„¹ï¸</span>
                    <div>
                      <p className="text-sm font-medium text-blue-900">Envia.com estÃ¡ siempre habilitado</p>
                      <p className="text-sm text-blue-700 mt-1">
                        Este es el Ãºnico mÃ©todo de envÃ­o disponible para todas las tiendas.
                      </p>
                    </div>
                  </div>
                </div>

                {/* DirecciÃ³n de origen */}
                <div className="space-y-4">
                  <h4 className="font-semibold border-b pb-2">ðŸ“ DirecciÃ³n de Origen (Bodega)</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="originName">Nombre de Contacto *</Label>
                      <Input
                        id="originName"
                        value={enviaFormData.originName}
                        onChange={(e) => setEnviaFormData({ ...enviaFormData, originName: e.target.value })}
                        placeholder="Nombre de la bodega o contacto"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="originPhone">TelÃ©fono *</Label>
                      <Input
                        id="originPhone"
                        value={enviaFormData.originPhone}
                        onChange={(e) => setEnviaFormData({ ...enviaFormData, originPhone: e.target.value })}
                        placeholder="+56912345678"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="originStreet">Calle y NÃºmero *</Label>
                    <Input
                      id="originStreet"
                      value={enviaFormData.originStreet}
                      onChange={(e) => setEnviaFormData({ ...enviaFormData, originStreet: e.target.value })}
                      placeholder="Av. Providencia 123, Oficina 45"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="originRegion">RegiÃ³n *</Label>
                      <select
                        id="originRegion"
                        value={enviaSelectedRegionId || ""}
                        onChange={(e) => handleEnviaRegionChange(parseInt(e.target.value))}
                        className="w-full h-10 px-3 border rounded-md"
                        required
                      >
                        <option value="">Seleccionar regiÃ³n...</option>
                        {enviaRegions.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="originCommune">Comuna *</Label>
                      <select
                        id="originCommune"
                        value={enviaSelectedCommuneId || ""}
                        onChange={(e) => handleEnviaCommuneChange(parseInt(e.target.value))}
                        className="w-full h-10 px-3 border rounded-md"
                        disabled={!enviaSelectedRegionId}
                        required
                      >
                        <option value="">Seleccionar comuna...</option>
                        {enviaCommunesForRegion.map((commune) => (
                          <option key={commune.id} value={commune.id}>
                            {commune.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="originPostalCode">CÃ³digo Postal</Label>
                      <Input
                        id="originPostalCode"
                        value={enviaFormData.originPostalCode}
                        readOnly
                        className="bg-gray-50"
                        placeholder="AutomÃ¡tico"
                      />
                    </div>
                  </div>
                </div>

                {/* Carriers habilitados */}
                <div className="space-y-4">
                  <h4 className="font-semibold border-b pb-2">ðŸšš Carriers Habilitados</h4>
                  <p className="text-sm text-gray-600">
                    Selecciona los carriers que este vendor puede usar para envÃ­os.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {enviaCarriers.map((carrier) => (
                      <label
                        key={carrier.code}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          enviaFormData.enabledCarriers.includes(carrier.code)
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={enviaFormData.enabledCarriers.includes(carrier.code)}
                          onChange={() => toggleEnviaCarrier(carrier.code)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <span className="text-sm font-medium">{carrier.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Test de cotizaciÃ³n */}
                <div className="border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleTestEnviaQuote}
                    disabled={testingEnviaQuote || !enviaFormData.enabled || !enviaFormData.originStreet}
                  >
                    {testingEnviaQuote ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                        Probando cotizaciÃ³n...
                      </>
                    ) : (
                      "ðŸ§ª Probar CotizaciÃ³n"
                    )}
                  </Button>
                  
                  {enviaQuoteResult && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${
                      enviaQuoteResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      {enviaQuoteResult.success ? (
                        <div>
                          <p className="font-semibold text-green-800 mb-2">âœ… {enviaQuoteResult.options?.length || 0} opciones encontradas</p>
                          <div className="space-y-1">
                            {enviaQuoteResult.options?.slice(0, 3).map((opt: any, i: number) => (
                              <p key={i} className="text-green-700">
                                {opt.carrier} - {opt.serviceDescription}: ${parseInt(opt.totalPrice).toLocaleString()} ({opt.deliveryEstimate})
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-red-800">âŒ {enviaQuoteResult.message}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar ConfiguraciÃ³n"}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateOrEdit} className="p-6 space-y-4">
                <div>
                  <Label htmlFor="storeName">
                    Nombre de la Tienda <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="storeName"
                    value={formData.storeName}
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        storeName: e.target.value,
                        slug: modalMode === 'create' ? generateSlug(e.target.value) : formData.slug
                      });
                    }}
                    placeholder="Ej: CDmania"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="slug">
                    Slug (URL) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="cdmania"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL de la tienda: {formData.slug ? `mundobeat.cl/tiendas/${formData.slug}` : 'mundobeat.cl/tiendas/tu-slug'}
                  </p>
                </div>

                <div>
                  <Label htmlFor="email">
                    Email del Vendedor <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="vendedor@email.com"
                    required
                  />
                </div>

                {modalMode === 'create' && (
                  <>
                    <div className="border-t pt-4 mt-6">
                      <h3 className="font-semibold text-lg mb-3">ðŸ“¦ Datos de Origen de EnvÃ­o (Envia.com)</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Estos datos son obligatorios para configurar los envÃ­os con Envia.com
                      </p>
                      
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="enviaOriginName">
                            Nombre de Contacto <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="enviaOriginName"
                            value={formData.enviaOriginName}
                            onChange={(e) => setFormData({ ...formData, enviaOriginName: e.target.value })}
                            placeholder="Juan PÃ©rez"
                            required
                          />
                        </div>

                        <div>
                          <Label htmlFor="enviaOriginPhone">
                            TelÃ©fono <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="enviaOriginPhone"
                            value={formData.enviaOriginPhone}
                            onChange={(e) => setFormData({ ...formData, enviaOriginPhone: e.target.value })}
                            placeholder="+56912345678"
                            required
                          />
                        </div>

                        <div>
                          <Label htmlFor="enviaOriginStreet">
                            Calle y NÃºmero <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="enviaOriginStreet"
                            value={formData.enviaOriginStreet}
                            onChange={(e) => setFormData({ ...formData, enviaOriginStreet: e.target.value })}
                            placeholder="Av. Providencia 123, Oficina 45"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="createRegion">
                              RegiÃ³n <span className="text-red-500">*</span>
                            </Label>
                            <select
                              id="createRegion"
                              value={createSelectedRegionId || ""}
                              onChange={(e) => handleCreateRegionChange(parseInt(e.target.value))}
                              className="w-full h-10 px-3 border rounded-md"
                              required
                            >
                              <option value="">Seleccionar...</option>
                              {createRegions.map((region) => (
                                <option key={region.id} value={region.id}>
                                  {region.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <Label htmlFor="createCommune">
                              Comuna <span className="text-red-500">*</span>
                            </Label>
                            <select
                              id="createCommune"
                              value={createSelectedCommuneId || ""}
                              onChange={(e) => handleCreateCommuneChange(parseInt(e.target.value))}
                              className="w-full h-10 px-3 border rounded-md"
                              disabled={!createSelectedRegionId}
                              required
                            >
                              <option value="">Seleccionar...</option>
                              {createCommunes.map((commune: any) => (
                                <option key={commune.id} value={commune.id}>
                                  {commune.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <Label htmlFor="enviaOriginPostalCode">CÃ³digo Postal</Label>
                            <Input
                              id="enviaOriginPostalCode"
                              value={formData.enviaOriginPostalCode}
                              readOnly
                              className="bg-gray-50"
                              placeholder="AutomÃ¡tico"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="isActive" className="cursor-pointer">
                      Tienda activa
                    </Label>
                  </div>

                  {modalMode === 'edit' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="publishInMarketplace"
                        checked={formData.publishInMarketplace !== false}
                        onChange={(e) => setFormData({ ...formData, publishInMarketplace: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="publishInMarketplace" className="cursor-pointer">
                        Mostrar productos en marketplace
                      </Label>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : modalMode === 'create' ? "Crear Tienda" : "Guardar Cambios"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
