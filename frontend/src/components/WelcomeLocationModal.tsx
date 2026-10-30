"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { MapPin, Search, ChevronRight, X } from "lucide-react";
import { api } from "@/lib/api";
import { useResolvedThemeColors } from "@/hooks/useResolvedThemeColors";

export default function WelcomeLocationModal() {
  const theme = useResolvedThemeColors();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'region' | 'comuna'>('region');
  const [selectedRegion, setSelectedRegion] = useState<{id: number, name: string} | null>(null);
  const [regiones, setRegiones] = useState<any[]>([]);
  const [comunas, setComunas] = useState<any[]>([]);
  const [searchRegion, setSearchRegion] = useState("");
  const [searchComuna, setSearchComuna] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAndOpenModal();
    loadRegions();
  }, []);

  const checkAndOpenModal = () => {
    if (typeof window === 'undefined') return;
    
    const savedComuna = localStorage.getItem("selectedComuna");
    const savedComunaId = localStorage.getItem("selectedComunaId");
    
    // Si no hay comuna seleccionada, abrir el modal
    if (!savedComuna || !savedComunaId) {
      setTimeout(() => setIsOpen(true), 500); // Pequeño delay para mejor UX
    }
  };

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

  const handleSelectRegion = async (region: any) => {
    setSelectedRegion({ id: region.id, name: region.name });
    await loadCommunesByRegion(region.id);
    setStep('comuna');
    setSearchComuna("");
  };

  const handleSelectComuna = (comuna: any) => {
    if (!selectedRegion) return;

    // Guardar en localStorage
    localStorage.setItem("selectedRegion", selectedRegion.name);
    localStorage.setItem("selectedComuna", comuna.name);
    localStorage.setItem("selectedRegionId", selectedRegion.id.toString());
    localStorage.setItem("selectedComunaId", comuna.id.toString());
    localStorage.setItem("checkoutSelectedRegion", selectedRegion.id.toString());
    localStorage.setItem("checkoutSelectedCommune", comuna.id.toString());
    
    // Disparar evento personalizado
    window.dispatchEvent(new CustomEvent('locationChanged', {
      detail: { 
        region: selectedRegion.name, 
        comuna: comuna.name, 
        regionId: selectedRegion.id, 
        comunaId: comuna.id 
      }
    }));
    
    setIsOpen(false);
  };

  const handleBack = () => {
    setStep('region');
    setSelectedRegion(null);
    setSearchComuna("");
  };

  const handleSkip = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div style={modalStyle} className="relative w-full max-w-2xl mx-4 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header con gradiente */}
        <div style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }} className="relative p-8 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10 flex items-center gap-4">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
              <MapPin className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-2">¡Bienvenido!</h2>
              <p className="text-white/90 text-lg">
                {step === 'region' 
                  ? 'Selecciona tu región para calcular costos de envío' 
                  : 'Ahora selecciona tu comuna'}
              </p>
            </div>
          </div>

          {step === 'comuna' && (
            <button
              onClick={handleBack}
              className="absolute top-4 left-4 p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
          )}

          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
            title="Saltar (puedes seleccionar después en el header)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div style={{ backgroundColor: theme.surface }} className="p-8">
          {/* Buscador */}
          <div className="relative mb-6">
            <Search style={{ color: theme.muted }} className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" />
            <input
              type="text"
              placeholder={step === 'region' ? 'Buscar región...' : 'Buscar comuna...'}
              value={step === 'region' ? searchRegion : searchComuna}
              onChange={(e) => step === 'region' ? setSearchRegion(e.target.value) : setSearchComuna(e.target.value)}
              style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
              className="location-input w-full pl-12 pr-4 py-4 border-2 rounded-2xl outline-none transition-all text-lg"
              autoFocus
            />
          </div>

          {/* Lista de opciones */}
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {step === 'region' ? (
              filteredRegiones.length > 0 ? (
                filteredRegiones.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => handleSelectRegion(region)}
                    style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                    className="location-option w-full text-left p-4 rounded-xl border-2 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium">
                        {region.name}
                      </span>
                      <ChevronRight style={{ color: theme.action }} className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                ))
              ) : (
                <div style={{ color: theme.muted }} className="text-center py-12">
                  <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No se encontraron regiones</p>
                </div>
              )
            ) : loading ? (
              <div className="text-center py-12">
                <div style={{ borderColor: theme.border, borderTopColor: theme.action }} className="inline-block animate-spin rounded-full h-12 w-12 border-4"></div>
                <p style={{ color: theme.muted }} className="mt-4">Cargando comunas...</p>
              </div>
            ) : (
              filteredComunas.length > 0 ? (
                filteredComunas.map((comuna) => (
                  <button
                    key={comuna.id}
                    onClick={() => handleSelectComuna(comuna)}
                    style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
                    className="location-option w-full text-left p-4 rounded-xl border-2 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium">
                        {comuna.name}
                      </span>
                      <div style={{ background: `color-mix(in srgb, ${theme.action} 12%, ${theme.surface})` }} className="p-2 rounded-full transition-colors">
                        <MapPin style={{ color: theme.action }} className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div style={{ color: theme.muted }} className="text-center py-12">
                  <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No se encontraron comunas</p>
                </div>
              )
            )}
          </div>

          {/* Footer info */}
          <div style={{ background: `color-mix(in srgb, ${theme.action} 10%, ${theme.surface})`, borderColor: theme.border }} className="mt-6 p-4 border rounded-xl">
            <p style={{ color: theme.text }} className="text-sm">
              💡 <strong>¿Por qué necesitamos tu ubicación?</strong>
              <br />
              Nos ayuda a calcular el costo exacto del envío a tu domicilio. 
              Puedes cambiarla en cualquier momento. (Al comienzo del portal, al lado del buscador).
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: var(--location-soft);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--location-accent);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          opacity: .8;
        }
      `}</style>
    </div>
  );
}
