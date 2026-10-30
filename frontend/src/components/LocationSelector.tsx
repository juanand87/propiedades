"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { MapPin, X, ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useResolvedThemeColors } from "@/hooks/useResolvedThemeColors";

interface LocationSelectorProps {
  onLocationChange?: (region: string, comuna: string) => void;
  triggerOpen?: boolean;
  onClose?: () => void;
  hideButton?: boolean;
}

type ModalStep = 'closed' | 'region' | 'comuna';

export default function LocationSelector({ onLocationChange, triggerOpen, onClose, hideButton }: LocationSelectorProps) {
  const theme = useResolvedThemeColors();
  const [modalStep, setModalStep] = useState<ModalStep>('closed');
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [selectedComuna, setSelectedComuna] = useState("");
  const [selectedComunaId, setSelectedComunaId] = useState<number | null>(null);
  const [regiones, setRegiones] = useState<any[]>([]);
  const [comunas, setComunas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchRegion, setSearchRegion] = useState("");
  const [searchComuna, setSearchComuna] = useState("");

  // Cargar regiones desde API
  useEffect(() => {
    loadRegions();
  }, []);

  // Cargar ubicación guardada al montar
  useEffect(() => {
    const savedRegion = localStorage.getItem("selectedRegion");
    const savedComuna = localStorage.getItem("selectedComuna");
    const savedRegionId = localStorage.getItem("selectedRegionId");
    const savedComunaId = localStorage.getItem("selectedComunaId");
    
    if (savedRegion && savedComuna) {
      setSelectedRegion(savedRegion);
      setSelectedComuna(savedComuna);
      if (savedRegionId) setSelectedRegionId(parseInt(savedRegionId));
      if (savedComunaId) setSelectedComunaId(parseInt(savedComunaId));
      
      // Load communes for the saved region
      if (savedRegionId) {
        loadCommunesByRegion(parseInt(savedRegionId));
      }
    }
  }, []);

  // Escuchar cambios de ubicación desde otros componentes (ej: WelcomeLocationModal)
  useEffect(() => {
    const handleLocationChanged = (event: any) => {
      console.log('[LocationSelector] 🎯 Evento locationChanged recibido:', event.detail);
      const { region, comuna, regionId, comunaId } = event.detail;
      setSelectedRegion(region);
      setSelectedComuna(comuna);
      setSelectedRegionId(regionId);
      setSelectedComunaId(comunaId);
      
      // Load communes for the new region
      if (regionId) {
        loadCommunesByRegion(regionId);
      }
    };

    window.addEventListener('locationChanged', handleLocationChanged);
    
    return () => {
      window.removeEventListener('locationChanged', handleLocationChanged);
    };
  }, []);

  // Abrir modal cuando triggerOpen cambie a true
  useEffect(() => {
    if (triggerOpen) {
      setModalStep('region');
    }
  }, [triggerOpen]);

  const loadRegions = async () => {
    try {
      const data = await api.getRegions();
      setRegiones(data);
    } catch (error) {
      console.error("Error loading regions:", error);
    }
  };

  const loadCommunesByRegion = async (regionId: number) => {
    try {
      setLoading(true);
      const data = await api.getCommunesByRegion(regionId);
      setComunas(data);
    } catch (error) {
      console.error("Error loading communes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRegion = async (regionId: number, regionName: string) => {
    setSelectedRegionId(regionId);
    setSelectedRegion(regionName);
    setSelectedComuna("");
    setSelectedComunaId(null);
    
    // Cargar comunas y pasar al siguiente paso
    setLoading(true);
    try {
      const data = await api.getCommunesByRegion(regionId);
      setComunas(data);
      setModalStep('comuna');
      setSearchComuna("");
    } catch (error) {
      console.error("Error loading communes:", error);
      alert("Error al cargar las comunas");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectComuna = (comunaId: number, comunaName: string) => {
    setSelectedComunaId(comunaId);
    setSelectedComuna(comunaName);
    
    // Guardar en localStorage
    localStorage.setItem("selectedRegion", selectedRegion);
    localStorage.setItem("selectedComuna", comunaName);
    localStorage.setItem("selectedRegionId", selectedRegionId!.toString());
    localStorage.setItem("selectedComunaId", comunaId.toString());
    localStorage.setItem("checkoutSelectedRegion", selectedRegionId!.toString());
    localStorage.setItem("checkoutSelectedCommune", comunaId.toString());
    
    // Disparar evento personalizado para notificar el cambio de ubicación
    if (typeof window !== 'undefined') {
      console.log('[LocationSelector] 📍 Disparando evento locationChanged');
      window.dispatchEvent(new CustomEvent('locationChanged', {
        detail: { region: selectedRegion, comuna: comunaName, regionId: selectedRegionId, comunaId }
      }));
    }
    
    if (onLocationChange) {
      onLocationChange(selectedRegion, comunaName);
    }
    
    setModalStep('closed');
  };

  const handleClose = () => {
    setModalStep('closed');
    setSearchRegion("");
    setSearchComuna("");
    if (onClose) onClose();
  };

  const handleBack = () => {
    setModalStep('region');
    setSearchComuna("");
  };

  const displayLocation = selectedComuna 
    ? selectedComuna
    : "Seleccionar ubicación";

  const filteredRegiones = regiones.filter(r => 
    r.name.toLowerCase().includes(searchRegion.toLowerCase())
  );

  const filteredComunas = comunas.filter(c => 
    c.name.toLowerCase().includes(searchComuna.toLowerCase())
  );
  const modalStyle = {
    backgroundColor: theme.surface,
    color: theme.text,
    "--location-accent": theme.action,
    "--location-border": theme.border,
    "--location-soft": `color-mix(in srgb, ${theme.action} 10%, ${theme.surface})`,
  } as CSSProperties;

  return (
    <>
      {!hideButton && (
        <button
          onClick={() => setModalStep('region')}
          className="flex items-center gap-2 text-gray-700 hover:text-purple-600 transition-colors"
        >
          <MapPin size={18} />
          <span className="text-sm font-medium hidden md:inline">{displayLocation}</span>
        </button>
      )}

      {/* Modal Paso 1: Seleccionar Región */}
      {modalStep === 'region' && (
        <div className="fixed inset-0 bg-black/50 flex items-start md:items-center justify-center z-50">
          <div style={modalStyle} className="w-full md:max-w-md md:rounded-lg md:m-4 min-h-screen md:min-h-0 md:max-h-[80vh] flex flex-col animate-in slide-in-from-top md:slide-in-from-bottom duration-300 shadow-2xl">
            {/* Header */}
            <div style={{ backgroundColor: theme.surface, borderColor: theme.border }} className="flex items-center justify-between p-4 border-b sticky top-0">
              <h3 className="text-lg font-bold">Selecciona tu Región</h3>
              <button
                onClick={handleClose}
                style={{ color: theme.muted }}
                className="rounded-md p-1 hover:opacity-75"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div style={{ borderColor: theme.border }} className="p-4 border-b">
              <input
                type="text"
                placeholder="Buscar región..."
                value={searchRegion}
                onChange={(e) => setSearchRegion(e.target.value)}
                style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                className="location-input w-full px-4 py-2 border rounded-lg outline-none"
              />
            </div>

            {/* Lista de Regiones */}
            <div className="flex-1 overflow-y-auto pb-20">
              {filteredRegiones.map((region) => (
                <button
                  key={region.id}
                  onClick={() => handleSelectRegion(region.id, region.name)}
                  style={{ color: theme.text, borderColor: theme.border }}
                  className="location-option w-full text-left px-4 py-3 border-b transition-colors flex items-center justify-between group"
                >
                  <span className="font-medium">{region.name}</span>
                  <span style={{ color: theme.action }} className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Paso 2: Seleccionar Comuna */}
      {modalStep === 'comuna' && (
        <div className="fixed inset-0 bg-black/50 flex items-start md:items-center justify-center z-50">
          <div style={modalStyle} className="w-full md:max-w-md md:rounded-lg md:m-4 min-h-screen md:min-h-0 md:max-h-[80vh] flex flex-col animate-in slide-in-from-right md:slide-in-from-bottom duration-300 shadow-2xl">
            {/* Header */}
            <div style={{ backgroundColor: theme.surface, borderColor: theme.border }} className="flex items-center justify-between p-4 border-b sticky top-0">
              <button
                onClick={handleBack}
                style={{ color: theme.muted }}
                className="flex items-center gap-2 hover:opacity-75"
              >
                <ChevronLeft size={20} />
                <span className="font-medium">Atrás</span>
              </button>
              <button
                onClick={handleClose}
                style={{ color: theme.muted }}
                className="rounded-md p-1 hover:opacity-75"
              >
                <X size={20} />
              </button>
            </div>

            {/* Selected Region */}
            <div style={{ background: `color-mix(in srgb, ${theme.action} 10%, ${theme.surface})`, borderColor: theme.border }} className="px-4 py-3 border-b">
              <p style={{ color: theme.muted }} className="text-sm">Región seleccionada:</p>
              <p style={{ color: theme.action }} className="font-bold">{selectedRegion}</p>
            </div>

            {/* Search */}
            <div style={{ borderColor: theme.border }} className="p-4 border-b">
              <input
                type="text"
                placeholder="Buscar comuna..."
                value={searchComuna}
                onChange={(e) => setSearchComuna(e.target.value)}
                style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                className="location-input w-full px-4 py-2 border rounded-lg outline-none"
              />
            </div>

            {/* Lista de Comunas */}
            <div className="flex-1 overflow-y-auto pb-20">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div style={{ borderBottomColor: theme.action }} className="animate-spin rounded-full h-8 w-8 border-2 border-transparent"></div>
                </div>
              ) : (
                filteredComunas.map((comuna) => (
                  <button
                    key={comuna.id}
                    onClick={() => handleSelectComuna(comuna.id, comuna.name)}
                    style={{ color: theme.text, borderColor: theme.border }}
                    className="location-option w-full text-left px-4 py-3 border-b transition-colors flex items-center justify-between group"
                  >
                    <span className="font-medium">{comuna.name}</span>
                    <span style={{ color: theme.action }} className="opacity-0 group-hover:opacity-100 transition-opacity">✓</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
