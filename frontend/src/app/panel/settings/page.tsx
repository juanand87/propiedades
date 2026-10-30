"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, API_URL } from "@/lib/api";
import { Store, Palette, Truck, CreditCard, Mail, Plug, TrendingUp, Package, GripVertical, Music } from "lucide-react";
import GridConfigUI from "@/components/admin/GridConfigUI";
import BannerConfigUI from "@/components/admin/BannerConfigUI";
import PromotionsOverview from "@/components/admin/PromotionsOverview";
import StoreDesignConfig from "@/components/admin/StoreDesignConfig";
import MarketplacePaymentMethods from "@/components/admin/MarketplacePaymentMethods";
import SmtpConfigSection from "@/components/admin/SmtpConfigSection";
import FlowPaymentConfig from "@/components/admin/FlowPaymentConfig";
import PaykuPaymentConfig from "@/components/admin/PaykuPaymentConfig";
import MercadoLibreAppSection from "@/components/admin/MercadoLibreAppSection";
import { ShippingConfig } from "./shipping-config";
import MenusManagement from "./_menus-management";
import FooterSection from "./_footer-section";
import { colorThemes as importedColorThemes, getTheme, ColorTheme } from "@/lib/colorThemes";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Usar el ID del vendor especial "marketplace" que almacena la configuración global
  const [vendorId, setVendorId] = useState<string>("00000000-0000-0000-0000-000000000001");
  const [hasVendor, setHasVendor] = useState(true); // Siempre true para marketplace
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("general");
  const [activeSubsection, setActiveSubsection] = useState("configuracion-general");

  // Handle Spotify OAuth callback redirect
  useEffect(() => {
    const spotifyConnected = searchParams.get('spotify_connected');
    const spotifyError = searchParams.get('spotify_error');
    const section = searchParams.get('section');
    const subsection = searchParams.get('subsection');
    if (spotifyConnected === '1' || spotifyError) {
      setActiveSection('integraciones');
      setActiveSubsection('spotify');
      router.replace('/panel/settings');
    } else if (section) {
      setActiveSection(section);
      if (subsection) setActiveSubsection(subsection);
      router.replace('/panel/settings');
    }
  }, []); const sections = [
    {
      id: "general",
      name: "General",
      icon: Store,
      subsections: [
        { id: "configuracion-general", name: "Configuración General" },
        { id: "marketplace", name: "Publicar en Marketplace" },
        { id: "mayorista", name: "Modo Mayorista" },
        { id: "politicas", name: "Políticas" },
        { id: "notificaciones", name: "Notificaciones" },
        { id: "facturacion", name: "Facturación" },
      ],
    },
    {
      id: "diseno",
      name: "Diseño",
      icon: Palette,
      subsections: [
        { id: "portada", name: "Portada" },
        { id: "slider-portada", name: "Carrusel de portada" },
        { id: "header", name: "Header" },
        { id: "frases-barra-superior", name: "  ↳ Frases Barra Superior" },
        { id: "redes-sociales", name: "Redes Sociales" },
        { id: "menus", name: "Menús" },
        { id: "filtros", name: "Filtros" },
        { id: "footer", name: "Footer" },
        { id: "pagina-producto", name: "Página de Producto" },
        { id: "promociones", name: "Bloques de contenido" },
        { id: "grids", name: "Grids" },
        { id: "colores", name: "Colores" },
        { id: "whatsapp", name: "WhatsApp" },
        { id: "contacto", name: "Contacto" },
      ],
    },
    {
      id: "productos",
      name: "Productos",
      icon: Package,
      subsections: [
        { id: "vista-general", name: "Vista General" },
        { id: "categorias", name: "Categorías" },
        { id: "descripcion-corta", name: "Descripción Corta" },
        { id: "datos-tecnicos", name: "Datos Técnicos" },
      ],
    },
    {
      id: "envio",
      name: "Métodos de Envío",
      icon: Truck,
    },
    {
      id: "pago",
      name: "Métodos de Pago",
      icon: CreditCard,
    },
    {
      id: "smtp",
      name: "Configuración SMTP",
      icon: Mail,
    },
    {
      id: "integraciones",
      name: "Integraciones",
      icon: Plug,
      subsections: [
        { id: "mercadolibre", name: "Mercado Libre" },
        { id: "discogs", name: "Discogs API" },
        { id: "spotify", name: "Spotify" },
        { id: "gemini", name: "Gemini AI - Descripciones" },
        { id: "redes-sociales", name: "Redes Sociales" },
        { id: "analytics", name: "Google Analytics" },
        { id: "facebook-pixel", name: "Facebook Pixel" },
      ],
    },
    {
      id: "seo-marketing",
      name: "SEO y Marketing",
      icon: TrendingUp,
    },
    {
      id: "reproductor-spotify",
      name: "Reproductor Spotify",
      icon: Music,
    },
    {
      id: "sincronizar-spotify",
      name: "Sincronizar Temas Spotify",
      icon: Music,
    },
  ];

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    const section = sections.find((s) => s.id === sectionId);
    if (section?.subsections && section.subsections.length > 0) {
      setActiveSubsection(section.subsections[0].id);
    } else {
      setActiveSubsection("");
    }
  };

  const renderContent = () => {
    // General Section
    if (activeSection === "general") {
      if (activeSubsection === "configuracion-general") {
        return <ConfiguracionGeneralSection vendorId={vendorId} />;
      }
      if (activeSubsection === "marketplace") {
        return <MarketplaceSection vendorId={vendorId} />;
      }
      if (activeSubsection === "mayorista") {
        return <MayoristaSection vendorId={vendorId} />;
      }
      if (activeSubsection === "politicas") {
        return <PoliticasSection vendorId={vendorId} />;
      }
      if (activeSubsection === "notificaciones") {
        return <NotificacionesSection vendorId={vendorId} />;
      }
      if (activeSubsection === "facturacion") {
        return <FacturacionSection vendorId={vendorId} />;
      }
    }

    // Diseño Section
    if (activeSection === "diseno") {
      if (activeSubsection === "portada") {
        return <StoreDesignConfig vendorId={vendorId} />;
      }
      if (activeSubsection === "slider-portada") {
        return <SliderPortadaSection vendorId={vendorId} />;
      }
      if (activeSubsection === "header") {
        return <HeaderSection vendorId={vendorId} />;
      }
      if (activeSubsection === "frases-barra-superior") {
        return <FrasesBarraSuperiorSection vendorId={vendorId} />;
      }
      if (activeSubsection === "redes-sociales") {
        return <RedesSocialesSection vendorId={vendorId} />;
      }
      if (activeSubsection === "menus") {
        return <MenusManagement vendorId={vendorId} />;
      }
      if (activeSubsection === "filtros") {
        return <FiltersSection vendorId={vendorId} />;
      }
      if (activeSubsection === "footer") {
        return <FooterSection vendorId={vendorId} />;
      }
      if (activeSubsection === "pagina-producto") {
        return <PaginaProductoSection vendorId={vendorId} />;
      }
      if (["promociones", "slides", "banners"].includes(activeSubsection)) {
        return <PromotionsSection vendorId={vendorId} initialMode={activeSubsection === "slides" ? "carousels" : activeSubsection === "banners" ? "banners" : "overview"} />;
      }
      if (activeSubsection === "grids") {
        return <GridsSection vendorId={vendorId} />;
      }
      if (activeSubsection === "colores") {
        return <ColoresSection vendorId={vendorId} />;
      }
      return <PlaceholderSection title={activeSubsection} />;
    }

    // Productos Section
    if (activeSection === "productos") {
      if (activeSubsection === "vista-general") {
        return <VistaGeneralProductosSection vendorId={vendorId} />;
      }
      if (activeSubsection === "categorias") {
        return <CategoriasSection vendorId={vendorId} />;
      }
      if (activeSubsection === "descripcion-corta") {
        return <DescripcionCortaSection vendorId={vendorId} />;
      }
      if (activeSubsection === "datos-tecnicos") {
        return <DatosTecnicosSection vendorId={vendorId} />;
      }
      return <PlaceholderSection title={activeSubsection} />;
    }

    // Integraciones Section
    if (activeSection === "integraciones") {
      if (activeSubsection === "mercadolibre") {
        return <MercadoLibreAppSection />;
      }
      if (activeSubsection === "discogs") {
        return <DiscogsSection vendorId={vendorId} />;
      }
      if (activeSubsection === "spotify") {
        return <SpotifySection vendorId={vendorId} />;
      }
      if (activeSubsection === "gemini") {
        return <GeminiSection vendorId={vendorId} />;
      }
      return <PlaceholderSection title={activeSubsection} />;
    }

    // Métodos de Envío Section
    if (activeSection === "envio") {
      return <ShippingMethodsSection vendorId={vendorId} />;
    }

    // Métodos de Pago Section
    if (activeSection === "pago") {
      return <MarketplacePaymentMethods />;
    }

    // Configuración SMTP Section
    if (activeSection === "smtp") {
      return <SmtpConfigSection />;
    }

    // Reproductor Spotify
    if (activeSection === "reproductor-spotify") {
      return <SpotifyPlayerSection vendorId={vendorId} />;
    }

    // Sincronizar Temas Spotify
    if (activeSection === "sincronizar-spotify") {
      return <SpotifySyncSection vendorId={vendorId} />;
    }

    // Placeholder for other sections
    return <PlaceholderSection title={activeSection} />;
  };

  if (isLoadingProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-gray-600 mt-2">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!hasVendor) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-gray-600 mt-2">Configura tu tienda</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Perfil de Vendedor Requerido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Necesitas crear un perfil de vendedor antes de configurar tu tienda.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración de Tienda</h1>
        <p className="text-gray-600 mt-2">Administra todos los aspectos de tu tienda</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar Navigation */}
        <div className="col-span-3">
          <Card className="sticky top-6">
            <CardContent className="p-4">
              <nav className="space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  
                  return (
                    <div key={section.id}>
                      <button
                        onClick={() => handleSectionClick(section.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                            : "text-gray-700 hover:bg-purple-50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {section.name}
                      </button>

                      {/* Subsections */}
                      {isActive && section.subsections && (
                        <div className="ml-4 mt-1 space-y-1">
                          {section.subsections.map((subsection) => (
                            <button
                              key={subsection.id}
                              onClick={() => setActiveSubsection(subsection.id)}
                              className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                                activeSubsection === subsection.id
                                  ? "bg-purple-100 text-purple-700 font-medium"
                                  : "text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              {subsection.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="col-span-9">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// Placeholder Component
function PlaceholderSection({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">{title.replace(/-/g, " ")}</CardTitle>
        <CardDescription>Esta sección estará disponible próximamente</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-500">Funcionalidad en desarrollo...</p>
      </CardContent>
    </Card>
  );
}

// Section Components
function ConfiguracionGeneralSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [vendor, setVendor] = useState({
    storeName: "",
    slug: "",
    email: "",
    phone: "",
    description: "",
  });
  const [charCount, setCharCount] = useState(0);
  const [favoritesEnabled, setFavoritesEnabled] = useState(true);

  useEffect(() => {
    loadVendor();
  }, [vendorId]);

  const loadVendor = async () => {
    try {
      const [data, marketplaceSettings] = await Promise.all([
        api.getVendor(vendorId),
        api.getMarketplaceSettings().catch(() => ({})),
      ]);
      setVendor({
        storeName: data.storeName || "",
        slug: data.slug || "",
        email: data.email || "",
        phone: data.phone || "",
        description: data.description || "",
      });
      setCharCount(data.description?.length || 0);
      setFavoritesEnabled(marketplaceSettings.favoritesEnabled !== false);
    } catch (error) {
      console.error("Error loading vendor:", error);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .replace(/[^a-z0-9\s-]/g, "") // Solo letras, números, espacios y guiones
      .trim()
      .replace(/\s+/g, "-") // Espacios a guiones
      .replace(/-+/g, "-"); // Múltiples guiones a uno solo
  };

  const handleStoreNameChange = (name: string) => {
    setVendor({
      ...vendor,
      storeName: name,
      slug: generateSlug(name),
    });
  };

  const handleDescriptionChange = (desc: string) => {
    if (desc.length <= 160) {
      setVendor({ ...vendor, description: desc });
      setCharCount(desc.length);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.updateVendor(vendorId, vendor);
      if (vendorId === "00000000-0000-0000-0000-000000000001") {
        await api.updateMarketplaceSetting("favoritesEnabled", favoritesEnabled);
      }
      alert("Configuración guardada correctamente");
    } catch (error: any) {
      console.error("Error saving vendor:", error);
      alert(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const previewUrl = `http://localhost:3000/tiendas/${vendor.slug}`;
  const futureUrl = `dominiomarketplace-${vendor.slug}.cl`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración General</CardTitle>
        <CardDescription>Configura los datos básicos de tu tienda</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nombre de la Tienda *</label>
            <input
              type="text"
              required
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={vendor.storeName}
              onChange={(e) => handleStoreNameChange(e.target.value)}
              placeholder="CD Manía"
            />
            <p className="text-xs text-gray-500 mt-1">Nombre público de tu tienda</p>
          </div>

          <div>
            <label className="text-sm font-medium">Slug URL *</label>
            <input
              type="text"
              required
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={vendor.slug}
              onChange={(e) => setVendor({ ...vendor, slug: generateSlug(e.target.value) })}
              placeholder="cdmania"
            />
            <div className="mt-2 space-y-1">
              <p className="text-xs text-blue-600">
                 Desarrollo: <span className="font-mono">{previewUrl}</span>
              </p>
              <p className="text-xs text-purple-600">
                 Producción: <span className="font-mono">{futureUrl}</span>
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Correo de Contacto *</label>
            <input
              type="email"
              required
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={vendor.email}
              onChange={(e) => setVendor({ ...vendor, email: e.target.value })}
              placeholder="contacto@cdmania.cl"
            />
            <p className="text-xs text-gray-500 mt-1">Email de contacto público</p>
          </div>

          <div>
            <label className="text-sm font-medium">Teléfono *</label>
            <input
              type="tel"
              required
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={vendor.phone}
              onChange={(e) => setVendor({ ...vendor, phone: e.target.value })}
              placeholder="+56 9 xxxx xxxx"
            />
            <p className="text-xs text-gray-500 mt-1">Número de contacto</p>
          </div>

          <div>
            <label className="text-sm font-medium">Descripción Corta</label>
            <textarea
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
              maxLength={160}
              value={vendor.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Breve descripción de tu tienda para SEO..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {charCount}/160 caracteres - Descripción para motores de búsqueda
            </p>
          </div>

          {vendorId === "00000000-0000-0000-0000-000000000001" && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={favoritesEnabled}
                  onChange={(e) => setFavoritesEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300"
                />
                <span>
                  <span className="block text-sm font-medium">Habilitar sección Favoritos</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    Muestra u oculta el acceso a Favoritos en el header del marketplace y tiendas.
                  </span>
                </span>
              </label>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MarketplaceSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [publishInMarketplace, setPublishInMarketplace] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setPublishInMarketplace(data.publishInMarketplace || false);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    try {
      await api.updateVendorSettings(vendorId, { publishInMarketplace: checked });
      setPublishInMarketplace(checked);
      alert("Configuración guardada correctamente");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publicar en Marketplace</CardTitle>
        <CardDescription>Controla la visibilidad de tus productos en el marketplace general</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="space-y-0.5">
            <label className="text-base font-medium">Publicar mis productos en el marketplace</label>
            <p className="text-sm text-gray-500">
              Tus productos aparecerán en la página principal del marketplace
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={publishInMarketplace}
              onChange={(e) => handleToggle(e.target.checked)}
              disabled={loading}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>¿Cómo funciona?</strong><br />
            Al activar esta opción, tus productos serán visibles en la página principal del marketplace (http://localhost:3000/), donde todos los visitantes podrán descubrirlos. Tu tienda individual seguirá siendo accesible independientemente de esta configuración.
          </p>
        </div>

        {publishInMarketplace && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              ? Tus productos están siendo publicados en el marketplace general
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MayoristaSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [isWholesaleEnabled, setIsWholesaleEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setIsWholesaleEnabled(data.isWholesaleEnabled || false);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    try {
      await api.updateVendorSettings(vendorId, { isWholesaleEnabled: checked });
      setIsWholesaleEnabled(checked);
      alert("Configuración guardada correctamente");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modo Mayorista</CardTitle>
        <CardDescription>Activa la venta al por mayor en tu tienda</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="space-y-0.5">
            <label className="text-base font-medium">Habilitar Modo Mayorista</label>
            <p className="text-sm text-gray-500">
              Permite ofrecer precios especiales para clientes mayoristas
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isWholesaleEnabled}
              onChange={(e) => handleToggle(e.target.checked)}
              disabled={loading}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>¿Cómo funciona?</strong><br />
            Cuando actives el modo mayorista, podrás agregar un precio especial en cada producto que será visible únicamente para clientes mayoristas registrados.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PoliticasSection({ vendorId }: { vendorId: string }) {
  return <PlaceholderSection title="Políticas" />;
}

function NotificacionesSection({ vendorId }: { vendorId: string }) {
  return <PlaceholderSection title="Notificaciones" />;
}

function FacturacionSection({ vendorId }: { vendorId: string }) {
  return <PlaceholderSection title="Facturación" />;
}

function DiscogsSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [settings, setSettings] = useState({
    discogsApiKey: "",
    discogsApiSecret: "",
  });

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setSettings({
        discogsApiKey: data.discogsApiKey || "",
        discogsApiSecret: data.discogsApiSecret || "",
      });
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.discogsApiKey) {
      setTestResult({
        success: false,
        message: "Por favor ingresa tu API Key primero",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await api.searchDiscogs(vendorId, {
        query: "test",
        per_page: 1,
      });

      if (result && result.results) {
        setTestResult({
          success: true,
          message: "¡Conexión exitosa! La API Key funciona correctamente.",
        });
      } else {
        setTestResult({
          success: false,
          message: "La API respondió pero no se obtuvieron resultados esperados.",
        });
      }
    } catch (error: any) {
      console.error("Error testing connection:", error);
      setTestResult({
        success: false,
        message: error.message || "Error al conectar con Discogs. Verifica tu API Key.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.updateVendorSettings(vendorId, settings);
      alert("Configuración guardada correctamente");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integración con Discogs</CardTitle>
        <CardDescription>
          Conecta tu tienda con Discogs para importar información de productos automáticamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Discogs API Key *</label>
            <input
              type="text"
              required
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={settings.discogsApiKey}
              onChange={(e) => setSettings({ ...settings, discogsApiKey: e.target.value })}
              placeholder="Tu Discogs API Key"
            />
            <p className="text-xs text-gray-500 mt-1">
              Obtén tu API key en{" "}
              <a
                href="https://www.discogs.com/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Discogs Developer Settings
              </a>
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Discogs API Secret (Opcional)</label>
            <input
              type="password"
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={settings.discogsApiSecret}
              onChange={(e) => setSettings({ ...settings, discogsApiSecret: e.target.value })}
              placeholder="Tu Discogs API Secret"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !settings.discogsApiKey}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {testing ? "Probando..." : "Probar Conexión"}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                testResult.success
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              <p className="text-sm">{testResult.message}</p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function SpotifySection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    spotifyEnabled: false,
    spotifyClientId: "",
    spotifyClientSecret: "",
  });
  const [oauthStatus, setOauthStatus] = useState<{ connected: boolean; userId?: string | null }>({ connected: false });
  const [oauthLoading, setOauthLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    loadSettings();
    // Check if came back from OAuth
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('spotify_connected') === '1') setSuccessMsg('✅ Spotify conectado correctamente');
      if (params.get('spotify_error')) setSuccessMsg('❌ Error: ' + params.get('spotify_error'));
    }
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setSettings({
        spotifyEnabled: data.spotifyEnabled || false,
        spotifyClientId: data.spotifyClientId || "",
        spotifyClientSecret: data.spotifyClientSecret || "",
      });
      const status = await api.getSpotifyStatus(vendorId);
      setOauthStatus(status);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateVendorSettings(vendorId, settings);
      setSuccessMsg("✅ Configuración guardada");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error: any) {
      alert(error.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectOAuth = async () => {
    if (!settings.spotifyClientId || !settings.spotifyClientSecret) {
      alert("Guarda primero tu Client ID y Client Secret antes de conectar.");
      return;
    }
    // Save credentials first then redirect
    setOauthLoading(true);
    try {
      await api.updateVendorSettings(vendorId, settings);
      const { url } = await api.getSpotifyAuthUrl(vendorId);
      window.location.href = url;
    } catch (err: any) {
      alert(err.message || "Error al obtener URL de autorización");
      setOauthLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Desconectar tu cuenta de Spotify?")) return;
    try {
      await api.disconnectSpotify(vendorId);
      setOauthStatus({ connected: false });
      setSuccessMsg("Spotify desconectado");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integración con Spotify</CardTitle>
        <CardDescription>
          Conecta tu cuenta de Spotify para gestionar playlists automáticamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{successMsg}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-medium">Spotify Client ID *</label>
            <input
              type="text"
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={settings.spotifyClientId}
              onChange={(e) => setSettings({ ...settings, spotifyClientId: e.target.value })}
              placeholder="Tu Client ID de Spotify"
            />
            <p className="text-xs text-gray-500 mt-1">
              Obtén tus credenciales en{" "}
              <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Spotify for Developers
              </a>
              . En la app, agrega como Redirect URI:{" "}
              <code className="text-xs bg-gray-100 px-1 rounded">http://localhost:3001/api/vendors/{vendorId}/spotify/callback</code>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Spotify Client Secret *</label>
            <input
              type="password"
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={settings.spotifyClientSecret}
              onChange={(e) => setSettings({ ...settings, spotifyClientSecret: e.target.value })}
              placeholder="Tu Client Secret de Spotify"
            />
          </div>

          <button type="submit" disabled={loading} className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50">
            {loading ? "Guardando..." : "Guardar Credenciales"}
          </button>
        </form>

        {/* OAuth Connection */}
        <div className="mt-6 p-4 border-2 border-dashed rounded-xl space-y-3" style={{ borderColor: oauthStatus.connected ? '#22c55e' : '#d1d5db' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${oauthStatus.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                {oauthStatus.connected ? 'Cuenta conectada' : 'Cuenta no conectada'}
              </h3>
              {oauthStatus.connected && oauthStatus.userId && (
                <p className="text-sm text-gray-500 mt-0.5">Usuario: <span className="font-medium">{oauthStatus.userId}</span></p>
              )}
              {!oauthStatus.connected && (
                <p className="text-sm text-gray-500 mt-0.5">Conecta para gestionar playlists automáticamente</p>
              )}
            </div>
            {oauthStatus.connected ? (
              <button onClick={handleDisconnect} className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors">
                Desconectar
              </button>
            ) : (
              <button
                onClick={handleConnectOAuth}
                disabled={oauthLoading || !settings.spotifyClientId}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {oauthLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🎵'}
                Conectar con Spotify
              </button>
            )}
          </div>
          {!settings.spotifyClientId && (
            <p className="text-xs text-amber-600">⚠️ Ingresa y guarda tu Client ID primero</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SpotifySyncSection({ vendorId }: { vendorId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [playlistName, setPlaylistName] = useState<string>("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "synced" | "discarded" | "deactivate">("pending");
  const [inactiveProducts, setInactiveProducts] = useState<any[]>([]);
  const [checkingSold, setCheckingSold] = useState(false);
  const [removingSold, setRemovingSold] = useState(false);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [preview, status, inactive] = await Promise.all([
        api.getSpotifySyncPreview(vendorId),
        api.getSpotifyStatus(vendorId),
        api.getInactiveSyncedProducts(vendorId).catch(() => []),
      ]);
      setProducts(preview || []);
      setInactiveProducts(inactive || []);
      setOauthConnected(status.connected);
      if (status.connected && status.playlistId) {
        try {
          const pls = await api.getSpotifyPlaylists(vendorId);
          const pl = pls?.find((p: any) => p.id === status.playlistId);
          if (pl) setPlaylistName(pl.name);
        } catch {/* ignore */}
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOne = async (productId: string) => {
    setSyncingId(productId);
    try {
      const result = await api.syncSingleProductSpotify(vendorId, productId);
      setProducts(prev => prev.map(p => {
        if (p.productId !== productId) return p;
        if (result.success) {
          return {
            ...p,
            syncStatus: null,
            syncedTracks: result.tracks?.map((t: any) => ({ name: t.name, artist: t.artist, popularity: t.popularity, uri: `spotify:track:${t.id}` })) || [],
            lastSyncedAt: new Date().toISOString(),
            _syncStatus: 'success',
            _syncError: undefined,
          };
        }
        return { ...p, _syncStatus: 'error', _syncError: result.error };
      }));
    } catch (err: any) {
      setProducts(prev => prev.map(p => p.productId === productId ? { ...p, _syncStatus: 'error', _syncError: err.message } : p));
    } finally {
      setSyncingId(null);
    }
  };

  const handleDiscard = async (productId: string) => {
    setActionId(productId);
    try {
      await api.discardProductSpotify(vendorId, productId);
      setProducts(prev => prev.map(p => p.productId === productId ? { ...p, syncStatus: 'discarded' } : p));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  const handleRestore = async (productId: string) => {
    setActionId(productId);
    try {
      await api.restoreProductSpotify(vendorId, productId);
      setProducts(prev => prev.map(p => p.productId === productId ? { ...p, syncStatus: null } : p));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  const handleDeletePermanently = async (productId: string, name: string) => {
    if (!confirm(`¿Eliminar definitivamente "${name}"?\n\nSus temas serán removidos de la playlist y no podrá volver a sincronizarse.`)) return;
    setActionId(productId);
    try {
      await api.deleteProductSpotifyPermanently(vendorId, productId);
      setProducts(prev => prev.filter(p => p.productId !== productId));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  const handleDeactivate = async (productId: string) => {
    setActionId(productId);
    try {
      await api.removeInactiveProductFromPlaylist(vendorId, productId);
      setInactiveProducts(prev => prev.filter(p => p.productId !== productId));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  const handleCheckSoldProducts = async () => {
    setCheckingSold(true);
    setError("");
    try {
      const inactive = await api.getInactiveSyncedProducts(vendorId);
      setInactiveProducts(inactive || []);
      setActiveTab("deactivate");
    } catch (err: any) {
      setError(err.message || "Error al buscar discos vendidos");
    } finally {
      setCheckingSold(false);
    }
  };

  const handleRemoveAllSoldProducts = async () => {
    const soldProducts = inactiveProducts.filter(p => p.reason === 'sin_stock');
    if (!soldProducts.length) return;
    if (!confirm(`Quitar ${soldProducts.length} disco(s) vendido(s) de la playlist de Spotify?`)) return;

    setRemovingSold(true);
    setError("");
    try {
      for (const product of soldProducts) {
        await api.removeInactiveProductFromPlaylist(vendorId, product.productId);
      }
      setInactiveProducts(prev => prev.filter(p => p.reason !== 'sin_stock'));
    } catch (err: any) {
      setError(err.message || "Error al quitar discos vendidos de Spotify");
      await handleCheckSoldProducts();
    } finally {
      setRemovingSold(false);
    }
  };

  const pendingProducts = products.filter(p => !p.syncedTracks?.length && p.syncStatus !== 'discarded');
  const syncedProducts = products.filter(p => p.syncedTracks?.length > 0 && p.syncStatus !== 'discarded');
  const discardedProducts = products.filter(p => p.syncStatus === 'discarded');
  const soldSyncedProducts = inactiveProducts.filter(p => p.reason === 'sin_stock');

  const tabs = [
    { id: "pending",    label: "No sincronizados", count: pendingProducts.length,    color: "amber" },
    { id: "synced",     label: "Sincronizados",    count: syncedProducts.length,     color: "green" },
    { id: "discarded",  label: "Descartados",      count: discardedProducts.length,  color: "gray" },
    { id: "deactivate", label: "Vendidos / sin stock",  count: inactiveProducts.length,   color: "orange" },
  ] as const;

  const renderProductRow = (p: any) => {
    const isSyncingThis = syncingId === p.productId;
    const isActioning = actionId === p.productId;
    const hasTracks = p.syncedTracks?.length > 0;
    const isError = p._syncStatus === 'error';
    const isSuccess = p._syncStatus === 'success';

    return (
      <div key={p.productId} className={`flex items-center gap-3 p-3.5 transition-colors ${isSuccess ? 'bg-green-50' : isError ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
        {/* Imagen */}
        {p.image ? (
          <img src={p.image} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 text-lg">💿</div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{p.artist || p.title}</p>
          <p className="text-xs text-gray-500 truncate">{p.album}</p>
          {hasTracks && (
            <div className="mt-1 flex flex-wrap gap-1">
              {p.syncedTracks.slice(0, 2).map((t: any, i: number) => (
                <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                  🎵 {t.name}
                </span>
              ))}
            </div>
          )}
          {isError && p._syncError && (
            <p className="text-xs text-red-500 mt-0.5">❌ {p._syncError}</p>
          )}
        </div>

        {/* Acciones según tab */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {activeTab === "pending" && (
            <>
              <button
                onClick={() => handleSyncOne(p.productId)}
                disabled={isSyncingThis || !!syncingId}
                className="px-2.5 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1"
                title="Sincronizar"
              >
                {isSyncingThis ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : '🔄'}
                <span className="hidden sm:inline">Sincronizar</span>
              </button>
              <button
                onClick={() => handleDiscard(p.productId)}
                disabled={isActioning}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-40"
                title="Descartar"
              >
                {isActioning ? <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" /> : 'Descartar'}
              </button>
            </>
          )}

          {activeTab === "synced" && (
            <>
              <button
                onClick={() => handleSyncOne(p.productId)}
                disabled={isSyncingThis || !!syncingId}
                className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1"
                title="Re-sincronizar: eliminará los temas anteriores y agregará los nuevos"
              >
                {isSyncingThis ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : '🔄'}
                <span className="hidden sm:inline">Re-sincronizar</span>
              </button>
              <button
                onClick={() => handleDeletePermanently(p.productId, p.artist || p.title)}
                disabled={isActioning}
                className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-40"
                title="Eliminar definitivamente: quita de playlist y bloquea futura sync"
              >
                {isActioning ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" /> : '🗑️'}
              </button>
            </>
          )}

          {activeTab === "discarded" && (
            <button
              onClick={() => handleRestore(p.productId)}
              disabled={isActioning}
              className="px-2.5 py-1.5 text-xs font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors disabled:opacity-40"
              title="Restaurar a No sincronizados"
            >
              {isActioning ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" /> : '↩️ Restaurar'}
            </button>
          )}

          {activeTab === "deactivate" && (
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                p.reason === 'desactivado' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {p.reason === 'desactivado' ? '🔴 Desactivado' : '📦 Sin stock'}
              </span>
              <button
                onClick={() => handleDeactivate(p.productId)}
                disabled={isActioning}
                className="px-2.5 py-1.5 text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1"
                title="Sacar los temas del playlist. El disco puede re-sincronizarse cuando vuelva a tener stock o se active."
              >
                {isActioning
                  ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />
                  : '⏏️'}
                <span className="hidden sm:inline">Desvincular</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const currentList = activeTab === "pending" ? pendingProducts
    : activeTab === "synced" ? syncedProducts
    : activeTab === "discarded" ? discardedProducts
    : inactiveProducts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🎵</span> Sincronizar Temas Spotify
          </CardTitle>
          <CardDescription>
            Gestiona qué álbumes sincronizan sus temas con tu playlist de Spotify
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Estado conexión */}
          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${oauthConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <span className={`w-2 h-2 rounded-full ${oauthConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              {oauthConnected ? `OAuth conectado${playlistName ? ` · ${playlistName}` : ''}` : 'OAuth no conectado'}
            </div>
            {!oauthConnected && (
              <p className="text-xs text-amber-600">⚠️ Sin OAuth los temas se guardan en DB pero no se agregan a la playlist</p>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">❌ {error}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 rounded-lg border border-orange-100 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Discos vendidos sincronizados en Spotify</p>
          <p className="text-xs text-gray-600">Busca productos sin stock que aun tengan temas en la playlist y quitalos cuando quieras.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCheckSoldProducts}
            disabled={checkingSold || removingSold}
            className="px-3 py-2 text-sm font-medium text-orange-700 bg-white border border-orange-200 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {checkingSold ? "Buscando..." : `Buscar vendidos (${soldSyncedProducts.length})`}
          </button>
          <button
            type="button"
            onClick={handleRemoveAllSoldProducts}
            disabled={removingSold || checkingSold || soldSyncedProducts.length === 0}
            className="px-3 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {removingSold ? "Quitando..." : "Quitar vendidos de Spotify"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      {!loading && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id
                  ? tab.color === 'green'  ? 'bg-green-100 text-green-700'
                    : tab.color === 'amber'  ? 'bg-amber-100 text-amber-700'
                    : tab.color === 'orange' ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-200 text-gray-600'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Contenido */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Cargando productos...
          </CardContent>
        </Card>
      ) : currentList.length === 0 ? (
        <Card>
          <CardContent className="py-14 flex flex-col items-center text-center gap-3">
            <div className="text-5xl">
              {activeTab === "pending" ? "✅" : activeTab === "synced" ? "📭" : activeTab === "discarded" ? "🗂️" : "✨"}
            </div>
            <p className="font-semibold text-gray-700">
              {activeTab === "pending" ? "Sin pendientes. ¡Todo sincronizado!"
               : activeTab === "synced" ? "Aún no hay álbumes sincronizados"
               : activeTab === "discarded" ? "No hay álbumes descartados"
               : "No hay álbumes para desvincular"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          {activeTab === "synced" && (
            <div className="px-4 pt-3 pb-0">
              <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                💡 <strong>Re-sincronizar</strong> elimina los temas anteriores de la playlist y agrega los nuevos. <strong>🗑️ Eliminar definitivamente</strong> quita los temas y bloquea esta disco de toda sincronización futura.
              </p>
            </div>
          )}
          {activeTab === "deactivate" && (
            <div className="px-4 pt-3 pb-0">
              <p className="text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                ⚠️ Estos álbumes tienen temas en tu playlist pero ya no están disponibles (sin stock o desactivados). Usa <strong>Desvincular</strong> para removerlos. Cuando vuelvan a tener stock o se activen, reaparecerán en <strong>No sincronizados</strong> y podrán re-sincronizarse.
              </p>
            </div>
          )}
          <CardContent className="p-0 mt-2">
            <div className="divide-y divide-gray-100">
              {currentList.map(renderProductRow)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SpotifyPlayerSection({ vendorId }: { vendorId: string }) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"tracks" | "albums" | "artists">("tracks");
  const [results, setResults] = useState<{ tracks?: any[]; albums?: any[]; artists?: any[] }>({});
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{ type: string; id: string; name: string; artist?: string } | null>(null);

  // Playlist management state
  const [oauthConnected, setOauthConnected] = useState(false);
  const [playlists, setPlaylists] = useState<{ id: string; name: string; total: number; image?: string }[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);
  const [playlistMsg, setPlaylistMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Currently playing state
  const [nowPlaying, setNowPlaying] = useState<any>(null);
  const [scopeMissing, setScopeMissing] = useState(false);

  useEffect(() => {
    loadOAuthAndPlaylists();
  }, [vendorId]);

  // Poll currently playing every 5 s when OAuth is connected
  useEffect(() => {
    if (!oauthConnected) { setNowPlaying(null); setScopeMissing(false); return; }
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await api.getCurrentlyPlaying(vendorId);
        if (!cancelled) { setNowPlaying(data); setScopeMissing(false); }
      } catch (err: any) {
        if (!cancelled) {
          if (err.message?.includes('SCOPE_MISSING')) setScopeMissing(true);
          setNowPlaying(null);
        }
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [vendorId, oauthConnected]);

  const loadOAuthAndPlaylists = async () => {
    try {
      const status = await api.getSpotifyStatus(vendorId);
      setOauthConnected(status.connected);
      if (status.connected) {
        if (status.playlistId) setSelectedPlaylistId(status.playlistId);
        const pls = await api.getSpotifyPlaylists(vendorId);
        setPlaylists(pls || []);
      }
    } catch {
      // not connected, ignore
    }
  };

  const handlePlaylistChange = async (newId: string) => {
    setSelectedPlaylistId(newId);
    try {
      await api.updateVendorSettings(vendorId, { spotifyPlaylistId: newId } as any);
    } catch (e) {
      console.error("Error saving playlist preference", e);
    }
  };

  const handleAddToPlaylist = async () => {
    if (!selected || !selectedPlaylistId) return;
    setAddingToPlaylist(true);
    setPlaylistMsg(null);
    try {
      let trackUris: string[] = [];
      if (selected.type === "track") {
        trackUris = [`spotify:track:${selected.id}`];
      } else if (selected.type === "album") {
        const topTracks = await api.getAlbumTopTracks(vendorId, selected.id, 2);
        trackUris = topTracks.map((t: any) => `spotify:track:${t.id}`);
      }
      if (trackUris.length === 0) {
        setPlaylistMsg({ type: "error", text: "No se encontraron canciones para agregar" });
        return;
      }
      await api.addTracksToPlaylist(vendorId, selectedPlaylistId, trackUris);
      const playlistName = playlists.find(p => p.id === selectedPlaylistId)?.name || "playlist";
      setPlaylistMsg({
        type: "success",
        text: `✅ ${trackUris.length === 1 ? "Canción agregada" : `${trackUris.length} canciones agregadas`} a "${playlistName}"`
      });
      setTimeout(() => setPlaylistMsg(null), 5000);
    } catch (err: any) {
      setPlaylistMsg({ type: "error", text: `❌ ${err.message || "Error al agregar a playlist"}` });
    } finally {
      setAddingToPlaylist(false);
    }
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const formatFollowers = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n?.toString() || "";
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setResults({});
    try {
      const data = await api.searchSpotifyForPlayer(vendorId, query.trim(), "track,album,artist");
      setResults(data);
      if (data.tracks?.length) setActiveTab("tracks");
      else if (data.albums?.length) setActiveTab("albums");
      else if (data.artists?.length) setActiveTab("artists");
    } catch (err: any) {
      setError(err.message || "Error al buscar en Spotify");
    } finally {
      setSearching(false);
    }
  };

  const selectItem = (type: string, id: string, name: string, artist?: string) => {
    setSelected({ type, id, name, artist });
  };

  const currentItems =
    activeTab === "tracks" ? results.tracks :
    activeTab === "albums" ? results.albums :
    results.artists;

  const tabs: { id: "tracks" | "albums" | "artists"; label: string; count: number }[] = [
    { id: "tracks", label: "🎵 Canciones", count: results.tracks?.length || 0 },
    { id: "albums", label: "💿 Álbumes", count: results.albums?.length || 0 },
    { id: "artists", label: "🎤 Artistas", count: results.artists?.length || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* ── Reproduciendo ahora ── */}
      {oauthConnected && (
        <Card className={`border-2 ${nowPlaying?.playing ? "border-green-400 bg-green-50" : "border-gray-200"}`}>
          <CardContent className="p-4">
            {scopeMissing ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Permiso requerido</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Para ver la canción actual necesitas reconectar Spotify con los nuevos permisos.
                    Ve a <strong>Integraciones → Spotify</strong>, desconecta y vuelve a conectar.
                  </p>
                </div>
              </div>
            ) : nowPlaying?.playing ? (
              <div className="flex items-start gap-4 flex-wrap">
                {/* Track info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {nowPlaying.albumImage && (
                    <img
                      src={nowPlaying.albumImage}
                      alt="album"
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0 shadow"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="flex gap-0.5 items-end h-4">
                        <span className="w-0.5 bg-green-500 rounded-full animate-bounce" style={{ height: "60%", animationDelay: "0ms" }} />
                        <span className="w-0.5 bg-green-500 rounded-full animate-bounce" style={{ height: "100%", animationDelay: "150ms" }} />
                        <span className="w-0.5 bg-green-500 rounded-full animate-bounce" style={{ height: "70%", animationDelay: "300ms" }} />
                        <span className="w-0.5 bg-green-500 rounded-full animate-bounce" style={{ height: "40%", animationDelay: "450ms" }} />
                      </span>
                      <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Reproduciendo ahora</span>
                    </div>
                    <p className="font-bold text-gray-900 truncate">{nowPlaying.trackName}</p>
                    <p className="text-sm text-gray-600 truncate">{nowPlaying.artist}</p>
                    {nowPlaying.albumName && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">💿 {nowPlaying.albumName}</p>
                    )}
                    {nowPlaying.durationMs && nowPlaying.progressMs !== undefined && (
                      <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, (nowPlaying.progressMs / nowPlaying.durationMs) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Linked product card */}
                {nowPlaying.linkedProduct ? (
                  <a
                    href={`http://localhost:3000/productos/${nowPlaying.linkedProduct.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-white border border-green-300 rounded-xl px-3 py-2.5 shadow-sm min-w-0 max-w-xs flex-shrink-0 transition-shadow hover:shadow-md hover:border-green-500 cursor-pointer"
                  >
                    {nowPlaying.linkedProduct.image ? (
                      <img
                        src={nowPlaying.linkedProduct.image}
                        alt={nowPlaying.linkedProduct.title}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl">💿</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-0.5">📦 En tienda</p>
                      <p className="text-sm font-bold text-gray-900 truncate leading-tight">{nowPlaying.linkedProduct.title}</p>
                      {nowPlaying.linkedProduct.artist && (
                        <p className="text-xs text-gray-500 truncate">{nowPlaying.linkedProduct.artist}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        {nowPlaying.linkedProduct.salePrice && nowPlaying.linkedProduct.salePrice < nowPlaying.linkedProduct.price ? (
                          <>
                            <span className="text-sm font-bold text-green-700">${nowPlaying.linkedProduct.salePrice.toLocaleString("es-CL")}</span>
                            <span className="text-xs text-gray-400 line-through">${nowPlaying.linkedProduct.price.toLocaleString("es-CL")}</span>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-gray-800">${nowPlaying.linkedProduct.price?.toLocaleString("es-CL")}</span>
                        )}
                        <span className="ml-auto text-xs text-green-600 font-medium flex-shrink-0">Ver →</span>                      </div>
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-400 italic flex-shrink-0">
                    <span>🔍</span> Sin producto vinculado en el marketplace
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-gray-500">
                <span className="text-xl">⏸</span>
                <span className="text-sm">Nada reproduciéndose ahora en Spotify</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🎧</span> Reproductor Spotify
          </CardTitle>
          <CardDescription>
            Busca canciones, álbumes o artistas y reprodúcelos directamente desde el panel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar artista, canción o álbum..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {searching ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M10 2a8 8 0 105.293 14.293l4.707 4.707 1.414-1.414-4.707-4.707A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4z"/></svg>
              )}
              Buscar
            </button>
          </form>
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠️ {error}{" "}
              {error.includes("credentials") && (
                <span>—{" "}
                  <button
                    className="underline text-red-800 font-medium"
                    onClick={() => {
                      const ev = new CustomEvent("navigate-settings", { detail: { section: "integraciones", subsection: "spotify" } });
                      window.dispatchEvent(ev);
                    }}
                  >
                    configura tu API de Spotify en Integraciones
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Playlist selector */}
          {oauthConnected && playlists.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">🎼</span>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs font-semibold text-green-800">Playlist destino</label>
                    <select
                      className="w-full mt-0.5 text-sm border border-green-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      value={selectedPlaylistId}
                      onChange={(e) => handlePlaylistChange(e.target.value)}
                    >
                      <option value="">— Selecciona una playlist —</option>
                      {playlists.map(pl => (
                        <option key={pl.id} value={pl.id}>{pl.name} ({pl.total} canciones)</option>
                      ))}
                    </select>
                  </div>
                </div>
                {selected && (selected.type === "track" || selected.type === "album") && selectedPlaylistId && (
                  <button
                    onClick={handleAddToPlaylist}
                    disabled={addingToPlaylist}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                  >
                    {addingToPlaylist
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : "➕"}
                    {selected.type === "album" ? "Agregar top 2 canciones" : "Agregar a Playlist"}
                  </button>
                )}
              </div>
              {playlistMsg && (
                <p className={`mt-2 text-sm font-medium ${playlistMsg.type === "success" ? "text-green-700" : "text-red-600"}`}>
                  {playlistMsg.text}
                </p>
              )}
            </div>
          )}
          {oauthConnected && playlists.length === 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              ⚠️ Cuenta conectada pero no se encontraron playlists. Crea una playlist en Spotify primero.
            </div>
          )}
          {!oauthConnected && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 flex items-center justify-between">
              <span>Conecta tu cuenta en <strong>Integraciones → Spotify</strong> para gestionar playlists</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results + Player */}
      {(currentItems || selected) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Results panel */}
          {(results.tracks?.length || results.albums?.length || results.artists?.length) ? (
            <Card>
              <CardContent className="p-4">
                {/* Tabs */}
                <div className="flex gap-1 mb-4 border-b border-gray-200 pb-2">
                  {tabs.filter(t => t.count > 0).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === t.id
                          ? "bg-green-500 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {t.label} <span className="ml-1 opacity-70">({t.count})</span>
                    </button>
                  ))}
                </div>

                {/* List */}
                <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
                  {activeTab === "tracks" && results.tracks?.map(track => (
                    <button
                      key={track.id}
                      onClick={() => selectItem("track", track.id, track.name, track.artist)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                        selected?.id === track.id ? "bg-green-50 border border-green-300" : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      {track.image ? (
                        <img src={track.image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">🎵</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{track.name}</p>
                        <p className="text-xs text-gray-500 truncate">{track.artist} · {track.album}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{track.durationMs ? formatDuration(track.durationMs) : ""}</span>
                    </button>
                  ))}

                  {activeTab === "albums" && results.albums?.map(album => (
                    <button
                      key={album.id}
                      onClick={() => selectItem("album", album.id, album.name, album.artist)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                        selected?.id === album.id ? "bg-green-50 border border-green-300" : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      {album.image ? (
                        <img src={album.image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">💿</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{album.name}</p>
                        <p className="text-xs text-gray-500 truncate">{album.artist} · {album.totalTracks} temas · {album.releaseDate?.slice(0, 4)}</p>
                      </div>
                    </button>
                  ))}

                  {activeTab === "artists" && results.artists?.map(artist => (
                    <button
                      key={artist.id}
                      onClick={() => selectItem("artist", artist.id, artist.name)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                        selected?.id === artist.id ? "bg-green-50 border border-green-300" : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      {artist.image ? (
                        <img src={artist.image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">🎤</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{artist.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {artist.genres?.join(", ")}
                          {artist.followers ? ` · ${formatFollowers(artist.followers)} seguidores` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Spotify Player */}
          {selected && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-800 truncate">{selected.name}</p>
                  {selected.artist && <p className="text-xs text-gray-500 truncate">{selected.artist}</p>}
                </div>
                <iframe
                  key={selected.id}
                  src={`https://open.spotify.com/embed/${selected.type}/${selected.id}?utm_source=generator&theme=0&autoplay=1`}
                  width="100%"
                  height="352"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="rounded-xl"
                ></iframe>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!searching && !error && !results.tracks && !results.albums && !results.artists && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl">🎧</div>
            <div>
              <p className="font-semibold text-gray-800">Busca cualquier canción, álbum o artista</p>
              <p className="text-sm text-gray-500 mt-1">Usa la barra de arriba para buscar en Spotify</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GeminiSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    geminiEnabled: false,
    geminiApiKey: "",
    geminiPrompt: `Crea una descripción cautivadora y profesional para este álbum musical.

Información del álbum:
- Artista: {artist}
- Álbum: {album}
- Año: {year}
- Género: {genre}
- Sello: {label}
- País: {country}

La descripción debe:
1. Destacar la importancia histórica o cultural del álbum
2. Mencionar características musicales distintivas
3. Incluir un dato curioso o anécdota interesante sobre su creación o impacto
4. Tener un tono profesional pero accesible
5. Tener entre 150-200 palabras

Formato: Texto corrido en español, sin usar asteriscos ni formato markdown.`,
  });

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setSettings({
        geminiEnabled: data.geminiEnabled || false,
        geminiApiKey: data.geminiApiKey || "",
        geminiPrompt: data.geminiPrompt || settings.geminiPrompt,
      });
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.updateVendorSettings(vendorId, settings);
      alert("Configuración guardada correctamente");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integración con Gemini AI</CardTitle>
        <CardDescription>
          Genera descripciones automáticas para tus productos usando inteligencia artificial
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-medium">Gemini API Key *</label>
            <input
              type="password"
              required
              value={settings.geminiApiKey}
              onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mt-2"
              placeholder="AIza..."
            />
            <p className="text-xs text-gray-500 mt-2">
              Obtén tu API key en{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Prompt Personalizado</label>
            <textarea
              value={settings.geminiPrompt}
              onChange={(e) => setSettings({ ...settings, geminiPrompt: e.target.value })}
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mt-2 font-mono text-sm"
              placeholder="Escribe tu prompt personalizado..."
            />
            <p className="text-xs text-gray-500 mt-2">
              Usa los shortcodes: {"{artist}"}, {"{album}"}, {"{year}"}, {"{genre}"}, {"{label}"}, {"{country}"}, {"{format}"}
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Habilitar Generación con IA</h3>
              <p className="text-sm text-gray-500 mt-1">
                Activa el botón "✨ Generar con IA" en el formulario de productos
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.geminiEnabled}
                onChange={(e) => setSettings({ ...settings, geminiEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {settings.geminiEnabled && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Cómo funciona:</h4>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li>Al crear un producto, ingresa la información básica (artista, álbum, año, etc.)</li>
                <li>Haz clic en el botón "✨ Generar con IA"</li>
                <li>Gemini creará una descripción profesional basada en tu prompt personalizado</li>
                <li>Puedes editar la descripción generada antes de guardar</li>
              </ol>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Design Section Components
function HeaderSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [headerType, setHeaderType] = useState(2);
  const [headerConfig, setHeaderConfig] = useState({
    logo: "",
    storeName: "",
    searchEnabled: true,
    topBarEnabled: true,
    socialLinks: {
      facebook: "",
      instagram: "",
      twitter: "",
      whatsapp: "",
    },
    topBarText: "",
    topBarBgColor: "#8B5CF6",
  });

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setHeaderType(data.headerType || 2);
      setHeaderConfig(data.headerConfig || headerConfig);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateVendorSettings(vendorId, { headerType, headerConfig });
      alert("Configuración guardada correctamente");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const headerTypes = [
    {
      id: 2,
      name: "Header Moderno E-commerce",
      description: "Logo izquierda + Buscador grande + Iconos derecha",
      features: ["Buscador prominente", "Carrito destacado", "Menú de categorías"],
    },
  ];

  // Previews visuales
  const renderPreview = (typeId: number) => {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Barra superior */}
        <div className="bg-gradient-to-r from-pink-500 to-red-500 px-3 py-1 text-white text-[7px] text-center">
          Envíos gratis sobre $50.000
        </div>
        {/* Header principal */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-[8px] font-bold text-purple-600"> TIENDA</div>
          <div className="flex-1 mx-2">
            <div className="bg-gray-100 rounded-full px-2 py-1 text-[7px] text-gray-400 flex items-center justify-between">
              <span>Buscar álbumes...</span>
              <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded-full">Buscar</span>
            </div>
          </div>
          <div className="flex gap-1 text-[7px] items-center">
            <span></span>
            <span></span>
            <span className="bg-purple-100 px-1 py-0.5 rounded"> 0</span>
            <span className="ml-1 opacity-60">|</span>
            <span className="flex gap-0.5 ml-1">f  </span>
          </div>
        </div>
        {/* Categorías */}
        <div className="flex gap-2 px-3 py-1.5 bg-gray-50 text-[7px] text-gray-600 border-b overflow-x-auto">
          <span> Todas</span>
          <span> Vinilos</span>
          <span> CDs</span>
          <span> Cassettes</span>
          <span className="text-red-600"> Ofertas</span>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración del Header</CardTitle>
        <CardDescription>Personaliza el encabezado de tu tienda</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          {/* Selección de tipo de header */}
          <div>
            <label className="block text-sm font-medium mb-4">Tipo de Header</label>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="mb-2">
                <h4 className="font-semibold text-sm">{headerTypes[0].name}</h4>
                <p className="text-xs text-gray-600 mt-1">{headerTypes[0].description}</p>
              </div>
              
              {/* Preview visual */}
              <div className="border-4 border-purple-500 rounded-lg mt-3">
                {renderPreview(2)}
              </div>
            </div>
          </div>

          {/* Configuración del logo */}
          <div>
            <label className="block text-sm font-medium mb-2">Logo</label>
            
            {/* Preview del logo */}
            {headerConfig.logo && (
              <div className="mb-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
                <img 
                  src={headerConfig.logo} 
                  alt="Logo preview" 
                  className="h-12 object-contain"
                />
              </div>
            )}

            {/* Botón para cargar archivo */}
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                id="logo-upload"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    console.log('⚠️ No file selected');
                    return;
                  }

                  console.log('🔍 DEBUG INFO:');
                  console.log('- File:', file.name, file.type, file.size, 'bytes');
                  console.log('- API_URL:', API_URL);
                  console.log('- vendorId:', vendorId);
                  console.log('- Token exists:', !!localStorage.getItem('token'));

                  try {
                    const formData = new FormData();
                    formData.append("files", file);

                    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                    const headers: HeadersInit = {};
                    if (token) {
                      headers['Authorization'] = `Bearer ${token}`;
                      console.log('- Token (first 20 chars):', token.substring(0, 20) + '...');
                    }

                    const uploadUrl = `${API_URL}/vendors/${vendorId}/upload-files`;
                    console.log('📤 Uploading to:', uploadUrl);
                    console.log('- Headers:', JSON.stringify(headers, null, 2));

                    const response = await fetch(uploadUrl, {
                      method: "POST",
                      headers,
                      body: formData,
                    });

                    console.log('📥 Response received:');
                    console.log('- Status:', response.status, response.statusText);
                    console.log('- OK:', response.ok);
                    console.log('- Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

                    if (!response.ok) {
                      const contentType = response.headers.get('content-type');
                      let errorText = '';
                      
                      try {
                        if (contentType?.includes('application/json')) {
                          const errorJson = await response.json();
                          errorText = JSON.stringify(errorJson, null, 2);
                          console.error('❌ Error JSON:', errorJson);
                        } else {
                          errorText = await response.text();
                          console.error('❌ Error Text:', errorText);
                        }
                      } catch (parseError) {
                        console.error('❌ Could not parse error response:', parseError);
                        errorText = 'Could not parse error response';
                      }

                      throw new Error(`Upload failed (${response.status}): ${errorText}`);
                    }

                    const data = await response.json();
                    console.log('✅ Upload successful:', data);
                    const logoUrl = data.urls[0];

                    setHeaderConfig({ ...headerConfig, logo: logoUrl });
                    alert('Logo subido exitosamente');
                  } catch (error) {
                    console.error('❌ FULL ERROR:', error);
                    if (error instanceof Error) {
                      console.error('- Error type:', error.constructor.name);
                      console.error('- Error message:', error.message);
                      console.error('- Error stack:', error.stack);
                      alert(`Error al subir el logo: ${error.message}`);
                    } else {
                      console.error('- Unknown error type:', typeof error);
                      alert('Error al subir el logo');
                    }
                  }
                }}
              />
              <label 
                htmlFor="logo-upload"
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer text-center font-medium transition-colors"
              >
                📤 Subir Logo
              </label>
              
              {headerConfig.logo && (
                <button
                  onClick={() => setHeaderConfig({ ...headerConfig, logo: '' })}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                >
                  🗑️ Eliminar
                </button>
              )}
            </div>

            {/* Input manual de URL (opcional) */}
            <details className="mt-3">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                O ingresar URL manualmente
              </summary>
              <input
                type="text"
                value={headerConfig.logo}
                onChange={(e) => setHeaderConfig({ ...headerConfig, logo: e.target.value })}
                className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="https://ejemplo.com/logo.png"
              />
            </details>
          </div>

          {/* Nombre de la tienda */}
          <div>
            <label className="block text-sm font-medium mb-2">Nombre en Header</label>
            <input
              type="text"
              value={headerConfig.storeName}
              onChange={(e) => setHeaderConfig({ ...headerConfig, storeName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Mi Tienda de Música"
            />
          </div>

          {/* Buscador */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={headerConfig.searchEnabled}
              onChange={(e) => setHeaderConfig({ ...headerConfig, searchEnabled: e.target.checked })}
              className="w-4 h-4 text-purple-600"
            />
            <label className="text-sm font-medium">Mostrar buscador en el header</label>
          </div>

          {/* Barra Superior */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="topBarEnabled"
                checked={headerConfig.topBarEnabled}
                onChange={(e) => setHeaderConfig({ ...headerConfig, topBarEnabled: e.target.checked })}
                className="w-4 h-4 text-purple-600"
              />
              <label htmlFor="topBarEnabled" className="text-sm font-medium">Mostrar barra superior de texto</label>
            </div>

            {headerConfig.topBarEnabled && (
              <div className="space-y-4 pl-7">
                <div>
                  <label className="block text-sm font-medium mb-2">Texto de la barra superior</label>
                  <input
                    type="text"
                    value={headerConfig.topBarText}
                    onChange={(e) => setHeaderConfig({ ...headerConfig, topBarText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Envíos gratis en compras sobre $50.000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Color de fondo</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={headerConfig.topBarBgColor}
                      onChange={(e) => setHeaderConfig({ ...headerConfig, topBarBgColor: e.target.value })}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={headerConfig.topBarBgColor}
                      onChange={(e) => setHeaderConfig({ ...headerConfig, topBarBgColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="#8B5CF6"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Nota sobre redes sociales */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
               <strong>Redes Sociales:</strong> Para configurar los iconos de redes sociales que aparecen en el header, 
              ve a <span className="font-semibold">Diseño ? Redes Sociales</span>
            </p>
          </div>
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Configuración"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================
// FRASES BARRA SUPERIOR SECTION
// ============================================
function FrasesBarraSuperiorSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [frases, setFrases] = useState<string[]>([]);
  const [enableRotating, setEnableRotating] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(5000);
  const [scrollSpeed, setScrollSpeed] = useState(50);
  const [newFrase, setNewFrase] = useState("");

  // Frases predefinidas de músicos famosos y datos curiosos
  const frasesPredefinidas = [
    // Frases de músicos/artistas
    '"La música puede cambiar el mundo porque puede cambiar a las personas" - Bono (U2)',
    '"La música es el lenguaje del espíritu. Abre el secreto de la vida trayendo paz, aboliendo la lucha" - Kahlil Gibran',
    '"Sin música, la vida sería un error" - Friedrich Nietzsche',
    '"La música expresa lo que no puede decirse con palabras pero no puede permanecer en silencio" - Victor Hugo',
    '"La música es la banda sonora de tu vida" - Dick Clark',
    '"Donde las palabras fallan, la música habla" - Hans Christian Andersen',
    '"La buena música no se toca, se siente" - Kurt Cobain (Nirvana)',
    '"Un disco de vinilo es una experiencia, no sólo música" - Jack White (The White Stripes)',
    '"El rock and roll es una forma de vida" - Keith Richards (The Rolling Stones)',
    '"La música es el arte más directo, entra por el oído y va al corazón" - Magdalena Martínez',
    
    // Sabías que...
    '¿Sabías que? El vinilo más caro vendido fue "Once Upon a Time in Shaolin" de Wu-Tang Clan por $2 millones',
    '¿Sabías que? El álbum "Thriller" de Michael Jackson es el más vendido de todos los tiempos con 66 millones de copias',
    '¿Sabías que? Los Beatles tienen el récord de más álbumes número 1 en el Billboard 200 con 19 álbumes',
    '¿Sabías que? El vinilo tiene un sonido más cálido porque captura más del espectro analógico',
    '¿Sabías que? El primer CD comercial fue "52nd Street" de Billy Joel, lanzado en 1982',
    '¿Sabías que? Pink Floyd grabó "Dark Side of the Moon", que estuvo 937 semanas en Billboard 200',
    '¿Sabías que? Elvis Presley tiene más álbumes de oro que cualquier otro artista solista',
    '¿Sabías que? El vinilo de 7 pulgadas a 45 RPM fue introducido por RCA Victor en 1949',
    '¿Sabías que? Queen grabó "Bohemian Rhapsody" en sólo 3 semanas',
    '¿Sabías que? El formato cassette fue inventado por Philips en 1963',
    '¿Sabías que? "Hotel California" de Eagles tardó 8 meses en grabarse',
    '¿Sabías que? David Bowie lanzó un álbum diferente casi cada año en los 70',
  ];

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getVendorSettings(vendorId);
      if (data.topBarPhrases) {
        setFrases(data.topBarPhrases.phrases || []);
        setEnableRotating(data.topBarPhrases.enableRotating ?? true);
        setRotationSpeed(data.topBarPhrases.rotationSpeed || 5000);
        setScrollSpeed(data.topBarPhrases.scrollSpeed || 50);
      }
    } catch (error) {
      console.error("Error loading phrases:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await api.updateVendorSettings(vendorId, {
        topBarPhrases: {
          phrases: frases,
          enableRotating,
          rotationSpeed,
          scrollSpeed,
        },
      });
      alert("✅ Frases guardadas correctamente");
    } catch (error: any) {
      console.error("Error saving phrases:", error);
      alert("❌ Error al guardar las frases");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFrase = () => {
    if (newFrase.trim()) {
      setFrases([...frases, newFrase.trim()]);
      setNewFrase("");
    }
  };

  const handleRemoveFrase = (index: number) => {
    setFrases(frases.filter((_, i) => i !== index));
  };

  const handleAddPredefinidas = () => {
    setFrases([...frases, ...frasesPredefinidas]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Frases Barra Superior</CardTitle>
        <CardDescription>
          Configura las frases que aparecerán rotando en la barra superior del header
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Activar rotación */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            id="enableRotating"
            checked={enableRotating}
            onChange={(e) => setEnableRotating(e.target.checked)}
            className="w-4 h-4 text-purple-600"
          />
          <label htmlFor="enableRotating" className="text-sm font-medium">
            Activar rotación automática de frases
          </label>
        </div>

        {/* Velocidades */}
        {enableRotating && (
          <div className="space-y-4 pl-7">
            <div>
              <label className="block text-sm font-medium mb-2">
                Velocidad de rotación (milisegundos)
              </label>
              <input
                type="number"
                value={rotationSpeed}
                onChange={(e) => setRotationSpeed(parseInt(e.target.value) || 5000)}
                min="1000"
                max="30000"
                step="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Tiempo que cada frase permanece visible (5000 = 5 segundos)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Velocidad de scroll para frases largas (píxeles/segundo)
              </label>
              <input
                type="number"
                value={scrollSpeed}
                onChange={(e) => setScrollSpeed(parseInt(e.target.value) || 50)}
                min="10"
                max="200"
                step="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Velocidad con la que se desplazan las frases largas que no caben
              </p>
            </div>
          </div>
        )}

        {/* Agregar frase */}
        <div>
          <label className="block text-sm font-medium mb-2">Agregar nueva frase</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFrase}
              onChange={(e) => setNewFrase(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddFrase()}
              placeholder='Ejemplo: "La música es vida" - Bob Marley'
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={handleAddFrase}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Agregar
            </button>
          </div>
        </div>

        {/* Botón cargar predefinidas */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAddPredefinidas}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <span>📚</span> Cargar {frasesPredefinidas.length} frases predefinidas
          </button>
        </div>

        {/* Lista de frases */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Frases configuradas ({frases.length})
          </label>
          {frases.length === 0 ? (
            <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
              No hay frases configuradas. Agrega algunas para comenzar.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {frases.map((frase, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 group"
                >
                  <span className="text-sm text-gray-600 flex-1">{frase}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFrase(index)}
                    className="text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar frase"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vista previa */}
        {frases.length > 0 && (
          <div className="p-4 bg-gray-900 text-white rounded-lg">
            <p className="text-xs text-gray-400 mb-2">Vista previa (simulación)</p>
            <div className="overflow-hidden">
              <p className="text-sm animate-pulse">
                {frases[0]}
              </p>
            </div>
          </div>
        )}

        {/* Guardar */}
        <div className="flex justify-end pt-4 border-t">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar Configuración"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// SLIDER PORTADA SECTION (Estilo MercadoLibre)
// ============================================
function SliderPortadaSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slides, setSlides] = useState<any[]>([]);
  const [heroConfig, setHeroConfig] = useState<any>({
    enabled: false,
    sliderId: null,
    autoplay: true,
    interval: 5,
    showArrows: true,
    showDots: true,
    height: 400,
    overlayCards: {
      enabled: false,
      items: [],
    },
  });
  
  // Estado para búsqueda de productos
  const [productSearch, setProductSearch] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [showProductResults, setShowProductResults] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getVendorSettings(vendorId);
      if (data.heroSliderConfig) {
        setHeroConfig({
          enabled: data.heroSliderConfig.enabled ?? false,
          sliderId: data.heroSliderConfig.sliderId ?? null,
          autoplay: data.heroSliderConfig.autoplay ?? true,
          interval: data.heroSliderConfig.interval ?? 5,
          showArrows: data.heroSliderConfig.showArrows ?? true,
          showDots: data.heroSliderConfig.showDots ?? true,
          height: data.heroSliderConfig.height ?? 400,
          overlayCards: data.heroSliderConfig.overlayCards ?? { enabled: false, items: [] },
        });
      }
      // Cargar sliders existentes
      setSlides(data.slides || []);
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateVendorSettings(vendorId, { heroSliderConfig: heroConfig });
      alert("Configuración guardada correctamente");
    } catch (error: any) {
      console.error("Error saving:", error);
      alert(error.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Buscar productos
  const searchProducts = async (query: string) => {
    if (!query || query.length < 2) {
      setProductSearchResults([]);
      setShowProductResults(false);
      return;
    }
    
    setLoadingProducts(true);
    try {
      const products = await api.searchProducts(vendorId, query, 10);
      setProductSearchResults(products);
      setShowProductResults(true);
    } catch (error) {
      console.error("Error searching products:", error);
      setProductSearchResults([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Debounce para búsqueda
  const handleProductSearch = (value: string) => {
    setProductSearch(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchProducts(value);
    }, 300);
  };

  // Agregar producto como card
  const addProductCard = (product: any) => {
    const newCard = {
      id: Date.now(),
      type: "product",
      productId: product.id,
      productName: product.title || product.name,
      productImage: product.images?.[0] || product.image || null,
      productPrice: product.price,
      productSlug: product.slug || product.id,
    };
    setHeroConfig({
      ...heroConfig,
      overlayCards: {
        ...heroConfig.overlayCards,
        items: [...(heroConfig.overlayCards?.items || []), newCard],
      },
    });
    setProductSearch("");
    setProductSearchResults([]);
    setShowProductResults(false);
  };

  const addOverlayCard = () => {
    const newCard = {
      id: Date.now(),
      type: "custom",
      icon: "📦",
      title: "Título",
      description: "Descripción de la card",
      linkType: "external",
      linkUrl: "",
      bgColor: "#ffffff",
      iconBgColor: "#f3e8ff",
    };
    setHeroConfig({
      ...heroConfig,
      overlayCards: {
        ...heroConfig.overlayCards,
        items: [...(heroConfig.overlayCards?.items || []), newCard],
      },
    });
  };

  const updateOverlayCard = (cardId: number, updates: any) => {
    setHeroConfig({
      ...heroConfig,
      overlayCards: {
        ...heroConfig.overlayCards,
        items: heroConfig.overlayCards.items.map((card: any) =>
          card.id === cardId ? { ...card, ...updates } : card
        ),
      },
    });
  };

  const deleteOverlayCard = (cardId: number) => {
    setHeroConfig({
      ...heroConfig,
      overlayCards: {
        ...heroConfig.overlayCards,
        items: heroConfig.overlayCards.items.filter((card: any) => card.id !== cardId),
      },
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Cargando configuración...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎠 Slider de Portada
          </CardTitle>
          <CardDescription>
            Configura el slider principal de la portada con efecto de cards superpuestas (estilo MercadoLibre).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Activar/Desactivar */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">Activar Slider de Portada</h3>
              <p className="text-sm text-gray-500">Muestra un slider con imágenes/videos en la parte superior de la portada</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={heroConfig.enabled}
                onChange={(e) => setHeroConfig({ ...heroConfig, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {heroConfig.enabled && (
            <>
              {/* Seleccionar Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slider a mostrar
                </label>
                {slides.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                    No tienes carruseles creados. Ve a "Carrusel de portada" para crear uno primero.
                  </div>
                ) : (
                  <select
                    value={heroConfig.sliderId || ""}
                    onChange={(e) => setHeroConfig({ ...heroConfig, sliderId: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Seleccionar slider --</option>
                    {slides.map((slider: any) => (
                      <option key={slider.id} value={slider.id}>
                        {slider.name} ({slider.items?.length || 0} slides)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Configuración del Slider */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Altura (px)
                  </label>
                  <input
                    type="number"
                    min="200"
                    max="800"
                    value={heroConfig.height}
                    onChange={(e) => setHeroConfig({ ...heroConfig, height: parseInt(e.target.value) || 400 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Intervalo autoplay (seg)
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="30"
                    value={heroConfig.interval}
                    onChange={(e) => setHeroConfig({ ...heroConfig, interval: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={heroConfig.autoplay}
                      onChange={(e) => setHeroConfig({ ...heroConfig, autoplay: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm">Autoplay</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={heroConfig.showArrows}
                      onChange={(e) => setHeroConfig({ ...heroConfig, showArrows: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm">Flechas</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={heroConfig.showDots}
                      onChange={(e) => setHeroConfig({ ...heroConfig, showDots: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm">Puntos</span>
                  </label>
                </div>
              </div>

              {/* Cards Superpuestas (Estilo MercadoLibre) */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      🃏 Cards Superpuestas
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Estilo MercadoLibre</span>
                    </h3>
                    <p className="text-sm text-gray-500">
                      Productos destacados que flotan sobre la parte inferior del slider.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={heroConfig.overlayCards?.enabled || false}
                      onChange={(e) => setHeroConfig({ 
                        ...heroConfig, 
                        overlayCards: { ...heroConfig.overlayCards, enabled: e.target.checked }
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {heroConfig.overlayCards?.enabled && (
                  <div className="space-y-4">
                    {/* Columnas por fila */}
                    <div className="flex items-center gap-4">
                      <label className="text-sm font-medium text-gray-700 w-48 shrink-0">
                        Productos por fila
                      </label>
                      <div className="flex items-center gap-2">
                        {[2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={n}
                            onClick={() => setHeroConfig({
                              ...heroConfig,
                              overlayCards: { ...heroConfig.overlayCards, columnsPerRow: n }
                            })}
                            className={`w-10 h-10 rounded-lg border-2 font-bold text-sm transition-all ${
                              (heroConfig.overlayCards?.columnsPerRow || 4) === n
                                ? 'border-purple-600 bg-purple-600 text-white'
                                : 'border-gray-300 text-gray-600 hover:border-purple-400'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 relative overflow-hidden" style={{ minHeight: "200px" }}>
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-100 to-transparent"></div>
                      <div className="relative z-10 pt-16">
                        <div className="grid grid-cols-4 gap-3">
                          {(heroConfig.overlayCards?.items || []).slice(0, 4).map((card: any) => (
                            <div key={card.id} className="bg-white rounded-lg shadow overflow-hidden">
                              {card.type === "product" ? (
                                <>
                                  <div className="aspect-square bg-gray-100 relative">
                                    {card.productImage ? (
                                      <img 
                                        src={card.productImage} 
                                        alt={card.productName}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">📦</div>
                                    )}
                                  </div>
                                  <div className="p-2">
                                    <p className="text-xs font-medium truncate">{card.productName}</p>
                                    <p className="text-xs text-purple-600 font-bold">
                                      ${card.productPrice?.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <div className="p-2 flex items-center gap-2">
                                  <span className="text-lg">{card.icon}</span>
                                  <span className="text-xs font-medium truncate">{card.title}</span>
                                </div>
                              )}
                            </div>
                          ))}
                          {(heroConfig.overlayCards?.items || []).length === 0 && (
                            <div className="col-span-4 text-center text-white/70 text-sm py-8">
                              Busca productos para agregar como cards destacadas
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Buscador de Productos */}
                    {(heroConfig.overlayCards?.items?.length || 0) < 12 && (
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          🔍 Buscar producto para agregar
                        </label>
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => handleProductSearch(e.target.value)}
                          onFocus={() => productSearchResults.length > 0 && setShowProductResults(true)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Escribe el nombre del producto..."
                        />
                        {loadingProducts && (
                          <div className="absolute right-3 top-10 text-gray-400">
                            <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                          </div>
                        )}
                        
                        {/* Resultados de búsqueda */}
                        {showProductResults && productSearchResults.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                            {productSearchResults.map((product: any) => (
                              <button
                                key={product.id}
                                onClick={() => addProductCard(product)}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-purple-50 transition-colors border-b last:border-b-0"
                              >
                                <div className="w-12 h-12 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                                  {product.images?.[0] || product.image ? (
                                    <img 
                                      src={product.images?.[0] || product.image} 
                                      alt={product.title || product.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">📦</div>
                                  )}
                                </div>
                                <div className="flex-1 text-left">
                                  <p className="font-medium text-gray-900 truncate">{product.title || product.name}</p>
                                  <p className="text-sm text-purple-600 font-bold">
                                    ${product.price?.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </p>
                                </div>
                                <span className="text-purple-500 text-xl">+</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Lista de Cards de Productos */}
                    <div className="space-y-3">
                      {(heroConfig.overlayCards?.items || []).map((card: any, index: number) => (
                        <div key={card.id} className="border rounded-lg p-4 bg-white">
                          <div className="flex items-center gap-4">
                            {/* Número */}
                            <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {index + 1}
                            </div>

                            {card.type === "product" ? (
                              <>
                                {/* Imagen del producto */}
                                <div className="w-16 h-16 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                                  {card.productImage ? (
                                    <img 
                                      src={card.productImage} 
                                      alt={card.productName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">📦</div>
                                  )}
                                </div>
                                
                                {/* Info del producto */}
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{card.productName}</p>
                                  <p className="text-purple-600 font-bold">
                                    ${card.productPrice?.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                {/* Card custom legacy */}
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0" 
                                     style={{ backgroundColor: card.iconBgColor || "#f3e8ff" }}>
                                  {card.icon}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{card.title}</p>
                                  <p className="text-sm text-gray-500">{card.description}</p>
                                </div>
                              </>
                            )}

                            {/* Botón eliminar */}
                            <button
                              onClick={() => deleteOverlayCard(card.id)}
                              className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Info */}
                    {(heroConfig.overlayCards?.items?.length || 0) >= 12 && (
                      <div className="text-center text-sm text-gray-500 bg-gray-50 rounded-lg py-3">
                        Máximo 12 productos destacados
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Botón Guardar */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Configuración"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SlidesSection({ vendorId, initialSliderId }: { vendorId: string; initialSliderId?: number | null }) {
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [vendorSlug, setVendorSlug] = useState<string>("");
  const [selectedSlideId, setSelectedSlideId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "edit">("list");
  const [uploading, setUploading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [showProductResults, setShowProductResults] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const initialSliderAppliedRef = useRef(false);

  const gradients = [
    { name: "Púrpura", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { name: "Océano", value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
    { name: "Fuego", value: "linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)" },
  ];

  useEffect(() => {
    loadSettings();
    loadCategories();
    // No necesitamos cargar vendor info para el marketplace
  }, [vendorId]);

  useEffect(() => {
    if (initialSliderAppliedRef.current || !initialSliderId || !slides.length) return;
    const found = slides.find((slider) => Number(slider.id) === Number(initialSliderId));
    if (found) {
      setSelectedSlideId(found.id);
      setViewMode("edit");
    }
    initialSliderAppliedRef.current = true;
  }, [initialSliderId, slides]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      const loadedSlides = (data.slides || []).map((slide: any) => {
        // Si ya tiene estructura nueva (items array), usarla
        if (slide.items && Array.isArray(slide.items)) {
          return {
            ...slide,
            name: slide.name || "Carrusel de portada",
            position: slide.position || "top",
          };
        }
        // Si es estructura antigua (sin items), convertir a nuevo formato
        return {
          id: slide.id || Date.now(),
          name: slide.name || "Carrusel de portada",
          showInHomepage: slide.showInHomepage || false,
          position: slide.position || "top",
          order: slide.order || 0,
          items: [slide] // El slide antiguo se convierte en el primer item del slider
        };
      });
      setSlides(loadedSlides);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api.getVendorCategories(vendorId);
      setCategories(data);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.updateVendorSettings(vendorId, { slides });
      alert("Carrusel guardado correctamente");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert(error.message || "Error al guardar el carrusel");
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async (query: string) => {
    if (!query || query.length < 2) {
      setProductSearchResults([]);
      return;
    }
    
    setLoadingProducts(true);
    try {
      const response = await fetch(`${API_URL}/products?search=${encodeURIComponent(query)}&isActive=true&limit=10`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setProductSearchResults(data.products || []);
    } catch (error) {
      console.error("Error searching products:", error);
      setProductSearchResults([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const ProductSearchInput = ({ vendorId, value, productName, onChange }: any) => {
    const [search, setSearch] = useState(productName || "");
    const [results, setResults] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (productName) {
        setSearch(productName);
      }
    }, [productName]);

    const handleSearch = async (query: string) => {
      setSearch(query);
      if (!query || query.length < 2) {
        setResults([]);
        setShowResults(false);
        return;
      }
      
      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/products?search=${encodeURIComponent(query)}&isActive=true&limit=10`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await response.json();
        setResults(data.products || []);
        setShowResults(true);
      } catch (error) {
        console.error("Error searching products:", error);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            handleSearch(e.target.value);
          }}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Buscar producto por nombre..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        {loading && <div className="absolute right-3 top-3 text-gray-400 text-xs">Buscando...</div>}
        {showResults && results.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {results.map((product) => (
              <button
                key={product.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSearch(product.title);
                  setShowResults(false);
                  onChange(product.id, product.title);
                }}
                className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-sm">{product.title}</div>
                <div className="text-xs text-gray-500">${Math.round(Number(product.price) || 0).toLocaleString('es-CL')}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const CategorySelect = ({ vendorId, value, onChange }: any) => {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      >
        <option value="">Seleccionar categoría...</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.icon} {cat.name}
          </option>
        ))}
      </select>
    );
  };

  const addSlider = () => {
    const name = prompt("Nombre interno del carrusel", `Carrusel ${slides.length + 1}`);
    if (name === null) return;
    
    const newSlider = {
      id: Date.now(),
      name: name.trim() || `Carrusel ${slides.length + 1}`,
      showInHomepage: false,
      position: "top",
      usePageMargins: true,
      order: slides.length,
      items: [ // Array de slides dentro del slider
        {
          id: Date.now(),
          mediaType: "gradient",
          imageUrl: "",
          videoUrl: "",
          gradient: gradients[0].value,
          title: "",
          description: "",
          buttonText: "Ver más",
          buttonLinkType: "external",
          buttonLink: "",
          buttonProductId: "",
          buttonProductName: "",
          buttonCategoryId: "",
          buttonBgColor: "#8b5cf6",
          buttonTextColor: "#ffffff",
          imageOpacity: 0.3,
          titleShadow: true,
          transition: "fade",
          order: 0,
        }
      ],
    };
    setSlides([...slides, newSlider]);
    setSelectedSlideId(newSlider.id);
    setViewMode("edit");
  };

  const editSlide = (id: number) => {
    setSelectedSlideId(id);
    setViewMode("edit");
  };

  const backToList = () => {
    setViewMode("list");
    setSelectedSlideId(null);
  };

  const updateSlide = (id: number, updates: any) => {
    setSlides(slides.map((slide) => (slide.id === id ? { ...slide, ...updates } : slide)));
  };

  const toggleSliderVisibility = async (id: number) => {
    const nextSlides = slides.map((slide) =>
      slide.id === id ? { ...slide, showInHomepage: !slide.showInHomepage } : slide
    );
    setSlides(nextSlides);
    try {
      await api.updateVendorSettings(vendorId, { slides: nextSlides });
    } catch (error: any) {
      setSlides(slides);
      alert(error.message || "No se pudo actualizar el estado del carrusel");
    }
  };

  const deleteSlide = (id: number) => {
    if (confirm("¿Eliminar este carrusel?")) {
      setSlides(slides.filter((slide) => slide.id !== id));
      if (selectedSlideId === id) {
        backToList();
      }
    }
  };



  const handleImageUpload = async (slideId: number, file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);

      // Obtener el token de autenticación
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/vendors/${vendorId}/upload-files`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error uploading file: ${errorText}`);
      }

      const data = await response.json();
      const fileUrl = data.urls[0];

      // Determinar si es Imagen o Video
      const isVideo = file.type.startsWith("video/");
      
      // Actualizar el slide dentro del slider actual
      if (selectedSlide && selectedSlide.items) {
        const updatedItems = selectedSlide.items.map((item: any) => {
          if (item.id === slideId) {
            if (isVideo) {
              return { ...item, mediaType: "video", videoUrl: fileUrl };
            } else {
              return { ...item, mediaType: "image", imageUrl: fileUrl };
            }
          }
          return item;
        });
        updateSlide(selectedSlide.id, { items: updatedItems });
        alert(isVideo ? "Video subido correctamente" : "Imagen subida correctamente");
      }
    } catch (error: any) {
      console.error("Error uploading file:", error);
      alert(error.message || "Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  };



  const selectedSlide = selectedSlideId ? slides.find(s => s.id === selectedSlideId) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Carrusel de portada</CardTitle>
            <CardDescription>Configura las diapositivas que se mostrarán una después de otra. Cada diapositiva puede usar una imagen, un video o un fondo de color.</CardDescription>
          </div>
          {viewMode === "list" && (
            <button
              type="button"
              onClick={addSlider}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              + Nuevo carrusel
            </button>
          )}
          {viewMode === "edit" && (
            <button
              type="button"
              onClick={backToList}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Volver a carruseles
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {viewMode === "list" ? (
          // Vista de Listado
          slides.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="mb-4">No hay carruseles configurados</p>
              <button
                type="button"
                onClick={addSlider}
                className="px-4 py-2 border border-purple-500 text-purple-600 rounded-lg hover:bg-purple-50"
              >
                + Crear primer carrusel
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {slides.map((slider) => {
                const firstSlide = slider.items?.[0] || {};
                return (
                  <div
                    key={slider.id}
                    className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-purple-300 transition-colors bg-white"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Preview thumbnail */}
                      <div 
                        className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0"
                        style={{
                          background: firstSlide.mediaType === "image" && firstSlide.imageUrl
                            ? `url(${firstSlide.imageUrl}) center/cover`
                            : firstSlide.gradient || gradients[0].value,
                        }}
                      >
                        {firstSlide.mediaType === "video" && firstSlide.videoUrl && (
                          <video
                            src={firstSlide.videoUrl}
                            className="w-full h-full object-cover"
                            muted
                          />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{slider.name || "Sin nombre"}</h3>
                          <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                            {slider.position === "middle" ? "Medio" : slider.position === "bottom" ? "Inferior" : "Superior"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {slider.items?.length || 0} diapositiva(s)
                          {firstSlide.title && ` · ${firstSlide.title}`}
                          {firstSlide.mediaType === "video" && " · 🎥"}
                          {firstSlide.mediaType === "image" && " · 🖼️"}
                          {firstSlide.mediaType === "gradient" && " · 🎨"}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={slider.showInHomepage}
                          onClick={() => toggleSliderVisibility(slider.id)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${slider.showInHomepage ? "bg-sky-600" : "bg-gray-300"}`}
                          title={slider.showInHomepage ? "Desactivar carrusel" : "Activar carrusel"}
                        >
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${slider.showInHomepage ? "translate-x-5" : "translate-x-0.5"}`} />
                        </button>
                        <span className="w-14 text-xs font-medium text-gray-600">{slider.showInHomepage ? "Activo" : "Inactivo"}</span>
                        <button
                          onClick={() => editSlide(slider.id)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteSlide(slider.id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : selectedSlide ? (
          // Vista de Edición de Slider
          <>
            <SliderEditor
              slider={selectedSlide}
              gradients={gradients}
              vendorId={vendorId}
              vendorSlug={vendorSlug}
              categories={categories}
              onUpdate={(updates: any) => updateSlide(selectedSlide.id, updates)}
              onImageUpload={handleImageUpload}
              uploading={uploading}
              ProductSearchInput={ProductSearchInput}
              CategorySelect={CategorySelect}
            />
            {/* Botón de guardar */}
            <div className="flex justify-end pt-4 border-t mt-4">
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

// Componente para editar un slider individual
function SliderEditor({ slider, gradients, vendorId, vendorSlug, categories, onUpdate, onImageUpload, uploading, ProductSearchInput, CategorySelect }: any) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  
  const currentSlide = slider.items?.[activeSlideIndex];

  const addSlideToSlider = () => {
    const newSlide = {
      id: Date.now(),
      mediaType: "gradient",
      imageUrl: "",
      videoUrl: "",
      gradient: gradients[0].value,
      title: "",
      description: "",
      buttonText: "Ver más",
      buttonLinkType: "external",
      buttonLink: "",
      buttonProductId: "",
      buttonProductName: "",
      buttonCategoryId: "",
      buttonBgColor: "#8b5cf6",
      buttonTextColor: "#ffffff",
      imageOpacity: 0.3,
      titleShadow: true,
      transition: "fade",
      order: slider.items?.length || 0,
    };
    onUpdate({ items: [...(slider.items || []), newSlide] });
    setActiveSlideIndex(slider.items?.length || 0);
  };

  const updateCurrentSlide = (updates: any) => {
    const updatedItems = slider.items.map((item: any, idx: number) =>
      idx === activeSlideIndex ? { ...item, ...updates } : item
    );
    onUpdate({ items: updatedItems });
  };

  const deleteCurrentSlide = () => {
    if (!confirm("¿Eliminar este banner del carrusel?")) return;
    const updatedItems = slider.items.filter((_: any, idx: number) => idx !== activeSlideIndex);
    onUpdate({ items: updatedItems });
    if (activeSlideIndex >= updatedItems.length) {
      setActiveSlideIndex(Math.max(0, updatedItems.length - 1));
    }
  };

  if (!currentSlide) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Este carrusel todavía no tiene diapositivas</p>
        <button
          onClick={addSlideToSlider}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          + Agregar primera diapositiva
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Nombre del slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Nombre interno del carrusel</label>
        <input
          type="text"
          value={slider.name || ""}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Ej: Contenido de portada"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación en la página</label>
        <select
          value={slider.position || "top"}
          onChange={(e) => onUpdate({ position: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="top">Superior — seguido de la cabecera</option>
          <option value="middle">Medio — después del contenido principal</option>
          <option value="bottom">Inferior — después del pie de página</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">Puedes activar o desactivar este carrusel desde el listado.</p>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div><span className="block text-sm font-semibold text-gray-900">Margen exterior</span><span className="block text-xs text-gray-500">Deja separación alrededor del carrusel y limita su ancho.</span></div>
        <div className="flex items-center gap-2"><span className="text-xs font-medium text-gray-600">{slider.usePageMargins !== false ? "Con margen" : "Sin margen"}</span><input type="checkbox" checked={slider.usePageMargins !== false} onChange={(e) => onUpdate({ usePageMargins: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500" /></div>
      </label>

      {/* Pestañas de slides */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {slider.items.map((item: any, index: number) => (
          <button
            key={item.id}
            onClick={() => setActiveSlideIndex(index)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all whitespace-nowrap ${
              activeSlideIndex === index
                ? "bg-purple-100 text-purple-700 font-medium border-b-2 border-purple-500"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>Diapositiva {index + 1}</span>
            {item.mediaType === "video" && "🎥"}
            {item.mediaType === "image" && "🖼️"}
            {item.mediaType === "gradient" && "🎨"}
          </button>
        ))}
        <button
          onClick={addSlideToSlider}
          className="px-3 py-2 border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 rounded-t-lg transition-all text-sm"
        >
          + Agregar diapositiva
        </button>
      </div>

      <div className="space-y-4 pt-4">
                {/* Preview del slide */}
                <div className="relative h-64 rounded-lg overflow-hidden border-2 border-gray-200">
                  {/* Video de fondo */}
                  {currentSlide.mediaType === "video" && currentSlide.videoUrl && (
                    <video
                      src={currentSlide.videoUrl}
                      className="absolute inset-0 w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                    />
                  )}
                  
                  {/* Imagen o gradiente de fondo */}
                  {currentSlide.mediaType !== "video" && (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: currentSlide.mediaType === "image" && currentSlide.imageUrl
                          ? `url(${currentSlide.imageUrl}) center/cover`
                          : currentSlide.gradient,
                      }}
                    />
                  )}

                  {/* Overlay con contenido */}
                  <div 
                    className="absolute inset-0 flex flex-col items-center justify-center text-white p-6"
                    style={{
                      backgroundColor: `rgba(0, 0, 0, ${currentSlide.imageOpacity || 0.3})`
                    }}
                  >
                    {currentSlide.title && (
                      <h3 
                        className="text-3xl font-bold mb-2"
                        style={{
                          textShadow: currentSlide.titleShadow !== false 
                            ? '2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)' 
                            : 'none'
                        }}
                      >
                        {currentSlide.title}
                      </h3>
                    )}
                    {currentSlide.description && (
                      <p className="text-base mb-4 drop-shadow-lg">{currentSlide.description}</p>
                    )}
                    {currentSlide.buttonText && (
                      <button 
                        className="px-6 py-2 rounded-lg font-medium shadow-lg"
                        style={{
                          backgroundColor: currentSlide.buttonBgColor || "#8b5cf6",
                          color: currentSlide.buttonTextColor || "#ffffff",
                        }}
                      >
                        {currentSlide.buttonText}
                      </button>
                    )}
                  </div>
                </div>

                {/* Formulario de edición */}
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  {/* Selector de tipo de fondo */}
                  <div className="border-b pb-4">
                    <p className="mb-2 text-sm font-semibold text-gray-800">1. Elige el contenido de fondo</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { value: "image", label: "Imagen", description: "Una fotografía o pieza gráfica", icon: "▧" },
                        { value: "video", label: "Video", description: "Movimiento sin sonido", icon: "▶" },
                        { value: "gradient", label: "Color", description: "Fondo simple sin archivo", icon: "◐" },
                      ].map((option) => (
                        <button key={option.value} type="button" onClick={() => updateCurrentSlide({ mediaType: option.value })} className={`rounded-lg border p-3 text-left transition-all ${currentSlide.mediaType === option.value ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100" : "border-gray-200 bg-white hover:border-sky-300"}`}>
                          <span className="mb-2 block text-xl text-sky-600">{option.icon}</span><span className="block text-sm font-bold text-gray-900">{option.label}</span><span className="mt-1 block text-xs text-gray-500">{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>



                  {/* Selector de gradientes */}
                  {currentSlide.mediaType === "gradient" && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Selecciona un Gradiente</label>
                      <div className="grid grid-cols-3 gap-3">
                        {gradients.map((grad: { name: string; value: string }) => (
                          <div
                            key={grad.name}
                            onClick={() => updateCurrentSlide({ gradient: grad.value })}
                            className={`cursor-pointer h-20 rounded-lg border-2 transition-all flex items-end p-2 ${
                              currentSlide.gradient === grad.value
                                ? "border-purple-500 ring-2 ring-purple-200"
                                : "border-gray-300 hover:border-purple-300"
                            }`}
                            style={{ background: grad.value }}
                          >
                            <span className="text-white text-xs font-medium drop-shadow-md">{grad.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload de Imagen */}
                  {currentSlide.mediaType === "image" && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Subir Imagen</label>
                      {!currentSlide.imageUrl ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) onImageUpload(currentSlide.id, file);
                            }}
                            className="hidden"
                            id={`upload-image-${currentSlide.id}`}
                            disabled={uploading}
                          />
                          <label
                            htmlFor={`upload-image-${currentSlide.id}`}
                            className="cursor-pointer block"
                          >
                            <div className="text-4xl mb-2">?</div>
                            <div className="text-sm text-purple-600 font-medium">
                              {uploading ? "Subiendo..." : "Haz clic para subir Imagen"}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">JPG, PNG, WEBP (máx. 20MB)</p>
                          </label>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(`upload-image-${currentSlide.id}`) as HTMLInputElement;
                            input?.click();
                          }}
                          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          Cambiar Imagen
                        </button>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onImageUpload(currentSlide.id, file);
                        }}
                        className="hidden"
                        id={`upload-image-${currentSlide.id}`}
                        disabled={uploading}
                      />
                    </div>
                  )}

                  {/* Upload de Video */}
                  {currentSlide.mediaType === "video" && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Subir Video</label>
                      {!currentSlide.videoUrl ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                          <input
                            type="file"
                            accept="video/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) onImageUpload(currentSlide.id, file);
                            }}
                            className="hidden"
                            id={`upload-video-${currentSlide.id}`}
                            disabled={uploading}
                          />
                          <label
                            htmlFor={`upload-video-${currentSlide.id}`}
                            className="cursor-pointer block"
                          >
                            <div className="text-4xl mb-2"></div>
                            <div className="text-sm text-purple-600 font-medium">
                              {uploading ? "Subiendo..." : "Haz clic para subir Video"}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">MP4, WEBM, OGG (máx. 20MB)</p>
                          </label>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(`upload-video-${currentSlide.id}`) as HTMLInputElement;
                            input?.click();
                          }}
                          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          Cambiar Video
                        </button>
                      )}
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onImageUpload(currentSlide.id, file);
                        }}
                        className="hidden"
                        id={`upload-video-${currentSlide.id}`}
                        disabled={uploading}
                      />
                    </div>
                  )}

                  <p className="border-t pt-4 text-sm font-semibold text-gray-800">2. Escribe el mensaje</p>
                  <div>
                    <label className="block text-sm font-medium mb-2">Título</label>
                    <input
                      type="text"
                      value={currentSlide.title}
                      onChange={(e) => updateCurrentSlide({ title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Título principal del banner"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Descripción</label>
                    <textarea
                      value={currentSlide.description}
                      onChange={(e) => updateCurrentSlide({ description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Descripción breve"
                      rows={2}
                    />
                  </div>

                  <p className="border-t pt-4 text-sm font-semibold text-gray-800">3. Configura el botón</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2">Texto del botón</label>
                      <input
                        type="text"
                        value={currentSlide.buttonText}
                        onChange={(e) => updateCurrentSlide({ buttonText: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Ver más"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">¿A dónde llevará?</label>
                      <select
                        value={currentSlide.buttonLinkType || "external"}
                        onChange={(e) => updateCurrentSlide({
                          buttonLinkType: e.target.value,
                          buttonText: e.target.value === "none" ? "" : currentSlide.buttonText || "Ver más",
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="none">Sin botón</option>
                        <option value="product">Ir a un producto</option>
                        <option value="category">Ir a una categoría</option>
                        <option value="external">Página o enlace externo</option>
                      </select>
                    </div>
                  </div>

                  {currentSlide.buttonLinkType !== "none" && (
                    <>
                    <div>
                    <label className="block text-sm font-medium mb-2">
                      {currentSlide.buttonLinkType === "product" && "Buscar Producto"}
                      {currentSlide.buttonLinkType === "category" && "Seleccionar Categoría"}
                      {(!currentSlide.buttonLinkType || currentSlide.buttonLinkType === "external") && "Enlace del Botón"}
                    </label>
                    {currentSlide.buttonLinkType === "product" ? (
                      <ProductSearchInput
                        vendorId={vendorId}
                        value={currentSlide.buttonProductId || ""}
                        productName={currentSlide.buttonProductName || ""}
                        onChange={(productId: string, productName: string) => 
                          updateCurrentSlide({ 
                            buttonProductId: productId,
                            buttonProductName: productName,
                            buttonLink: vendorSlug ? `/tiendas/${vendorSlug}/productos/${productId}` : `/products/${productId}`,
                          })
                        }
                      />
                    ) : currentSlide.buttonLinkType === "category" ? (
                      <CategorySelect
                        vendorId={vendorId}
                        value={currentSlide.buttonCategoryId || ""}
                        onChange={(categoryId: string) =>
                          updateCurrentSlide({
                            buttonCategoryId: categoryId,
                            buttonLink: vendorSlug ? `/tiendas/${vendorSlug}/productos?categoria=${categoryId}` : `/productos?categoria=${categoryId}`,
                          })
                        }
                      />
                    ) : (
                      <input
                        type="text"
                        value={currentSlide.buttonLink}
                        onChange={(e) => updateCurrentSlide({ buttonLink: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="/productos o https://ejemplo.com"
                      />
                    )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Color del Botón</label>
                      <input
                        type="color"
                        value={currentSlide.buttonBgColor || "#8b5cf6"}
                        onChange={(e) => updateCurrentSlide({ buttonBgColor: e.target.value })}
                        className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Color del Texto del Botón</label>
                      <input
                        type="color"
                        value={currentSlide.buttonTextColor || "#ffffff"}
                        onChange={(e) => updateCurrentSlide({ buttonTextColor: e.target.value })}
                        className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                      />
                    </div>
                    </div>
                    </>
                  )}

                  <p className="border-t pt-4 text-sm font-semibold text-gray-800">4. Ajusta la visualización</p>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Opacidad de la Capa Oscura: {Math.round((currentSlide.imageOpacity || 0.3) * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={currentSlide.imageOpacity || 0.3}
                      onChange={(e) => updateCurrentSlide({ imageOpacity: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Sin oscurecer (0%)</span>
                      <span>Muy oscuro (100%)</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Controla qué tan oscura es la capa sobre la Imagen/video</p>
                  </div>

                  {/* Sombra del título */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentSlide.titleShadow !== false}
                        onChange={(e) => updateCurrentSlide({ titleShadow: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Agregar sombra al título</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">Mejora la legibilidad del título sobre fondos claros</p>
                  </div>
                </div>
              </div>

      {/* Botón de eliminar slide actual */}
      <div className="flex justify-between items-center pt-4 border-t">
        <button
          onClick={deleteCurrentSlide}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          🗑️ Eliminar este Slide
        </button>
        <span className="text-sm text-gray-500">
          Diapositiva {activeSlideIndex + 1} de {slider.items.length}
        </span>
      </div>
    </div>
  );
}

function PromotionsSection({ vendorId, initialMode = "overview" }: { vendorId: string; initialMode?: "overview" | "carousels" | "banners" }) {
  const [mode, setMode] = useState(initialMode);
  const [selectedCarouselId, setSelectedCarouselId] = useState<number | null>(null);
  if (mode === "overview") return <PromotionsOverview vendorId={vendorId} onOpenCarousels={(id) => { setSelectedCarouselId(id ? Number(id) : null); setMode("carousels"); }} onOpenBanners={() => setMode("banners")} />;
  return <div className="space-y-4"><button type="button" onClick={() => setMode("overview")} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Volver a bloques de contenido</button>{mode === "carousels" ? <SlidesSection vendorId={vendorId} initialSliderId={selectedCarouselId} /> : <BannersSection vendorId={vendorId} />}</div>;
}

function BannersSection({ vendorId }: { vendorId: string }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [menuLinks, setMenuLinks] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      const [categoriesData, genresData, settingsData] = await Promise.all([
        api.getAllCategories(),
        api.getGenres(),
        api.getVendorSettings(vendorId),
      ]);
      setCategories(categoriesData);
      setGenres(genresData);
      
      // Extraer nombres de páginas personalizadas del menú principal y secundario
      const principalLinks = settingsData?.menus?.principal
        ?.map((l: any) => l.title || l.name || l.label)
        .filter((title: string) => title && title.trim()) || [];
      const secundarioLinks = settingsData?.menus?.secundario
        ?.map((l: any) => l.title || l.name || l.label)
        .filter((title: string) => title && title.trim()) || [];
      const allLinks = [...principalLinks, ...secundarioLinks];
      console.log('Menu links loaded:', allLinks);
      setMenuLinks(allLinks);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  return (
    <BannerConfigUI
      vendorId={vendorId}
      categories={categories}
      genres={genres}
      menuLinks={menuLinks}
    />
  );
}

function GridsSection({ vendorId }: { vendorId: string }) {
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadCategories();
  }, [vendorId]);

  const loadCategories = async () => {
    try {
      const data = await api.getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  return <GridConfigUI vendorId={vendorId} categories={categories} />;
}

// Sortable item component for drag & drop with real product page preview
function SortableProductSection({ section, area }: { section: any; area: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : section.enabled ? 1 : 0.4,
  };

  // Real visual representations for each section
  const getSectionContent = () => {
    switch (section.id) {
      case "gallery":
        return (
          <div className="space-y-3">
            <div className="w-full aspect-square bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
              <img
                src="/api/placeholder/400/400"
                alt="Producto"
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<div class="text-gray-500 text-sm">Imagen Principal</div>';
                }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        );
      case "title":
        return (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Los Tres (2) - Fome</h1>
            <p className="text-gray-600">Los Tres (2)</p>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className="text-gray-300">★</span>
              ))}
              <span className="text-sm text-gray-500 ml-1">(0.00)</span>
            </div>
          </div>
        );
      case "short-description":
        return (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
            <p className="text-sm text-gray-700">
              Los Tres (2) - Fome (2013)<br />
              Sello: Plaza Independencia Música<br />
              Género: Rock<br />
              Estilo: Alternative Rock
            </p>
          </div>
        );
      case "price":
        return (
          <div>
            <div className="text-3xl font-bold text-gray-900">$25000.00</div>
          </div>
        );
      case "product-actions":
      case "add-to-cart":
        return (
          <div className="space-y-2">
            <button className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-semibold transition-all flex items-center justify-center gap-2">
              🛒 Añadir al carrito
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button className="border border-green-600 bg-gray-100 text-gray-900 py-3 px-4 rounded-md font-medium transition-all flex items-center justify-center gap-2">
                ⤴ Compartir
              </button>
              <button className="border border-green-600 bg-gray-100 text-gray-900 py-3 px-4 rounded-md font-medium transition-all flex items-center justify-center gap-2">
                👁 Añadir a la lista de deseos
              </button>
            </div>
          </div>
        );
      case "buy-now":
        return null;
      case "description":
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              Los Bunkers - Los Bunkers (2001)<br/>
              Sello: Big Sur Records<br/>
              Género: Rock<br/>
              Estilo: Rockabilly<br/><br/>
              Track 11 is denoted as a bonus track.
            </p>
          </div>
        );
      case "spotify-player":
        // Responsive Spotify player based on area
        if (area === "right-top") {
          return (
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-white/20 rounded"></div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">Fome - Los Tres</div>
                  <div className="text-white/80 text-xs">Muestra</div>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-16 h-16 bg-white/20 rounded"></div>
              <div className="flex-1">
                <div className="text-white font-semibold mb-1">Fome - Los Tres</div>
                <div className="text-white/80 text-sm">Muestra</div>
              </div>
            </div>
            <div className="text-center text-white text-sm">
              Escuchar en Spotify
            </div>
          </div>
        );
      case "product-details":
        return (
          <div className="p-4 bg-white rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Detalles del Producto</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Condición:</span>
                <span className="font-medium">Usado</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Escala Goldmine (Media):</span>
                <span className="font-medium">VG+</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Escala Goldmine (Portada):</span>
                <span className="font-medium">NM</span>
              </div>
            </div>
          </div>
        );
      case "tabs":
        return (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button className="px-6 py-3 border-b-2 border-blue-500 text-blue-600 font-semibold">
                Descripción
              </button>
              <button className="px-6 py-3 text-gray-600">
                Listado de Temas
              </button>
              <button className="px-6 py-3 text-gray-600">
                Datos Técnicos
              </button>
            </div>
            <div className="p-6 bg-white">
              <p className="text-gray-700 leading-relaxed text-sm">
                Presentamos la edición de 2013 de "Fome", el segundo álbum de Los Tres
                que marcó un hito en el rock chileno de los años 90...
              </p>
            </div>
          </div>
        );
      case "tracklist":
      case "tracklist-block":
        return (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-800">🎵 Listado de Temas</h3>
            </div>
            <div className="p-2 space-y-1 max-h-20 overflow-y-auto">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2 text-xs py-0.5">
                  <span className="text-gray-500 font-medium w-4 flex-shrink-0">{i}.</span>
                  <span className="text-gray-600 truncate">Canción {i}</span>
                </div>
              ))}
              <div className="text-xs text-gray-400 italic pt-1">+ 2 más...</div>
            </div>
          </div>
        );
      default:
        return <div className="p-4 bg-gray-100 rounded text-sm text-gray-500">Sección desconocida</div>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? "z-50" : ""}`}
    >
      {/* Drag Handle Overlay - Covers entire block for easy dragging */}
      <div
        {...attributes}
        {...listeners}
        className={`absolute inset-0 cursor-grab active:cursor-grabbing rounded-lg ${
          isDragging
            ? "bg-blue-500/20 border-2 border-blue-500"
            : "border-2 border-transparent"
        }`}
      />

      {/* Control Panel - Top Right */}
      <div className="absolute top-1 right-1 bg-white rounded shadow-sm px-2 py-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 pointer-events-auto text-xs z-10">
        <GripVertical className="h-3 w-3 text-blue-600 flex-shrink-0" />
        <span className="font-semibold text-gray-700 whitespace-nowrap text-xs">{section.name}</span>
        <label className="flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={section.enabled}
            onChange={(e) => {
              section.onToggle(section.id, e.target.checked);
            }}
            className="w-3 h-3 text-blue-600 rounded cursor-pointer"
          />
        </label>
      </div>

      {/* Content */}
      <div className="pointer-events-auto">
        {getSectionContent()}
      </div>
    </div>
  );
}

// Componente para pestañas ordenables horizontalmente
function SortableTabItem({ section }: { section: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative px-4 py-2.5 bg-white rounded-lg border-2 border-indigo-300 
        hover:border-indigo-500 cursor-move flex items-center gap-2
        ${isDragging ? 'opacity-50 shadow-2xl z-50' : 'shadow-sm'}
      `}
    >
      <GripVertical className="h-4 w-4 text-indigo-400" />
      <span className="text-sm font-medium text-gray-700">{section.name}</span>
      <label 
        className="flex items-center gap-1 ml-2 pointer-events-auto" 
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={section.enabled}
          onChange={(e) => {
            section.onToggle(section.id, e.target.checked);
          }}
          className="w-3.5 h-3.5 text-indigo-600 rounded"
        />
      </label>
    </div>
  );
}

// General tab with drag & drop functionality
function GeneralTab({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  
  // Nueva estructura: soporta tanto elementos simples como filas con 2 columnas
  // Formato: { type: 'single', section } o { type: 'row', sections: [a, b] }
  const [rightSections, setRightSections] = useState<any[]>([
    { type: 'single', section: { id: "title", name: "Título del Producto", enabled: true, order: 1 } },
    { type: 'single', section: { id: "price", name: "Precio", enabled: true, order: 2 } },
    { type: 'single', section: { id: "short-description", name: "Descripción Corta", enabled: true, order: 3 } },
    { type: 'single', section: { id: "product-details", name: "Detalles del Producto (Goldmine)", enabled: true, order: 4 } },
    { type: 'single', section: { id: "product-actions", name: "Botones de acción", enabled: true, order: 5 } },
    { type: 'single', section: { id: "tracklist-block", name: "Listado de Temas", enabled: false, order: 7 } },
    { type: 'single', section: { id: "spotify-player", name: "Reproductor Spotify", enabled: true, order: 8 } },
  ]);

  const [tabSections, setTabSections] = useState([
    { id: "tracklist-tab", name: "Listado de Temas", enabled: true, order: 1 },
    { id: "description-tab", name: "Descripción", enabled: true, order: 2 },
    { id: "technical", name: "Datos Técnicos", enabled: true, order: 3 },
    { id: "spotify-tab", name: "Reproductor Spotify", enabled: true, order: 4 },
  ]);

  // Estado para configuración de barra de información
  const [infoBarConfig, setInfoBarConfig] = useState<{
    enabled: boolean;
    leftFields: string[];
    rightFields: string[];
    showIcons: boolean;
  }>({
    enabled: true,
    leftFields: ['format', 'label', 'year'],
    rightFields: ['goldmine'],
    showIcons: true
  });

  const [showInfoBarModal, setShowInfoBarModal] = useState(false);

  // Estado para configuración de categoría en grid de productos
  const [productGridCategoryDisplay, setProductGridCategoryDisplay] = useState<{
    mode: 'none' | 'icon' | 'name';
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  }>({
    mode: 'none',
    position: 'top-right'
  });

  const [showGridCategoryModal, setShowGridCategoryModal] = useState(false);
  const [stickyPurchasePanel, setStickyPurchasePanel] = useState(true);
  const [productPageLayoutConfig, setProductPageLayoutConfig] = useState<Record<string, any>>({});

  // Estado para unir bloques
  const [mergingMode, setMergingMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);

  const normalizeSection = (section: any) => {
    if (!section) return section;
    if (section.id === 'buy-now') return null;
    if (section.id === 'add-to-cart') {
      return { ...section, id: 'product-actions', name: 'Botones de acción' };
    }
    return section;
  };

  const canonicalSectionId = (id: string) => {
    if (id === 'tracklist') return 'tracklist-block';
    if (id === 'add-to-cart') return 'product-actions';
    return id;
  };

  const normalizeLayoutItems = (items: any[]) => {
    const seen = new Set<string>();
    return items.map((item) => {
      if (item.type === 'single') {
        const section = normalizeSection(item.section);
        return section ? { ...item, section } : null;
      }
      if (item.type === 'row') {
        const sections = (item.sections || []).map(normalizeSection).filter(Boolean);
        if (sections.length === 0) return null;
        if (sections.length === 1) return { type: 'single', section: sections[0] };
        return { ...item, sections };
      }
      const section = normalizeSection(item);
      return section ? { type: 'single', section } : null;
    }).filter(Boolean).filter((item: any) => {
      const ids = item.type === 'single'
        ? [canonicalSectionId(item.section?.id)]
        : (item.sections || []).map((section: any) => canonicalSectionId(section.id));
      const hasDuplicate = ids.some((sectionId: string) => seen.has(sectionId));
      ids.forEach((sectionId: string) => seen.add(sectionId));
      return !hasDuplicate;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    console.log("🔵 GeneralTab mounted with vendorId:", vendorId);
    if (vendorId) {
      loadSettings();
    }
  }, [vendorId]);

  const loadSettings = async () => {
    if (!vendorId) return;
    
    console.log("🔄 Cargando configuración para vendorId:", vendorId);
    try {
      const response = await api.getVendorSettings(vendorId);
      console.log("Configuración cargada:", response);
      
      if (response.productPageRightColumnOrder) {
        // Migrar formato antiguo al nuevo si es necesario
        const loaded = response.productPageRightColumnOrder;
        console.log("📦 Loaded productPageRightColumnOrder:", loaded);
        if (Array.isArray(loaded) && loaded.length > 0) {
          // Si es el formato antiguo (array de objetos con id directo)
          if (loaded[0].id && !loaded[0].type) {
            console.log("🔄 Migrating old format to new format");
            const migrated = loaded.map(section => {
              // Cambiar id 'tracklist' antiguo a 'tracklist-block'
              if (section.id === 'tracklist') {
                return {
                  type: 'single',
                  section: { ...section, id: 'tracklist-block' }
                };
              }
              return {
                type: 'single',
                section: section
              };
            }).filter((item: any, idx: number, arr: any[]) => {
              // Deduplicar tracklist-block
              if (item.type === 'single' && item.section?.id === 'tracklist-block') {
                // Solo mantener la primera ocurrencia
                return arr.findIndex((i: any) => i.type === 'single' && i.section?.id === 'tracklist-block') === idx;
              }
              return true;
            });
            console.log("✅ Migrated sections:", migrated);
            
            // Asegurar que tracklist esté incluido si no existe
            const hasTracklist = migrated.some(item => item.section?.id === 'tracklist-block');
            if (!hasTracklist) {
              migrated.push({
                type: 'single',
                section: { id: "tracklist-block", name: "Listado de Temas", enabled: false, order: migrated.length + 1 }
              });
            }
            // Asegurar que todos los bloques conocidos estén presentes (ej: spotify-player añadido después)
            const allKnownSections = [
              { id: "title", name: "Título del Producto", enabled: true },
              { id: "price", name: "Precio", enabled: true },
              { id: "short-description", name: "Descripción Corta", enabled: true },
              { id: "product-details", name: "Detalles del Producto (Goldmine)", enabled: true },
              { id: "product-actions", name: "Botones de acción", enabled: true },
              { id: "description", name: "Descripción", enabled: false },
              { id: "tracklist-block", name: "Listado de Temas", enabled: false },
              { id: "spotify-player", name: "Reproductor Spotify", enabled: false },
            ];
            const existingSectionIds = new Set(migrated.flatMap((item: any) => {
              if (item.type === 'single') return [item.section?.id === 'tracklist' ? 'tracklist-block' : item.section?.id];
              return (item.sections || []).map((s: any) => s.id === 'tracklist' ? 'tracklist-block' : s.id);
            }).filter(Boolean));
            allKnownSections.forEach(known => {
              if (!existingSectionIds.has(known.id)) {
                migrated.push({ type: 'single', section: { id: known.id, name: known.name, enabled: known.enabled, order: migrated.length + 1 } });
              }
            });
            setRightSections(normalizeLayoutItems(migrated));
          } else {
            // Ya está en el formato nuevo
            console.log("✅ Already in new format");
            
            // Migrar cualquier 'tracklist' antiguo a 'tracklist-block' y deduplicar
            let hasTracklist = false;
            const migrated = loaded.map((item: any) => {
              if (item.type === 'single' && (item.section?.id === 'tracklist' || item.section?.id === 'tracklist-block')) {
                hasTracklist = true;
                return {
                  ...item,
                  section: { ...item.section, id: 'tracklist-block' }
                };
              }
              return item;
            }).filter((item: any, idx: number, arr: any[]) => {
              // Deduplicar tracklist-block
              if (item.type === 'single' && item.section?.id === 'tracklist-block') {
                // Solo mantener la primera ocurrencia
                return arr.findIndex((i: any) => i.type === 'single' && i.section?.id === 'tracklist-block') === idx;
              }
              return true;
            });
            
            // Asegurar que tracklist esté incluido si no existe
            if (!hasTracklist) {
              migrated.push({
                type: 'single',
                section: { id: "tracklist-block", name: "Listado de Temas", enabled: false, order: migrated.length + 1 }
              });
            }
            // Asegurar que todos los bloques conocidos estén presentes (ej: spotify-player añadido después)
            const allKnownSections = [
              { id: "title", name: "Título del Producto", enabled: true },
              { id: "price", name: "Precio", enabled: true },
              { id: "short-description", name: "Descripción Corta", enabled: true },
              { id: "product-details", name: "Detalles del Producto (Goldmine)", enabled: true },
              { id: "product-actions", name: "Botones de acción", enabled: true },
              { id: "description", name: "Descripción", enabled: false },
              { id: "tracklist-block", name: "Listado de Temas", enabled: false },
              { id: "spotify-player", name: "Reproductor Spotify", enabled: false },
            ];
            const existingSectionIds = new Set(migrated.flatMap((item: any) => {
              if (item.type === 'single') return [item.section?.id === 'tracklist' ? 'tracklist-block' : item.section?.id];
              return (item.sections || []).map((s: any) => s.id === 'tracklist' ? 'tracklist-block' : s.id);
            }).filter(Boolean));
            allKnownSections.forEach(known => {
              if (!existingSectionIds.has(known.id)) {
                migrated.push({ type: 'single', section: { id: known.id, name: known.name, enabled: known.enabled, order: migrated.length + 1 } });
              }
            });
            setRightSections(normalizeLayoutItems(migrated));
          }
        }
      } else {
        console.log("⚠️ No productPageRightColumnOrder found in response");
        // Si no hay configuración guardada, usar la por defecto (que ya incluye tracklist)
        // rightSections ya tiene el valor por defecto
      }
      if (response.productPageTabsOrder) {
        // Migrar tracklist a tracklist-tab si es necesario
        const tabs = response.productPageTabsOrder
          .filter((tab: any) => tab.id !== 'artist-bio')
          .map((tab: any) => tab.id === 'tracklist' ? { ...tab, id: 'tracklist-tab' } : tab);
        
        // Definir todas las pestañas disponibles
        const allAvailableTabs = [
          { id: "tracklist-tab", name: "Listado de Temas", enabled: true, order: 1 },
          { id: "description-tab", name: "Descripción", enabled: true, order: 2 },
          { id: "technical", name: "Datos Técnicos", enabled: true, order: 3 },
          { id: "spotify-tab", name: "Reproductor Spotify", enabled: true, order: 4 },
        ];
        
        // Agregar pestañas nuevas que no existan en la configuración guardada
        const existingIds = new Set(tabs.map((t: any) => t.id));
        const newTabs = allAvailableTabs.filter(t => !existingIds.has(t.id));
        const maxOrder = Math.max(...tabs.map((t: any) => t.order || 0), 0);
        const mergedTabs = [
          ...tabs,
          ...newTabs.map((t, idx) => ({ ...t, order: maxOrder + idx + 1 }))
        ];
        
        setTabSections(mergedTabs);
      }
      
      // Cargar configuración de barra de información
      if (response.productInfoBar) {
        setInfoBarConfig({
          enabled: response.productInfoBar.enabled ?? true,
          leftFields: response.productInfoBar.leftFields || ['format', 'label', 'year'],
          rightFields: response.productInfoBar.rightFields || ['goldmine'],
          showIcons: response.productInfoBar.showIcons ?? true,
        });
      }

      const loadedProductPageLayout = response.productPageLayout || {};
      setProductPageLayoutConfig(loadedProductPageLayout);
      setStickyPurchasePanel(loadedProductPageLayout.stickyPurchasePanel !== false);
      
      // Cargar configuración de categoría en grid
      if (response.productGridCategoryDisplay) {
        setProductGridCategoryDisplay(response.productGridCategoryDisplay);
      }
    } catch (error) {
      console.error("Error loading product page settings:", error);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Determinar si es columna derecha o pestañas
    const isTab = tabSections.some(t => t.id === active.id);
    
    if (isTab) {
      setTabSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return newItems.map((item, index) => ({ ...item, order: index + 1 }));
      });
    } else {
      setRightSections((items) => {
        const oldIndex = items.findIndex((item) => {
          if (item.type === 'single') return item.section.id === active.id;
          return item.sections?.some((s: any) => s.id === active.id);
        });
        const newIndex = items.findIndex((item) => {
          if (item.type === 'single') return item.section.id === over.id;
          return item.sections?.some((s: any) => s.id === over.id);
        });
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        return newItems.map((item, index) => {
          if (item.type === 'single') {
            return {
              ...item,
              section: { ...item.section, order: index + 1 }
            };
          } else {
            return {
              ...item,
              sections: item.sections.map((s: any, i: number) => ({
                ...s,
                order: index + 1 + (i * 0.1)
              }))
            };
          }
        });
      });
    }
  };

  const handleToggle = (id: string, enabled: boolean, isTab = false) => {
    if (isTab) {
      setTabSections((items) =>
        items.map((item) => (item.id === id ? { ...item, enabled } : item))
      );
    } else {
      setRightSections((items) =>
        items.map((item) => {
          if (item.type === 'single') {
            // Si buscamos "tracklist", también buscar "tracklist-block"
            const matches = id === 'tracklist' 
              ? (item.section.id === 'tracklist' || item.section.id === 'tracklist-block')
              : (item.section.id === id);
            
            if (matches) {
              return { ...item, section: { ...item.section, enabled } };
            }
          } else if (item.type === 'row') {
            return {
              ...item,
              sections: item.sections.map((s: any) => {
                const matches = id === 'tracklist'
                  ? (s.id === 'tracklist' || s.id === 'tracklist-block')
                  : (s.id === id);
                return matches ? { ...s, enabled } : s;
              })
            };
          }
          return item;
        })
      );
    }
  };

  const handleBlockSelection = (id: string) => {
    if (!mergingMode) return;

    if (selectedForMerge.includes(id)) {
      // Deseleccionar
      setSelectedForMerge(prev => prev.filter(i => i !== id));
    } else if (selectedForMerge.length < 2) {
      // Seleccionar (máximo 2)
      const newSelection = [...selectedForMerge, id];
      setSelectedForMerge(newSelection);

      // Si ya tenemos 2 seleccionados, unirlos automáticamente
      if (newSelection.length === 2) {
        mergeBlocks(newSelection[0], newSelection[1]);
      }
    }
  };

  const mergeBlocks = (id1: string, id2: string) => {
    setRightSections((items) => {
      // Encontrar los índices de ambos bloques
      const index1 = items.findIndex(item => 
        item.type === 'single' && item.section.id === id1
      );
      const index2 = items.findIndex(item => 
        item.type === 'single' && item.section.id === id2
      );

      if (index1 === -1 || index2 === -1) return items;

      const section1 = items[index1].section;
      const section2 = items[index2].section;

      // Crear nueva fila con ambos bloques
      const mergedRow = {
        type: 'row',
        sections: [section1, section2]
      };

      // Insertar en la posición del primer bloque y eliminar ambos originales
      const newItems = [...items];
      const insertAt = Math.min(index1, index2);
      const removeFirst = Math.max(index1, index2);
      const removeSecond = Math.min(index1, index2);

      newItems.splice(removeFirst, 1);
      newItems.splice(removeSecond, 1, mergedRow);

      return newItems;
    });

    // Resetear estado de unión
    setMergingMode(false);
    setSelectedForMerge([]);
  };

  const unmergeBlock = (rowIndex: number) => {
    setRightSections((items) => {
      const row = items[rowIndex];
      if (row.type !== 'row') return items;

      // Separar la fila en bloques individuales
      const individual1 = { type: 'single', section: row.sections[0] };
      const individual2 = { type: 'single', section: row.sections[1] };

      const newItems = [...items];
      newItems.splice(rowIndex, 1, individual1, individual2);

      return newItems;
    });
  };

  const handleSave = async () => {
    if (!vendorId) {
      alert("Error: No se encontró el ID del vendedor");
      return;
    }

    setLoading(true);
    console.log("Guardando configuración...", {
      vendorId,
      productPageRightColumnOrder: rightSections,
      productPageTabsOrder: tabSections,
      productInfoBar: infoBarConfig,
      productPageLayout: { ...productPageLayoutConfig, stickyPurchasePanel },
      productGridCategoryDisplay: productGridCategoryDisplay
    });

    try {
      const response = await api.updateVendorSettings(vendorId, {
        productPageRightColumnOrder: rightSections,
        productPageTabsOrder: tabSections,
        productInfoBar: infoBarConfig,
        productPageLayout: { ...productPageLayoutConfig, stickyPurchasePanel },
        productGridCategoryDisplay: productGridCategoryDisplay,
      });
      console.log("Respuesta del servidor:", response);
      alert("✅ Configuración guardada exitosamente");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert(`❌ Error al guardar: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  // Aplanar rightSections para obtener todas las secciones individuales (dedup por ID canónico)
  const flattenedSections = rightSections.flatMap(item => {
    if (item.type === 'single') return [item.section];
    return item.sections || [];
  }).filter((section: any, idx: number, arr: any[]) => {
    const canonicalId = canonicalSectionId(section.id);
    return arr.findIndex((s: any) => (s.id === 'tracklist' ? 'tracklist-block' : s.id) === canonicalId) === idx;
  });

  console.log("🎨 Rendering GeneralTab with:", {
    rightSections,
    flattenedSections,
    mergingMode,
    selectedForMerge
  });

  // Transformar rightSections para agregar onToggle a cada sección (deduplicar por ID primero)
  // Normalizar tracklist → tracklist-block para evitar que ambas IDs cuenten como bloques distintos
  const seenSectionIds = new Set<string>();
  const rightWithHandlers = rightSections.filter(item => {
    if (item.type === 'single' && item.section?.id) {
      const canonicalId = canonicalSectionId(item.section.id);
      if (seenSectionIds.has(canonicalId)) return false;
      seenSectionIds.add(canonicalId);
    }
    return true;
  }).map(item => {
    if (item.type === 'single') {
      return {
        ...item,
        section: {
          ...item.section,
          onToggle: (id: string, enabled: boolean) => handleToggle(id, enabled, false)
        }
      };
    } else if (item.type === 'row') {
      return {
        ...item,
        sections: item.sections.map((s: any) => ({
          ...s,
          onToggle: (id: string, enabled: boolean) => handleToggle(id, enabled, false)
        }))
      };
    }
    return item;
  });
  
  const tabWithHandlers = tabSections.map((s) => ({ ...s, onToggle: (id: string, enabled: boolean) => handleToggle(id, enabled, true) }));
  
  // Filtrar hiddenSections para evitar duplicados (ej: tracklist y tracklist-block)
  const hiddenBlockSections = flattenedSections.filter(s => !s.enabled);
  const hiddenBlocksSectionIds = new Set(hiddenBlockSections.map(s => {
    // Normalizar tracklist a tracklist-block para evitar duplicados
    return canonicalSectionId(s.id);
  }));
  
  // Mantener solo un "Listado de Temas" (el tracklist-block o tracklist) y deduplicar por ID
  const hiddenSectionsFiltered = hiddenBlockSections.filter((section, idx, arr) => {
    // Si es tracklist y existe tracklist-block, omitir este
    if (section.id === 'tracklist' && arr.some(s => s.id === 'tracklist-block')) {
      return false;
    }
    // Deduplicar por ID: mantener solo la primera ocurrencia
    return arr.findIndex(s => s.id === section.id) === idx;
  });
  
  // Separar bloques ocultos de pestañas ocultas
  const hiddenBlocks = hiddenSectionsFiltered;
  const hiddenTabs = tabSections.filter(s => !s.enabled);

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          🎨 Editor Visual de Página de Producto
        </h3>
        <p className="text-sm text-gray-600">
          Pasa el mouse sobre cualquier elemento para ver el control de arrastre. 
          Arrastra para reordenar, usa el checkbox para mostrar/ocultar.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Panel de compra fijo al desplazarse</h3>
          <p className="mt-1 text-sm text-gray-600">
            Mantiene visible la ficha de datos y compra a la derecha en computadores.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={stickyPurchasePanel}
          onClick={() => setStickyPurchasePanel((enabled) => !enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${stickyPurchasePanel ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${stickyPurchasePanel ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Merge Blocks Button */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => {
            setMergingMode(!mergingMode);
            setSelectedForMerge([]);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            mergingMode 
              ? 'bg-purple-600 text-white hover:bg-purple-700' 
              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
          }`}
        >
          {mergingMode ? '❌ Cancelar Unión' : '🔗 Unir Bloques'}
        </button>

        {/* Info Bar Configuration Button */}
        <button
          onClick={() => setShowInfoBarModal(true)}
          className="px-4 py-2 rounded-lg font-medium transition-all bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600"
        >
          ⚙️ Configurar Barra de Información
        </button>

        {/* Grid Category Display Configuration Button */}
        <button
          onClick={() => setShowGridCategoryModal(true)}
          className="px-4 py-2 rounded-lg font-medium transition-all bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
        >
          🏷️ Configurar Categoría en Grid
        </button>
        
        {mergingMode && (
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-300 rounded-lg">
            <span className="text-sm font-medium text-purple-800">
              {selectedForMerge.length === 0 && 'Selecciona 2 bloques para unir'}
              {selectedForMerge.length === 1 && 'Selecciona 1 bloque más'}
              {selectedForMerge.length === 2 && 'Uniendo bloques...'}
            </span>
          </div>
        )}
      </div>

      {/* Hidden Elements Panel - Bloques */}
      {hiddenBlocks.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
            👁️ Elementos Ocultos ({hiddenBlocks.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {hiddenBlocks.map((section) => (
              <button
                key={section.id}
                onClick={() => handleToggle(section.id, true, false)}
                className="px-3 py-2 bg-white border border-orange-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-orange-100 hover:border-orange-400 transition-colors flex items-center gap-2"
              >
                <span>{section.name}</span>
                <span className="text-green-600 font-bold">+</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-orange-600 mt-2">
            Haz clic en cualquier elemento para mostrarlo nuevamente en la página
          </p>
        </div>
      )}

      {/* Hidden Tabs Panel - Pestañas */}
      {hiddenTabs.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
            📑 Pestañas Ocultas ({hiddenTabs.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {hiddenTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleToggle(tab.id, true, true)}
                className="px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-purple-100 hover:border-purple-400 transition-colors flex items-center gap-2"
              >
                <span>{tab.name}</span>
                <span className="text-green-600 font-bold">+</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-purple-600 mt-2">
            Haz clic en cualquier pestaña para mostrarla nuevamente
          </p>
        </div>
      )}

      {/* Real Product Page Layout Preview */}
      <div className="bg-gray-100 rounded-xl shadow-2xl overflow-hidden">
        {/* Browser Chrome */}
        <div className="bg-white border-b border-gray-300 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <div className="ml-4 flex-1 bg-gray-100 rounded px-3 py-1 text-xs text-gray-500 font-mono">
              tutienda.com/producto/los-tres-fome
            </div>
          </div>
        </div>

        {/* Product Page Content */}
        <div className="bg-white p-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* LEFT COLUMN - Fixed (Gallery) */}
              <div className="space-y-4">
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                  {/* Imagen Principal */}
                  <div className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center border-b border-gray-200">
                    <div className="text-center">
                      <div className="w-24 h-24 mx-auto mb-3 bg-white rounded-lg shadow-sm flex items-center justify-center">
                        <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-500 font-medium">Imagen Principal</p>
                    </div>
                  </div>
                  
                  {/* Miniaturas */}
                  <div className="grid grid-cols-4 gap-2 p-3 bg-gray-50">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="aspect-square bg-gradient-to-br from-purple-50 to-pink-50 rounded border border-purple-200 flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    ))}
                  </div>
                  
                  <div className="px-3 pb-3">
                    <div className="text-xs text-gray-500 text-center py-2 bg-white rounded border border-dashed border-gray-300">
                      🔒 Sección fija (no reordenable)
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN - Draggable */}
              <div className="space-y-4">
                <SortableContext
                  items={flattenedSections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {rightWithHandlers.map((item, index) => {
                    console.log(`🔧 Rendering item ${index}:`, item);
                    
                    if (!item) {
                      console.error(`❌ Item ${index} is null/undefined`);
                      return null;
                    }
                    
                    if (item.type === 'row') {
                      // Renderizar fila con 2 columnas
                      const leftSection = item.sections[0];
                      const rightSection = item.sections[1];
                      
                      if (!leftSection.enabled && !rightSection.enabled) return null;

                      return (
                        <div key={`row-${index}`} className="relative">
                          <div className="grid grid-cols-2 gap-4">
                            {leftSection.enabled && (
                              <div 
                                onClick={() => handleBlockSelection(leftSection.id)}
                                className={`${
                                  mergingMode 
                                    ? 'cursor-pointer hover:ring-4 hover:ring-purple-300' 
                                    : ''
                                } ${
                                  selectedForMerge.includes(leftSection.id)
                                    ? 'ring-4 ring-purple-500'
                                    : ''
                                }`}
                              >
                                <SortableProductSection section={leftSection} area="right" />
                              </div>
                            )}
                            {rightSection.enabled && (
                              <div 
                                onClick={() => handleBlockSelection(rightSection.id)}
                                className={`${
                                  mergingMode 
                                    ? 'cursor-pointer hover:ring-4 hover:ring-purple-300' 
                                    : ''
                                } ${
                                  selectedForMerge.includes(rightSection.id)
                                    ? 'ring-4 ring-purple-500'
                                    : ''
                                }`}
                              >
                                <SortableProductSection section={rightSection} area="right" />
                              </div>
                            )}
                          </div>
                          {/* Botón para separar */}
                          <button
                            onClick={() => unmergeBlock(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600 transition-colors shadow-lg z-10"
                            title="Separar bloques"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    } else {
                      // Renderizar bloque individual
                      const section = item.section;
                      if (!section.enabled) return null;

                      return (
                        <div 
                          key={section.id} 
                          onClick={() => handleBlockSelection(section.id)}
                          className={`${
                            mergingMode 
                              ? 'cursor-pointer hover:ring-4 hover:ring-purple-300 transition-all' 
                              : ''
                          } ${
                            selectedForMerge.includes(section.id)
                              ? 'ring-4 ring-purple-500'
                              : ''
                          }`}
                        >
                          <SortableProductSection section={section} area="right" />
                        </div>
                      );
                    }
                  })}
                </SortableContext>
              </div>
            </div>

            {/* BOTTOM SECTION - Tabs Draggable */}
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                  📑 Pestañas (Orden horizontal)
                </h4>
                <div className="flex flex-wrap gap-2">
                  <SortableContext
                    items={tabSections.map((s) => s.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {tabWithHandlers.filter((s) => s.enabled).map((section) => (
                      <SortableTabItem key={section.id} section={section} />
                    ))}
                  </SortableContext>
                </div>
              </div>
            </div>
          </DndContext>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          {flattenedSections.filter((s) => s.enabled).length} elementos en columna derecha · {tabSections.filter((s) => s.enabled).length} pestañas activas
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 font-semibold"
        >
          {loading ? "Guardando..." : "💾 Guardar Configuración"}
        </button>
      </div>

      {/* Info Bar Modal */}
      {showInfoBarModal && (
        <InfoBarConfigModal
          config={infoBarConfig}
          onConfigChange={setInfoBarConfig}
          onClose={() => setShowInfoBarModal(false)}
          onApply={handleSave}
        />
      )}

      {/* Grid Category Display Modal */}
      {showGridCategoryModal && (
        <GridCategoryDisplayModal
          config={productGridCategoryDisplay}
          onConfigChange={setProductGridCategoryDisplay}
          onClose={() => setShowGridCategoryModal(false)}
          onApply={handleSave}
        />
      )}
    </div>
  );
}

function PaginaProductoSection({ vendorId }: { vendorId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Página de Producto</CardTitle>
        <CardDescription>
          Personaliza el orden y visibilidad de elementos en la página de producto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GeneralTab vendorId={vendorId} />
      </CardContent>
    </Card>
  );
}

function CategoriasSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [globalCategories, setGlobalCategories] = useState<any[]>([]);
  const [vendorCategories, setVendorCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    description: "", 
    icon: "", 
    format: "",
    parentId: "",
    isActive: true,
    usesMusicMetadata: false,
    weight: "",
    height: "",
    width: "",
    depth: ""
  });
  const [iconMode, setIconMode] = useState<'emoji' | 'upload'>('emoji');
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // Emojis relacionados con música
  const musicEmojis = [
    '💿', '📀', '📼', '🎵', '🎶', '🎧', '🎤', '🎸', 
    '🎹', '🎺', '🎷', '🥁', '🎻', '🎼', '🎙️', '📻',
    '🔊', '🎚️', '🎛️', '📢', '🔉', '🔈', '👕', '🎫',
    '🎟️', '💽', '📱', '💻', '🎮', '📦', '🏷️', '⭐'
  ];

  useEffect(() => {
    loadCategories();
  }, [vendorId]);

  const loadCategories = async () => {
    try {
      // Cargar categorías globales del marketplace
      const allCats = await api.getAdminCategories();
      setGlobalCategories(allCats);
      
      // Cargar categorías activas del vendor
      const vendorCats = await api.getVendorCategories(vendorId);
      setVendorCategories(vendorCats);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setFormData({ 
      name: "", 
      description: "", 
      icon: "", 
      format: "",
      parentId: "",
      isActive: true,
      usesMusicMetadata: false,
      weight: "",
      height: "",
      width: "",
      depth: ""
    });
    setShowAddModal(true);
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || "",
      description: category.description || "",
      icon: category.icon || "",
      format: category.format || "",
      parentId: category.parentId || category.parent?.id || "",
      isActive: category.isActive !== false,
      usesMusicMetadata: category.usesMusicMetadata !== false,
      weight: category.weight?.toString() || "",
      height: category.height?.toString() || "",
      width: category.width?.toString() || "",
      depth: category.depth?.toString() || ""
    });
    setShowAddModal(true);
  };

  const handleSaveCategory = async () => {
    setLoading(true);
    try {
      if (editingCategory) {
        // Actualizar categoría existente
        await api.updateCategory(editingCategory.id, formData);
      } else {
        // Crear nueva categoría
        await api.createCategory(formData);
      }
      await loadCategories();
      setShowAddModal(false);
    } catch (error: any) {
      console.error("Error saving category:", error);
      alert(error.message || "Error al guardar la categoría");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta categoría?')) return;
    
    setLoading(true);
    try {
      await api.deleteCategory(categoryId);
      await loadCategories();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      alert(error.message || "Error al eliminar la categoría");
    } finally {
      setLoading(false);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }

    setUploadingIcon(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      // Subir a la carpeta de iconos del marketplace
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/media/upload-icon`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataUpload,
      });

      if (!response.ok) {
        throw new Error('Error al subir el icono');
      }

      const data = await response.json();
      setFormData({ ...formData, icon: data.url || data.path });
    } catch (error: any) {
      console.error('Error uploading icon:', error);
      alert(error.message || 'Error al subir el icono');
    } finally {
      setUploadingIcon(false);
    }
  };

  const isCategoryEnabled = (categoryId: string) => {
    return vendorCategories.some(cat => cat.id === categoryId);
  };

  const handleToggleCategory = async (categoryId: string, enable: boolean) => {
    setLoading(true);
    try {
      if (enable) {
        await api.enableVendorCategory(vendorId, categoryId);
      } else {
        await api.disableVendorCategory(vendorId, categoryId);
      }
      await loadCategories();
    } catch (error: any) {
      console.error("Error toggling category:", error);
      alert(error.message || "Error al actualizar la categoría");
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = globalCategories
    .filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aGroup = a.parent?.name || a.name;
      const bGroup = b.parent?.name || b.name;
      return aGroup.localeCompare(bGroup) || Number(Boolean(a.parent)) - Number(Boolean(b.parent)) || a.name.localeCompare(b.name);
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Categorías de Productos</CardTitle>
            <CardDescription>
              Gestiona las categorías globales del marketplace. Todos los vendedores usarán estas categorías.
            </CardDescription>
          </div>
          <Button onClick={handleAddCategory} className="bg-purple-600 hover:bg-purple-700">
            + Nueva Categoría
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Buscador */}
        <div className="mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar categorías..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Estadísticas */}
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-900">
                <strong>{globalCategories.length}</strong> categorías disponibles en el marketplace
              </p>
            </div>
          </div>
        </div>

        {/* Lista de categorías */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredCategories.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No se encontraron categorías</p>
          ) : (
            filteredCategories.map((category) => {
              const isEnabled = isCategoryEnabled(category.id);
              return (
                <div
                  key={category.id}
                  className={`flex items-center gap-4 p-3 rounded-lg border-2 transition-all ${
                    isEnabled 
                      ? 'bg-purple-50 border-purple-300' 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Icono */}
                  <div className="text-2xl w-10 h-10 flex items-center justify-center flex-shrink-0">
                    {category.icon?.startsWith('/') || 
                     category.icon?.startsWith('http') || 
                     category.icon?.includes('digitaloceanspaces.com') ? (
                      <img 
                        src={category.icon?.startsWith('http') 
                          ? category.icon 
                          : `${API_URL.replace('/api', '')}${category.icon}`
                        } 
                        alt="icon" 
                        className="w-8 h-8 object-contain" 
                      />
                    ) : (
                      <span>{category.icon || "📦"}</span>
                    )}
                  </div>

                  {/* Nombre y descripción */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium text-gray-900 ${category.parent ? 'pl-4' : ''}`}>
                        {category.parent ? `${category.parent.name} / ${category.name}` : category.name}
                      </h4>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        category.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {category.isActive ? 'Disponible para tiendas' : 'Desactivada'}
                      </span>
                      {category.productCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {category.productCount} {category.productCount === 1 ? 'producto' : 'productos'}
                        </span>
                      )}
                    </div>
                    {category.description && (
                      <p className="text-xs text-gray-500 truncate">{category.description}</p>
                    )}
                    {category.format && (
                      <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1">
                        {category.format}
                      </span>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditCategory(category)}
                      disabled={loading}
                    >
                      ✏️ Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={loading}
                      className="text-red-600 hover:bg-red-50"
                    >
                      🗑️ Eliminar
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Tip:</strong> Estas categorías serán usadas por todos los vendedores del marketplace. El icono aparecerá en la página del producto.
          </p>
        </div>

        {/* Modal para agregar/editar categoría */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Vinilos, CDs, Cassettes"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción de la categoría"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="parentId">Categoría principal</Label>
                  <select
                    id="parentId"
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white"
                  >
                    <option value="">Sin categoría padre</option>
                    {globalCategories
                      .filter((category) => !category.parentId && category.id !== editingCategory?.id)
                      .map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                  </select>
                </div>

                <label className="flex items-start gap-3 p-3 border rounded-md">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-medium">Disponible para las tiendas</span>
                    <span className="block text-xs text-gray-500">El administrador controla si esta categoría aparece para ser activada en las tiendas.</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-md">
                  <input
                    type="checkbox"
                    checked={formData.usesMusicMetadata}
                    onChange={(e) => setFormData({ ...formData, usesMusicMetadata: e.target.checked })}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-medium">Usa datos musicales</span>
                    <span className="block text-xs text-gray-500">Permite formato musical y asignación mediante Discogs/Spotify. Déjalo desactivado para ropa, equipos, videojuegos y accesorios.</span>
                  </span>
                </label>
                
                    <div>
                      <Label>Icono *</Label>
                      
                      {/* Mode selector tabs */}
                      <div className="flex gap-2 mb-3">
                        <Button
                          type="button"
                          variant={iconMode === 'emoji' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setIconMode('emoji')}
                          className={iconMode === 'emoji' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                        >
                          😊 Emoji
                        </Button>
                        <Button
                          type="button"
                          variant={iconMode === 'upload' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setIconMode('upload')}
                          className={iconMode === 'upload' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                        >
                          📁 Subir Archivo
                        </Button>
                      </div>

                      {/* Emoji mode: Grid of selectable emojis */}
                      {iconMode === 'emoji' && (
                        <div className="border rounded-lg p-3 bg-gray-50">
                          <p className="text-xs text-gray-600 mb-2">Selecciona un emoji:</p>
                          <div className="grid grid-cols-8 gap-2">
                            {musicEmojis.map((emoji, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => setFormData({ ...formData, icon: emoji })}
                                className={`text-2xl p-2 rounded hover:bg-purple-100 transition-all ${
                                  formData.icon === emoji ? 'bg-purple-200 ring-2 ring-purple-500 scale-110' : ''
                                }`}
                                title={emoji}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Upload mode: File input */}
                      {iconMode === 'upload' && (
                        <div className="border rounded-lg p-3 bg-gray-50">
                          <input
                            type="file"
                            accept="image/svg+xml,image/png,image/jpeg"
                            onChange={handleIconUpload}
                            className="w-full text-sm"
                            disabled={uploadingIcon}
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            Formatos aceptados: SVG, PNG, JPG (máx. 2MB)
                          </p>
                          {uploadingIcon && (
                            <div className="mt-2 text-sm text-purple-600 flex items-center gap-2">
                              <div className="animate-spin h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                              Subiendo icono...
                            </div>
                          )}
                        </div>
                      )}

                      {/* Preview */}
                      {formData.icon && (
                        <div className="mt-3 p-3 border rounded-lg bg-white">
                          <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                          <div className="flex items-center justify-center h-16">
                            {formData.icon.startsWith('/') || 
                             formData.icon.startsWith('http') || 
                             formData.icon.includes('digitaloceanspaces.com') ? (
                              <img 
                                src={formData.icon.startsWith('http') 
                                  ? formData.icon 
                                  : `${API_URL.replace('/api', '')}${formData.icon}`
                                } 
                                alt="icon" 
                                className="h-12 w-12 object-contain" 
                              />
                            ) : (
                              <span className="text-5xl">{formData.icon}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>                <div>
                  <Label htmlFor="format">Formato (opcional)</Label>
                  <Input
                    id="format"
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                    placeholder="Ej: vinyl, cd, cassette"
                  />
                </div>

                {/* Dimensiones para envío */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3 text-gray-700">📦 Dimensiones para Envío</h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Todos los productos de esta categoría usarán estas dimensiones para calcular el costo de envío
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="weight" className="text-xs">Peso (kg)</Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.01"
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        placeholder="0.5"
                        className="text-sm"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="height" className="text-xs">Alto (cm)</Label>
                      <Input
                        id="height"
                        type="number"
                        step="0.1"
                        value={formData.height}
                        onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        placeholder="10"
                        className="text-sm"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="width" className="text-xs">Ancho (cm)</Label>
                      <Input
                        id="width"
                        type="number"
                        step="0.1"
                        value={formData.width}
                        onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                        placeholder="20"
                        className="text-sm"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="depth" className="text-xs">Largo (cm)</Label>
                      <Input
                        id="depth"
                        type="number"
                        step="0.1"
                        value={formData.depth}
                        onChange={(e) => setFormData({ ...formData, depth: e.target.value })}
                        placeholder="30"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => setShowAddModal(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveCategory}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={loading || !formData.name}
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Componente de Redes Sociales
function RedesSocialesSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [socialLinks, setSocialLinks] = useState({
    facebook: "",
    instagram: "",
    twitter: "",
    whatsapp: "",
    youtube: "",
    tiktok: "",
    linkedin: "",
    spotify: "",
  });

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      if (data.headerConfig?.socialLinks) {
        setSocialLinks({ ...socialLinks, ...data.headerConfig.socialLinks });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const currentSettings = await api.getVendorSettings(vendorId);
      const updatedHeaderConfig = {
        ...(currentSettings.headerConfig || {}),
        socialLinks,
      };
      await api.updateVendorSettings(vendorId, { 
        headerConfig: updatedHeaderConfig 
      });
      alert("Redes sociales guardadas correctamente");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const socialNetworks = [
    { id: "facebook", name: "Facebook", icon: "", placeholder: "https://facebook.com/tutienda", color: "#1877F2" },
    { id: "instagram", name: "Instagram", icon: "", placeholder: "https://instagram.com/tutienda", color: "#E4405F" },
    { id: "twitter", name: "Twitter/X", icon: "", placeholder: "https://twitter.com/tutienda", color: "#1DA1F2" },
    { id: "youtube", name: "YouTube", icon: "", placeholder: "https://youtube.com/@tutienda", color: "#FF0000" },
    { id: "tiktok", name: "TikTok", icon: "", placeholder: "https://tiktok.com/@tutienda", color: "#000000" },
    { id: "whatsapp", name: "WhatsApp", icon: "", placeholder: "56912345678 (solo números)", color: "#25D366" },
    { id: "spotify", name: "Spotify", icon: "", placeholder: "https://open.spotify.com/user/...", color: "#1DB954" },
    { id: "linkedin", name: "LinkedIn", icon: "", placeholder: "https://linkedin.com/company/tutienda", color: "#0A66C2" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Redes Sociales</CardTitle>
        <CardDescription>
          Configura los enlaces a tus redes sociales. Solo se mostrarán los iconos de las redes que tengan URL configurada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {socialNetworks.map((network) => (
              <div key={network.id} className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-2xl">{network.icon}</span>
                  <span>{network.name}</span>
                </label>
                <input
                  type="text"
                  value={socialLinks[network.id as keyof typeof socialLinks]}
                  onChange={(e) => setSocialLinks({ ...socialLinks, [network.id]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  placeholder={network.placeholder}
                />
                {socialLinks[network.id as keyof typeof socialLinks] && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span>?</span>
                    <span>Se mostrará en el header</span>
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Guardando..." : "Guardar Redes Sociales"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Componente Sortable para Items de Menú
function SortableMenuItem({ 
  item, 
  index, 
  onEdit, 
  onDelete, 
  getDescription 
}: { 
  item: any; 
  index: number; 
  onEdit: () => void; 
  onDelete: () => void;
  getDescription: (item: any) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors ${
        isDragging ? 'shadow-lg z-50' : ''
      }`}
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="w-5 h-5" />
        </div>
        <span className="text-gray-400 font-mono text-sm">{index + 1}</span>
        <div>
          <div className="font-medium">{item.label}</div>
          <div className="text-sm text-gray-500">{getDescription(item)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          Editar
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

// Componente de Filtros
function FiltersSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    enabled: false,
    position: "left" as "left" | "right",
    showInCatalog: false,
    showInProductDetail: false,
    showInGenrePages: false,
    showInFormatPages: false,
    categories: {
      mode: "all" as "all" | "specific",
      selected: [] as string[],
    },
  });
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    loadFilters();
    loadCategories();
  }, [vendorId]);

  const loadFilters = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      console.log('🔄 [FiltersSection] Loading filters from API:', data.filters);
      if (data.filters) {
        setFilters({
          enabled: data.filters.enabled || false,
          position: data.filters.position || "left",
          showInCatalog: data.filters.showInCatalog || false,
          showInProductDetail: data.filters.showInProductDetail || false,
          showInGenrePages: data.filters.showInGenrePages || false,
          showInFormatPages: data.filters.showInFormatPages || false,
          categories: {
            mode: data.filters.categories?.mode || "all",
            selected: data.filters.categories?.selected || [],
          },
        });
        console.log('✅ [FiltersSection] Filters loaded and state updated');
      } else {
        console.log('⚠️ [FiltersSection] No filters data found in settings');
      }
    } catch (error) {
      console.error("Error loading filters:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      console.log('💾 [FiltersSection] Saving filters:', filters);
      await api.updateVendorSettings(vendorId, { filters });
      alert("✅ Configuración de filtros guardada exitosamente");
    } catch (error) {
      console.error("Error saving filters:", error);
      alert("❌ Error al guardar la configuración de filtros");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🎛️ Configuración de Filtros</CardTitle>
        <CardDescription>
          Configura dónde aparecerán los filtros de productos en tu tienda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Habilitar Filtros */}
        <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
          <div>
            <p className="font-semibold">Habilitar Menú Filtros</p>
            <p className="text-sm text-gray-600">Activa o desactiva el sidebar de filtros</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={filters.enabled}
              onChange={(e) => setFilters({ ...filters, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {filters.enabled && (
          <>
            {/* Posición */}
            <div>
              <h3 className="font-semibold mb-3">Posición de Filtros</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={filters.position === "left"}
                    onChange={() => setFilters({ ...filters, position: "left" })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span>⬅️ Izquierda</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={filters.position === "right"}
                    onChange={() => setFilters({ ...filters, position: "right" })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span>➡️ Derecha</span>
                </label>
              </div>
            </div>

            {/* Páginas específicas */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-3">¿Dónde se mostrarán los filtros?</h3>
              <div className="space-y-3">
                {/* Catálogo */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showInCatalog}
                    onChange={(e) => setFilters({ ...filters, showInCatalog: e.target.checked })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span>📋 Página de catálogo (/catalogo)</span>
                </label>

                {/* Ficha de productos */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showInProductDetail}
                    onChange={(e) => setFilters({ ...filters, showInProductDetail: e.target.checked })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span>🛍️ Ficha de productos</span>
                </label>

                {/* Páginas de Géneros */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showInGenrePages}
                    onChange={(e) => setFilters({ ...filters, showInGenrePages: e.target.checked })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span>🎵 Páginas de Géneros (todas las páginas /genero/*)</span>
                </label>

                {/* Páginas de Formatos */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showInFormatPages}
                    onChange={(e) => setFilters({ ...filters, showInFormatPages: e.target.checked })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <span>💿 Páginas de Formatos (todas las páginas /formato/*)</span>
                </label>
              </div>
            </div>

            {/* Categorías */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-3">📁 Categorías</h3>
              <div className="space-y-3">
                {/* Radio buttons */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={filters.categories.mode === "all"}
                      onChange={() => setFilters({
                        ...filters,
                        categories: { ...filters.categories, mode: "all" }
                      })}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span>Todas las categorías</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={filters.categories.mode === "specific"}
                      onChange={() => setFilters({
                        ...filters,
                        categories: { ...filters.categories, mode: "specific" }
                      })}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span>Seleccionar categorías</span>
                  </label>
                </div>

                {/* Lista de categorías */}
                {filters.categories.mode === "specific" && (
                  <div className="pl-6 space-y-2 mt-3 border-l-2 border-purple-200">
                    {categories.map((category) => (
                      <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.categories.selected.includes(category.id)}
                          onChange={(e) => {
                            const selected = e.target.checked
                              ? [...filters.categories.selected, category.id]
                              : filters.categories.selected.filter(id => id !== category.id);
                            setFilters({
                              ...filters,
                              categories: { ...filters.categories, selected }
                            });
                          }}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm">{category.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? "Guardando..." : "💾 Guardar Configuración de Filtros"}
        </Button>
      </CardFooter>
    </Card>
  );
}

// Componente de Menús
function MenusSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("principal");
  const [customMenusState, setCustomMenusState] = useState<any>({});
  const [menus, setMenus] = useState({
    principal: [] as any[],
    secundario: [] as any[],
    lateral: {
      enabled: false,
      position: "left",
      items: [] as any[],
      visibility: {
        mode: "all", // 'all' | 'specific'
        showInHome: true,
        customPages: {
          mode: "all", // 'all' | 'specific'
          selected: [] as string[],
        },
        categories: {
          mode: "all", // 'all' | 'specific'
          selected: [] as string[],
        },
        genres: {
          mode: "all", // 'all' | 'specific'
          selected: [] as string[],
        },
      },
    },
    filterSidebar: {
      enabled: false,
      position: "left",
      visibility: {
        mode: "all", // 'all' | 'specific'
        showInHome: true,
        showInCatalog: true,
        showInProductDetail: false,
        customPages: {
          mode: "all", // 'all' | 'specific'
          selected: [] as string[],
        },
        categories: {
          mode: "all", // 'all' | 'specific'
          selected: [] as string[],
        },
        genres: {
          mode: "all", // 'all' | 'specific'
          selected: [] as string[],
        },
      },
    },
    footer: [] as any[],
  });
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadMenus();
    loadCategories();
    loadGenres();
    loadPages();
  }, [vendorId]);

  const loadMenus = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      if (data.customMenus && typeof data.customMenus === "object") {
        setCustomMenusState(data.customMenus);
      }

      if (data.menus) {
        const customPrincipal = data.customMenus?.principal?.items || [];
        const customSecundario = data.customMenus?.secundario?.items || [];
        const customFooter = data.customMenus?.footer?.items || [];
        const customLateral = data.customMenus?.lateral?.items || [];

        // Asegurar que lateral y filterSidebar tengan la estructura completa con valores por defecto
        const loadedMenus = {
          ...data.menus,
          principal: customPrincipal.length > 0 ? customPrincipal : (data.menus.principal || []),
          secundario: customSecundario.length > 0 ? customSecundario : (data.menus.secundario || []),
          footer: customFooter.length > 0 ? customFooter : (data.menus.footer || []),
          lateral: {
            enabled: data.menus.lateral?.enabled || false,
            position: data.menus.lateral?.position || "left",
            items:
              (data.menus.lateral?.items && data.menus.lateral.items.length > 0)
                ? data.menus.lateral.items
                : customLateral,
            visibility: data.menus.lateral?.visibility || {
              mode: "all",
              showInHome: true,
              customPages: {
                mode: "all",
                selected: [],
              },
              categories: {
                mode: "all",
                selected: [],
              },
              genres: {
                mode: "all",
                selected: [],
              },
            },
          },
          filterSidebar: {
            enabled: data.menus.filterSidebar?.enabled || false,
            position: data.menus.filterSidebar?.position || "left",
            visibility: data.menus.filterSidebar?.visibility || {
              mode: "all",
              showInHome: true,
              showInCatalog: true,
              showInProductDetail: false,
              customPages: {
                mode: "all",
                selected: [],
              },
              categories: {
                mode: "all",
                selected: [],
              },
              genres: {
                mode: "all",
                selected: [],
              },
            },
          },
        };
        setMenus(loadedMenus);
      }
    } catch (error) {
      console.error("Error loading menus:", error);
    }
  };

  const buildSettingsPayload = (nextMenus: typeof menus) => ({
    menus: nextMenus,
    customMenus: {
      ...customMenusState,
      principal: { items: nextMenus.principal || [] },
      secundario: { items: nextMenus.secundario || [] },
      lateral: { items: nextMenus.lateral?.items || [] },
      footer: { items: nextMenus.footer || [] },
    },
  });

  const loadCategories = async () => {
    try {
      const data = await api.getAllCategories();
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadGenres = async () => {
    try {
      const data = await api.getGenres();
      setGenres(data || []);
    } catch (error) {
      console.error("Error loading genres:", error);
    }
  };

  const loadPages = async () => {
    try {
      const data = await api.getPages();
      setPages(data || []);
    } catch (error) {
      console.error("Error loading pages:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      console.log('💾 Guardando menús:', menus);
      console.log('💾 Filter sidebar config:', menus.filterSidebar);
      const payload = buildSettingsPayload(menus);
      await api.updateVendorSettings(vendorId, payload);
      setCustomMenusState(payload.customMenus);
      alert("Menús guardados correctamente");
    } catch (error: any) {
      console.error("Error saving menus:", error);
      alert(error.message || "Error al guardar los menús");
    } finally {
      setLoading(false);
    }
  };

  const addMenuItem = (menuType: string) => {
    setEditingItem({
      id: Date.now(),
      label: "",
      linkType: "custom",
      customUrl: "",
      openInNewTab: false,
      isNew: true,
    });
    setShowModal(true);
  };

  const generateMenuItemUrl = (item: any, vendorSlug: string) => {
    switch (item.linkType) {
      case "category":
        const category = categories.find(c => c.id === item.categoryId);
        return category ? `/tiendas/${vendorSlug}/categoria/${category.slug}` : "#";
      case "genre":
        const genre = genres.find(g => g.id === item.genreId);
        return genre ? `/tiendas/${vendorSlug}/genero/${genre.slug}` : "#";
      case "page":
        const page = pages.find(p => p.id === item.pageId);
        return page ? `/tiendas/${vendorSlug}/pagina/${page.slug}` : "#";
      case "custom":
        return item.customUrl || "#";
      default:
        return "#";
    }
  };

  const getMenuItemDescription = (item: any) => {
    if (!item.linkType) {
      // Backward compatibility - old menu items with just url
      return item.url || "#";
    }

    switch (item.linkType) {
      case "category":
        const category = categories.find(c => c.id === item.categoryId);
        return category ? `Categoría: ${category.name}` : "Categoría no encontrada";
      case "genre":
        const genre = genres.find(g => g.id === item.genreId);
        return genre ? `Género: ${genre.name}` : "Género no encontrado";
      case "page":
        const page = pages.find(p => p.id === item.pageId);
        return page ? `Página: ${page.title}` : "Página no encontrada";
      case "custom":
        return item.customUrl || "#";
      default:
        return "#";
    }
  };

  const saveMenuItem = async () => {
    if (!editingItem.label) {
      alert("El nombre del enlace es obligatorio");
      return;
    }

    // Validar según el tipo de enlace
    if (editingItem.linkType === "category" && !editingItem.categoryId) {
      alert("Debes seleccionar una categoría");
      return;
    }
    if (editingItem.linkType === "genre" && !editingItem.genreId) {
      alert("Debes seleccionar un género");
      return;
    }
    if (editingItem.linkType === "page" && !editingItem.pageId) {
      alert("Debes seleccionar una página");
      return;
    }
    if (editingItem.linkType === "custom" && !editingItem.customUrl) {
      alert("Debes ingresar una URL");
      return;
    }

    const itemToSave = { ...editingItem, isNew: undefined };
    let nextMenus = menus;

    if (activeTab === "lateral") {
      const updatedItems = editingItem.isNew
        ? [...menus.lateral.items, itemToSave]
        : menus.lateral.items.map((item) => (item.id === editingItem.id ? itemToSave : item));
      nextMenus = { ...menus, lateral: { ...menus.lateral, items: updatedItems } };
    } else {
      const updatedItems = editingItem.isNew
        ? [...(menus[activeTab as keyof typeof menus] as any[]), itemToSave]
        : (menus[activeTab as keyof typeof menus] as any[]).map((item: any) =>
            item.id === editingItem.id ? itemToSave : item
          );
      nextMenus = { ...menus, [activeTab]: updatedItems };
    }

    setMenus(nextMenus);

    try {
      setLoading(true);
      const payload = buildSettingsPayload(nextMenus);
      await api.updateVendorSettings(vendorId, payload);
      setCustomMenusState(payload.customMenus);
      setShowModal(false);
      setEditingItem(null);
    } catch (error: any) {
      console.error("Error saving menu item:", error);
      alert(error.message || "Error al guardar el enlace");
    } finally {
      setLoading(false);
    }
  };

  const deleteMenuItem = async (menuType: string, itemId: number) => {
    let nextMenus = menus;

    if (menuType === "lateral") {
      nextMenus = {
        ...menus,
        lateral: {
          ...menus.lateral,
          items: menus.lateral.items.filter((item) => item.id !== itemId),
        },
      };
    } else {
      nextMenus = {
        ...menus,
        [menuType]: (menus[menuType as keyof typeof menus] as any[]).filter((item: any) => item.id !== itemId),
      };
    }

    setMenus(nextMenus);

    try {
      setLoading(true);
      const payload = buildSettingsPayload(nextMenus);
      await api.updateVendorSettings(vendorId, payload);
      setCustomMenusState(payload.customMenus);
    } catch (error: any) {
      console.error("Error deleting menu item:", error);
      alert(error.message || "Error al eliminar el enlace");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "principal", name: "Menú Principal", icon: "", description: "Aparece en el header" },
    { id: "secundario", name: "Menú Secundario", icon: "?", description: "Aparece en la barra superior" },
    { id: "lateral", name: "Menú Lateral", icon: "", description: "Panel lateral izquierdo/derecho" },
    { id: "footer", name: "Menú Footer", icon: "", description: "Aparece en el pie de página" },
  ];

  const getCurrentMenuItems = () => {
    if (activeTab === "lateral") return menus.lateral.items;
    return menus[activeTab as keyof typeof menus] as any[];
  };

  const handleMenuDragEnd = (event: DragEndEvent, menuType: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const items = getCurrentMenuItems();
    const oldIndex = items.findIndex((item) => item.id.toString() === active.id);
    const newIndex = items.findIndex((item) => item.id.toString() === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedItems = arrayMove(items, oldIndex, newIndex);
      
      if (menuType === "lateral") {
        setMenus({
          ...menus,
          lateral: {
            ...menus.lateral,
            items: reorderedItems,
          },
        });
      } else {
        setMenus({
          ...menus,
          [menuType]: reorderedItems,
        });
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Menús</CardTitle>
        <CardDescription>Configura los menús de navegación de tu tienda</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 rounded-lg border-2 transition-all ${
                activeTab === tab.id
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 hover:border-purple-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{tab.icon}</span>
                <div className="text-left">
                  <div className="font-semibold text-sm">{tab.name}</div>
                  <div className="text-xs text-gray-500">{tab.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Configuración de Menú Lateral */}
        {activeTab === "lateral" && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
            {/* Habilitar/Deshabilitar */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="lateralEnabled"
                checked={menus.lateral.enabled}
                onChange={(e) => setMenus({ ...menus, lateral: { ...menus.lateral, enabled: e.target.checked } })}
                className="w-4 h-4 text-purple-600"
              />
              <label htmlFor="lateralEnabled" className="text-sm font-medium">
                Habilitar menú lateral
              </label>
            </div>

            {menus.lateral.enabled && (
              <>
                {/* Posición */}
                <div>
                  <label className="block text-sm font-medium mb-2">Posición</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="lateralPosition"
                        value="left"
                        checked={menus.lateral.position === "left"}
                        onChange={(e) =>
                          setMenus({ ...menus, lateral: { ...menus.lateral, position: e.target.value } })
                        }
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm">⬅️ Izquierda</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="lateralPosition"
                        value="right"
                        checked={menus.lateral.position === "right"}
                        onChange={(e) =>
                          setMenus({ ...menus, lateral: { ...menus.lateral, position: e.target.value } })
                        }
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm">➡️ Derecha</span>
                    </label>
                  </div>
                </div>

                {/* Visibilidad */}
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium mb-3">¿Dónde se mostrará el menú lateral?</label>
                  
                  <div className="space-y-3">
                    {/* Modo: Todo el sitio vs Páginas específicas */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibilityMode"
                          value="all"
                          checked={menus.lateral.visibility.mode === "all"}
                          onChange={(e) =>
                            setMenus({
                              ...menus,
                              lateral: {
                                ...menus.lateral,
                                visibility: { ...menus.lateral.visibility, mode: e.target.value as "all" | "specific" },
                              },
                            })
                          }
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm font-medium">🌐 Todo el sitio web</span>
                      </label>
                      <p className="text-xs text-gray-500 ml-6">
                        El menú lateral aparecerá en todas las páginas (excepto detalle de producto, carrito y checkout)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="visibilityMode"
                          value="specific"
                          checked={menus.lateral.visibility.mode === "specific"}
                          onChange={(e) =>
                            setMenus({
                              ...menus,
                              lateral: {
                                ...menus.lateral,
                                visibility: { ...menus.lateral.visibility, mode: e.target.value as "all" | "specific" },
                              },
                            })
                          }
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm font-medium">📍 Páginas específicas</span>
                      </label>
                      <p className="text-xs text-gray-500 ml-6">Elige exactamente dónde aparecerá el menú lateral</p>
                    </div>
                  </div>

                  {/* Opciones específicas */}
                  {menus.lateral.visibility.mode === "specific" && (
                    <div className="mt-4 pl-6 space-y-4 border-l-2 border-purple-200">
                      {/* Página de Inicio */}
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={menus.lateral.visibility.showInHome}
                            onChange={(e) =>
                              setMenus({
                                ...menus,
                                lateral: {
                                  ...menus.lateral,
                                  visibility: { ...menus.lateral.visibility, showInHome: e.target.checked },
                                },
                              })
                            }
                            className="w-4 h-4 text-purple-600"
                          />
                          <span className="text-sm">🏠 Página de inicio</span>
                        </label>
                      </div>

                      {/* Enlaces de Menús */}
                      <div>
                        <label className="block text-sm font-medium mb-3">🔗 Enlaces de Menús</label>
                        <p className="text-xs text-gray-500 mb-3">Selecciona en qué páginas específicas (según los enlaces configurados en tus menús) aparecerá el menú lateral</p>
                        
                        {/* Menú Principal */}
                        {menus.principal && menus.principal.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-700 mb-1">Menú Principal:</p>
                            <div className="space-y-1 pl-3">
                              {menus.principal.map((item: any) => (
                                <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={menus.lateral.visibility.customPages.selected.includes(`menu-principal-${item.id}`)}
                                    onChange={(e) => {
                                      const value = `menu-principal-${item.id}`;
                                      const selected = e.target.checked
                                        ? [...menus.lateral.visibility.customPages.selected, value]
                                        : menus.lateral.visibility.customPages.selected.filter((s: string) => s !== value);
                                      setMenus({
                                        ...menus,
                                        lateral: {
                                          ...menus.lateral,
                                          visibility: {
                                            ...menus.lateral.visibility,
                                            customPages: { ...menus.lateral.visibility.customPages, selected },
                                          },
                                        },
                                      });
                                    }}
                                    className="w-3 h-3 text-purple-600"
                                  />
                                  <span className="text-xs text-gray-700">{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Menú Secundario */}
                        {menus.secundario && menus.secundario.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-700 mb-1">Menú Secundario:</p>
                            <div className="space-y-1 pl-3">
                              {menus.secundario.map((item: any) => (
                                <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={menus.lateral.visibility.customPages.selected.includes(`menu-secundario-${item.id}`)}
                                    onChange={(e) => {
                                      const value = `menu-secundario-${item.id}`;
                                      const selected = e.target.checked
                                        ? [...menus.lateral.visibility.customPages.selected, value]
                                        : menus.lateral.visibility.customPages.selected.filter((s: string) => s !== value);
                                      setMenus({
                                        ...menus,
                                        lateral: {
                                          ...menus.lateral,
                                          visibility: {
                                            ...menus.lateral.visibility,
                                            customPages: { ...menus.lateral.visibility.customPages, selected },
                                          },
                                        },
                                      });
                                    }}
                                    className="w-3 h-3 text-purple-600"
                                  />
                                  <span className="text-xs text-gray-700">{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Menú Footer */}
                        {menus.footer && menus.footer.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-700 mb-1">Menú Footer:</p>
                            <div className="space-y-1 pl-3">
                              {menus.footer.map((item: any) => (
                                <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={menus.lateral.visibility.customPages.selected.includes(`menu-footer-${item.id}`)}
                                    onChange={(e) => {
                                      const value = `menu-footer-${item.id}`;
                                      const selected = e.target.checked
                                        ? [...menus.lateral.visibility.customPages.selected, value]
                                        : menus.lateral.visibility.customPages.selected.filter((s: string) => s !== value);
                                      setMenus({
                                        ...menus,
                                        lateral: {
                                          ...menus.lateral,
                                          visibility: {
                                            ...menus.lateral.visibility,
                                            customPages: { ...menus.lateral.visibility.customPages, selected },
                                          },
                                        },
                                      });
                                    }}
                                    className="w-3 h-3 text-purple-600"
                                  />
                                  <span className="text-xs text-gray-700">{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Categorías */}
                      <div>
                        <label className="block text-sm font-medium mb-2">📁 Categorías</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="categoriesMode"
                              value="all"
                              checked={menus.lateral.visibility.categories.mode === "all"}
                              onChange={(e) =>
                                setMenus({
                                  ...menus,
                                  lateral: {
                                    ...menus.lateral,
                                    visibility: {
                                      ...menus.lateral.visibility,
                                      categories: { mode: "all", selected: [] },
                                    },
                                  },
                                })
                              }
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm">Todas las categorías</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="categoriesMode"
                              value="specific"
                              checked={menus.lateral.visibility.categories.mode === "specific"}
                              onChange={(e) =>
                                setMenus({
                                  ...menus,
                                  lateral: {
                                    ...menus.lateral,
                                    visibility: {
                                      ...menus.lateral.visibility,
                                      categories: { mode: "specific", selected: [] },
                                    },
                                  },
                                })
                              }
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm">Seleccionar categorías</span>
                          </label>
                        </div>

                        {menus.lateral.visibility.categories.mode === "specific" && (
                          <div className="mt-2">
                            <select
                              multiple
                              value={menus.lateral.visibility.categories.selected}
                              onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                                setMenus({
                                  ...menus,
                                  lateral: {
                                    ...menus.lateral,
                                    visibility: {
                                      ...menus.lateral.visibility,
                                      categories: { ...menus.lateral.visibility.categories, selected },
                                    },
                                  },
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                              size={4}
                            >
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.slug}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Mantén Ctrl/Cmd para seleccionar múltiples</p>
                          </div>
                        )}
                      </div>

                      {/* Géneros */}
                      <div>
                        <label className="block text-sm font-medium mb-2">🎵 Géneros</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="genresMode"
                              value="all"
                              checked={menus.lateral.visibility.genres.mode === "all"}
                              onChange={(e) =>
                                setMenus({
                                  ...menus,
                                  lateral: {
                                    ...menus.lateral,
                                    visibility: {
                                      ...menus.lateral.visibility,
                                      genres: { mode: "all", selected: [] },
                                    },
                                  },
                                })
                              }
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm">Todos los géneros</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="genresMode"
                              value="specific"
                              checked={menus.lateral.visibility.genres.mode === "specific"}
                              onChange={(e) =>
                                setMenus({
                                  ...menus,
                                  lateral: {
                                    ...menus.lateral,
                                    visibility: {
                                      ...menus.lateral.visibility,
                                      genres: { mode: "specific", selected: [] },
                                    },
                                  },
                                })
                              }
                              className="w-4 h-4 text-purple-600"
                            />
                            <span className="text-sm">Seleccionar géneros</span>
                          </label>
                        </div>

                        {menus.lateral.visibility.genres.mode === "specific" && (
                          <div className="mt-2">
                            <select
                              multiple
                              value={menus.lateral.visibility.genres.selected}
                              onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                                setMenus({
                                  ...menus,
                                  lateral: {
                                    ...menus.lateral,
                                    visibility: {
                                      ...menus.lateral.visibility,
                                      genres: { ...menus.lateral.visibility.genres, selected },
                                    },
                                  },
                                });
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                              size={4}
                            >
                              {genres.map((genre) => (
                                <option key={genre.id} value={genre.slug}>
                                  {genre.name}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Mantén Ctrl/Cmd para seleccionar múltiples</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}



        {/* Lista de Items del Menú */}
        {activeTab !== "filtros" && (
          <div className="space-y-3 mb-6">
          {getCurrentMenuItems().length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500 mb-4">No hay enlaces en este menú</p>
              <button
                onClick={() => {
                  setEditingItem({ 
                    id: Date.now(), 
                    label: "", 
                    linkType: "custom",
                    customUrl: "",
                    openInNewTab: false, 
                    isNew: true 
                  });
                  setShowModal(true);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                + Agregar primer enlace
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => handleMenuDragEnd(event, activeTab)}
            >
              <SortableContext
                items={getCurrentMenuItems().map((item) => item.id.toString())}
                strategy={verticalListSortingStrategy}
              >
                {getCurrentMenuItems().map((item, index) => (
                  <SortableMenuItem
                    key={item.id}
                    item={item}
                    index={index}
                    onEdit={() => {
                      setEditingItem({ ...item, isNew: false });
                      setShowModal(true);
                    }}
                    onDelete={() => deleteMenuItem(activeTab, item.id)}
                    getDescription={getMenuItemDescription}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
        )}

        {/* Botones de acción */}
        <div className="flex items-center gap-3 pt-4 border-t">
          {activeTab !== "filtros" && getCurrentMenuItems().length > 0 && (
            <button
              onClick={() => {
                setEditingItem({ 
                  id: Date.now(), 
                  label: "", 
                  linkType: "custom",
                  customUrl: "",
                  openInNewTab: false, 
                  isNew: true 
                });
                setShowModal(true);
              }}
              className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
            >
              + Agregar enlace
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Guardando..." : "Guardar Menús"}
          </button>
        </div>

        {/* Modal para agregar/editar item */}
        {showModal && typeof window !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ 
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(2px)'
            }}
            onClick={() => {
              console.log('🔴 OVERLAY CLICKED');
              setShowModal(false);
              setEditingItem(null);
            }}
            onMouseEnter={() => console.log('🟢 MOUSE ENTER OVERLAY')}
            onMouseLeave={() => console.log('🔵 MOUSE LEAVE OVERLAY')}
          >
            <div 
              className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => {
                console.log('⚪ MODAL CONTENT CLICKED');
                e.stopPropagation();
              }}
              onMouseEnter={() => console.log('🟡 MOUSE ENTER CONTENT')}
              onMouseLeave={() => console.log('🟠 MOUSE LEAVE CONTENT')}
            >
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold">
                  {editingItem?.isNew ? "Agregar enlace" : "Editar enlace"}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre del enlace *</label>
                  <input
                    type="text"
                    value={editingItem?.label || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Inicio"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tipo de enlace *</label>
                  <select
                    value={editingItem?.linkType || "custom"}
                    onChange={(e) => setEditingItem({ 
                      ...editingItem, 
                      linkType: e.target.value,
                      categoryId: undefined,
                      genreId: undefined,
                      pageId: undefined,
                      customUrl: ""
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="category">Enlace a Categoría</option>
                    <option value="genre">Enlace a Género</option>
                    <option value="page">Enlace a Página</option>
                    <option value="custom">Enlace Personalizado</option>
                  </select>
                </div>

                {editingItem?.linkType === "category" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Categoría *</label>
                      <select
                        value={editingItem?.categoryId || ""}
                        onChange={(e) => {
                          const selectedCat = categories.find(c => c.id === e.target.value);
                          setEditingItem({ 
                            ...editingItem, 
                            categoryId: e.target.value,
                            categorySlug: selectedCat?.slug || e.target.value,
                            categoryIcon: selectedCat?.icon || null,
                            showIcon: selectedCat?.icon ? true : (editingItem?.showIcon ?? false)
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Selecciona una categoría</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {editingItem?.categoryIcon && (
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="showCategoryIcon"
                          checked={editingItem?.showIcon !== false}
                          onChange={(e) => setEditingItem({ ...editingItem, showIcon: e.target.checked })}
                          className="w-4 h-4 text-purple-600"
                        />
                        <label htmlFor="showCategoryIcon" className="text-sm flex items-center gap-2">
                          Mostrar ícono de la categoría
                          {editingItem.categoryIcon && (
                            <span className="text-xl ml-2">
                              {editingItem.categoryIcon.startsWith('/') || editingItem.categoryIcon.startsWith('http') ? (
                                <span className="text-xs text-gray-500">(imagen)</span>
                              ) : (
                                editingItem.categoryIcon
                              )}
                            </span>
                          )}
                        </label>
                      </div>
                    )}
                  </>
                )}

                {editingItem?.linkType === "genre" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Género *</label>
                    <select
                      value={editingItem?.genreId || ""}
                      onChange={(e) => {
                        const selectedGenre = genres.find(g => g.id === e.target.value);
                        setEditingItem({ 
                          ...editingItem, 
                          genreId: e.target.value,
                          genreSlug: selectedGenre?.slug || e.target.value
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Selecciona un género</option>
                      {genres.map((genre) => (
                        <option key={genre.id} value={genre.id}>
                          {genre.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editingItem?.linkType === "page" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Página *</label>
                    <select
                      value={editingItem?.pageId || ""}
                      onChange={(e) => {
                        const selectedPage = pages.find(p => p.id === e.target.value);
                        setEditingItem({ 
                          ...editingItem, 
                          pageId: e.target.value,
                          pageSlug: selectedPage?.slug || e.target.value,
                          isHomepage: selectedPage?.isHomepage || false
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Selecciona una página</option>
                      {pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editingItem?.linkType === "custom" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">URL *</label>
                    <input
                      type="text"
                      value={editingItem?.customUrl || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, customUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="https://ejemplo.com"
                    />
                  </div>
                )}

                {/* Campo de ícono para enlaces no-categoría */}
                {editingItem?.linkType !== "category" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Ícono (opcional)
                      </label>
                      
                      {/* Galería de íconos predefinidos */}
                      <div className="grid grid-cols-8 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50 mb-3">
                        {[
                          '🏠', '🎵', '🎸', '🎹', '🎤', '🎧', '💿', '📀',
                          '🎼', '🎺', '🎷', '🥁', '🎻', '🪕', '🎶', '🔊',
                          '📱', '💻', '📧', '📞', '🌐', '🔗', '📄', '📝',
                          '⭐', '❤️', '🔥', '✨', '🎁', '🛒', '📦', '🚚',
                          '👤', '👥', '💬', '📢', '🔔', '⚙️', '🔍', '❓',
                          '📍', '🌍', '🏪', '🏬', '🛍️', '💳', '💰', '🎯'
                        ].map((icon, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setEditingItem({ 
                              ...editingItem, 
                              customIcon: icon,
                              showIcon: true 
                            })}
                            className={`text-2xl p-2 rounded-lg hover:bg-purple-100 transition-colors ${
                              editingItem?.customIcon === icon ? 'bg-purple-200 ring-2 ring-purple-500' : 'bg-white'
                            }`}
                            title={icon}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                      
                      {/* Campo de texto para ícono personalizado o URL */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          O ingresa uno personalizado:
                        </label>
                        <input
                          type="text"
                          value={editingItem?.customIcon || ""}
                          onChange={(e) => setEditingItem({ ...editingItem, customIcon: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                          placeholder="Emoji personalizado o URL de imagen"
                        />
                      </div>
                    </div>
                    
                    {editingItem?.customIcon && (
                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <input
                          type="checkbox"
                          id="showCustomIcon"
                          checked={editingItem?.showIcon !== false}
                          onChange={(e) => setEditingItem({ ...editingItem, showIcon: e.target.checked })}
                          className="w-4 h-4 text-purple-600"
                        />
                        <label htmlFor="showCustomIcon" className="text-sm flex items-center gap-2">
                          <span className="font-medium">Mostrar ícono:</span>
                          <span className="text-2xl">
                            {editingItem.customIcon.startsWith('/') || editingItem.customIcon.startsWith('http') ? (
                              <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">(imagen URL)</span>
                            ) : (
                              editingItem.customIcon
                            )}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="openInNewTab"
                    checked={editingItem?.openInNewTab || false}
                    onChange={(e) => setEditingItem({ ...editingItem, openInNewTab: e.target.checked })}
                    className="w-4 h-4 text-purple-600"
                  />
                  <label htmlFor="openInNewTab" className="text-sm">
                    Abrir en nueva pestaña
                  </label>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveMenuItem}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {editingItem?.isNew ? "Agregar" : "Actualizar"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </CardContent>
    </Card>
  );
}


function DescripcionCortaSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState("");
  const [charCount, setCharCount] = useState(0);
  const textareaRef = { current: null as HTMLTextAreaElement | null };

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const settings = await api.getVendorSettings(vendorId, false);
      if (settings?.shortDescriptionTemplate) {
        setTemplate(settings.shortDescriptionTemplate);
        setCharCount(settings.shortDescriptionTemplate.length);
      } else {
        // Template por defecto
        const defaultTemplate = `[artist] - [title]\n[format] • [year] • [label]`;
        setTemplate(defaultTemplate);
        setCharCount(defaultTemplate.length);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.updateVendorSettings(vendorId, {
        shortDescriptionTemplate: template,
      });
      alert("✅ Template guardado exitosamente");
    } catch (error: any) {
      console.error("Error saving template:", error);
      alert(`❌ Error al guardar: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (value: string) => {
    setTemplate(value);
    setCharCount(value.length);
  };

  const insertShortcode = (shortcode: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = template.substring(0, start) + shortcode + template.substring(end);
    
    setTemplate(newValue);
    setCharCount(newValue.length);
    
    // Restaurar el foco y posición del cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + shortcode.length, start + shortcode.length);
    }, 0);
  };

  const shortcodes = [
    { 
      code: "[title]", 
      label: "Título del Álbum", 
      example: "Abbey Road",
      category: "básico"
    },
    { 
      code: "[artist]", 
      label: "Artista Principal", 
      example: "The Beatles",
      category: "básico"
    },
    { 
      code: "[year]", 
      label: "Año de Lanzamiento", 
      example: "1969",
      category: "básico"
    },
    { 
      code: "[format]", 
      label: "Formato Físico", 
      example: "Vinyl, LP, Album",
      category: "básico"
    },
    { 
      code: "[label]", 
      label: "Sello Discográfico", 
      example: "Apple Records",
      category: "básico"
    },
    { 
      code: "[country]", 
      label: "País de Origen", 
      example: "UK",
      category: "adicional"
    },
    { 
      code: "[genre]", 
      label: "Género Musical", 
      example: "Rock, Pop",
      category: "adicional"
    },
    { 
      code: "[style]", 
      label: "Estilo Específico", 
      example: "Pop Rock, Psychedelic Rock",
      category: "adicional"
    },
    { 
      code: "[catalog]", 
      label: "Número de Catálogo", 
      example: "PCS 7088",
      category: "adicional"
    },
    { 
      code: "[barcode]", 
      label: "Código de Barras", 
      example: "5099969943874",
      category: "adicional"
    },
    { 
      code: "[notes]", 
      label: "Notas del Release", 
      example: "Reissue, Remastered",
      category: "adicional"
    },
    { 
      code: "[released]", 
      label: "Fecha de Lanzamiento", 
      example: "26 Sep 1969",
      category: "adicional"
    },
    { 
      code: "[credits]", 
      label: "Créditos y Roles", 
      example: "Produced By George Martin",
      category: "adicional"
    },
  ];

  const basicShortcodes = shortcodes.filter(sc => sc.category === "básico");
  const additionalShortcodes = shortcodes.filter(sc => sc.category === "adicional");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Descripción Corta</CardTitle>
        <CardDescription>
          Configura el template con shortcodes para generar automáticamente la descripción corta al importar desde Discogs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Información */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
              i
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">¿Cómo funciona?</h3>
              <p className="text-sm text-blue-700">
                Al importar un producto desde Discogs, los shortcodes se reemplazarán automáticamente con los datos reales del release.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel Izquierdo - Editor */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  📝 Template de Descripción Corta
                </label>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {charCount} caracteres
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={template}
                onChange={(e) => handleTemplateChange(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent font-mono text-sm resize-none shadow-sm"
                placeholder="Haz clic en los shortcodes de abajo para insertarlos aquí..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleTemplateChange("")}
                  className="text-xs px-3 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                >
                  🗑️ Limpiar
                </button>
                <button
                  onClick={() => handleTemplateChange(`[artist] - [title]\n[format] • [year] • [label]`)}
                  className="text-xs px-3 py-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
                >
                  ↻ Restaurar por defecto
                </button>
              </div>
            </div>

            {/* Vista Previa */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">👁️ Vista Previa</h3>
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-200 rounded-lg p-4 min-h-[100px]">
                <p className="text-sm text-gray-700 whitespace-pre-line font-medium">
                  {template || <span className="text-gray-400 italic">El template está vacío</span>}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">
                Los shortcodes se reemplazarán con datos reales al importar
              </p>
            </div>
          </div>

          {/* Panel Derecho - Shortcodes */}
          <div className="space-y-4">
            {/* Shortcodes Básicos */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">BÁSICOS</span>
                Información Principal
              </h3>
              <div className="space-y-2">
                {basicShortcodes.map((sc) => (
                  <button
                    key={sc.code}
                    onClick={() => insertShortcode(sc.code)}
                    className="w-full text-left bg-white border-2 border-gray-200 hover:border-purple-400 hover:shadow-md rounded-lg p-3 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-purple-700 transition-colors">
                        {sc.label}
                      </span>
                      <code className="text-xs font-mono bg-purple-50 text-purple-600 px-2 py-0.5 rounded border border-purple-200">
                        {sc.code}
                      </code>
                    </div>
                    <p className="text-xs text-gray-500">
                      Ejemplo: <span className="text-gray-700 font-medium">{sc.example}</span>
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Shortcodes Adicionales */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">ADICIONALES</span>
                Información Extra
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {additionalShortcodes.map((sc) => (
                  <button
                    key={sc.code}
                    onClick={() => insertShortcode(sc.code)}
                    className="w-full text-left bg-white border-2 border-gray-200 hover:border-blue-400 hover:shadow-md rounded-lg p-3 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                        {sc.label}
                      </span>
                      <code className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200">
                        {sc.code}
                      </code>
                    </div>
                    <p className="text-xs text-gray-500">
                      Ejemplo: <span className="text-gray-700 font-medium">{sc.example}</span>
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="flex justify-end pt-6 border-t-2 border-gray-200">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Guardando...
              </>
            ) : (
              <>
                💾 Guardar Configuración
              </>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function DatosTecnicosSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState("");
  const [charCount, setCharCount] = useState(0);
  const textareaRef = { current: null as HTMLTextAreaElement | null };

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const settings = await api.getVendorSettings(vendorId, false);
      if (settings?.technicalSpecsTemplate) {
        setTemplate(settings.technicalSpecsTemplate);
        setCharCount(settings.technicalSpecsTemplate.length);
      } else {
        // Template por defecto
        const defaultTemplate = `País: [country]\nAño: [year]\nSello: [label]\nFormato: [format]\nCatálogo: [catalog]`;
        setTemplate(defaultTemplate);
        setCharCount(defaultTemplate.length);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.updateVendorSettings(vendorId, {
        technicalSpecsTemplate: template,
      });
      alert("✅ Template guardado exitosamente");
    } catch (error: any) {
      console.error("Error saving template:", error);
      alert(`❌ Error al guardar: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (value: string) => {
    setTemplate(value);
    setCharCount(value.length);
  };

  const insertShortcode = (shortcode: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = template.substring(0, start) + shortcode + template.substring(end);
    
    setTemplate(newValue);
    setCharCount(newValue.length);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + shortcode.length, start + shortcode.length);
    }, 0);
  };

  const shortcodes = [
    { code: "[title]", label: "Título del Álbum", example: "Abbey Road", category: "básico" },
    { code: "[artist]", label: "Artista Principal", example: "The Beatles", category: "básico" },
    { code: "[year]", label: "Año de Lanzamiento", example: "1969", category: "básico" },
    { code: "[format]", label: "Formato Físico", example: "Vinyl, LP, Album", category: "básico" },
    { code: "[label]", label: "Sello Discográfico", example: "Apple Records", category: "básico" },
    { code: "[country]", label: "País de Origen", example: "UK", category: "adicional" },
    { code: "[genre]", label: "Género Musical", example: "Rock, Pop", category: "adicional" },
    { code: "[style]", label: "Estilo Específico", example: "Pop Rock, Psychedelic Rock", category: "adicional" },
    { code: "[catalog]", label: "Número de Catálogo", example: "PCS 7088", category: "adicional" },
    { code: "[barcode]", label: "Código de Barras", example: "5099969943874", category: "adicional" },
    { code: "[notes]", label: "Notas del Release", example: "Reissue, Remastered", category: "adicional" },
    { code: "[released]", label: "Fecha de Lanzamiento", example: "26 Sep 1969", category: "adicional" },
    { code: "[credits]", label: "Créditos y Roles", example: "Produced By George Martin", category: "adicional" },
  ];

  const basicShortcodes = shortcodes.filter(sc => sc.category === "básico");
  const additionalShortcodes = shortcodes.filter(sc => sc.category === "adicional");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos Técnicos</CardTitle>
        <CardDescription>
          Configura el template con shortcodes para generar automáticamente los datos técnicos al importar desde Discogs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">i</div>
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">¿Cómo funciona?</h3>
              <p className="text-sm text-blue-700">
                Al importar un producto desde Discogs, los shortcodes se reemplazarán automáticamente con los datos técnicos del release.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">📝 Template de Datos Técnicos</label>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{charCount} caracteres</span>
              </div>
              <textarea
                ref={textareaRef}
                value={template}
                onChange={(e) => handleTemplateChange(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent font-mono text-sm resize-none shadow-sm"
                placeholder="Haz clic en los shortcodes de abajo para insertarlos aquí..."
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleSave} disabled={loading} className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "Guardando..." : "💾 Guardar Template"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">🏷️ Shortcodes Básicos</h3>
              <div className="grid grid-cols-1 gap-2">
                {basicShortcodes.map((sc) => (
                  <button key={sc.code} onClick={() => insertShortcode(sc.code)} className="group flex items-center gap-3 p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-purple-400 hover:shadow-md transition-all text-left">
                    <div className="flex-1">
                      <div className="font-mono text-sm font-bold text-purple-600">{sc.code}</div>
                      <div className="text-xs text-gray-600">{sc.label}</div>
                    </div>
                    <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Insertar →</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">➕ Shortcodes Adicionales</h3>
              <div className="grid grid-cols-1 gap-2">
                {additionalShortcodes.map((sc) => (
                  <button key={sc.code} onClick={() => insertShortcode(sc.code)} className="group flex items-center gap-3 p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-indigo-400 hover:shadow-md transition-all text-left">
                    <div className="flex-1">
                      <div className="font-mono text-sm font-bold text-indigo-600">{sc.code}</div>
                      <div className="text-xs text-gray-600">{sc.label}</div>
                    </div>
                    <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Insertar →</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VistaGeneralProductosSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [imageRolloverEnabled, setImageRolloverEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const settings = await api.getVendorSettings(vendorId);
      if (settings) {
        setImageRolloverEnabled(settings.imageRolloverEnabled || false);
      }
    } catch (error) {
      console.error('Error loading image settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.updateVendorSettings(vendorId, {
        imageRolloverEnabled,
      });
      alert('✅ Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('❌ Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vista General de Productos</CardTitle>
        <CardDescription>
          Configura cómo se muestran los productos en todas las páginas del marketplace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Image Rollover Effect */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Image Hover Effect (Rollover)</Label>
              <p className="text-sm text-gray-500">
                Al pasar el mouse sobre la imagen del producto, se mostrará la segunda imagen si está disponible.
                Este efecto se aplica en: portada, categorías, géneros, formatos, condiciones y todas las vistas de productos.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={imageRolloverEnabled}
                onChange={(e) => setImageRolloverEnabled(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {imageRolloverEnabled && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-blue-600 mt-0.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Cómo funciona</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Asegúrate de que tus productos tengan al menos 2 imágenes</li>
                    <li>• La primera imagen se muestra por defecto</li>
                    <li>• Al pasar el mouse, se mostrará la segunda imagen con una transición suave</li>
                    <li>• Si un producto tiene solo 1 imagen, el efecto no se aplicará</li>
                    <li>• Este efecto funciona en todas las páginas: portada, categorías, géneros, formatos, condiciones, etc.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleSave}
          disabled={loading}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
        >
          {loading ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ColoresSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("default");
  const [customColors, setCustomColors] = useState<Partial<ColorTheme> | null>(null);
  const [isCustomized, setIsCustomized] = useState(false);

  // Usar temas importados de colorThemes.ts
  const colorThemes = Object.values(importedColorThemes);

  console.log('🎨 Color Themes loaded:', colorThemes.length, colorThemes);

  useEffect(() => {
    loadColorTheme();
  }, [vendorId]);

  const loadColorTheme = async () => {
    try {
      const settings = await api.getVendorSettings(vendorId);
      if (settings?.colorTheme) {
        setSelectedTheme(settings.colorTheme);
      }
      if (settings?.customColors) {
        setCustomColors(settings.customColors);
        setIsCustomized(true);
      }
    } catch (error) {
      console.error("Error loading color theme:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload: any = {
        colorTheme: selectedTheme,
      };
      if (isCustomized && customColors) {
        payload.customColors = customColors;
      } else {
        payload.customColors = null;
      }
      await api.updateVendorSettings(vendorId, payload);
      alert("✅ Tema de colores guardado exitosamente");
    } catch (error) {
      console.error("Error saving color theme:", error);
      alert("❌ Error al guardar el tema de colores");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Temas de Colores</CardTitle>
        <CardDescription>
          Selecciona un tema de colores para tu tienda. Los colores se aplicarán a botones, encabezados y elementos destacados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview del tema seleccionado */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border-2 border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Vista Previa del Tema Actual</h3>
          <div className="space-y-3">
            <div 
              className="h-32 rounded-lg shadow-lg flex items-center justify-center"
              style={{ 
                background: colorThemes.find(t => t.id === selectedTheme)?.preview 
              }}
            >
              <span className="text-white text-xl font-bold">
                {colorThemes.find(t => t.id === selectedTheme)?.name}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div 
                  className="h-16 rounded-lg shadow mb-2"
                  style={{ backgroundColor: colorThemes.find(t => t.id === selectedTheme)?.primary }}
                ></div>
                <span className="text-xs text-gray-600">Principal</span>
              </div>
              <div className="text-center">
                <div 
                  className="h-16 rounded-lg shadow mb-2"
                  style={{ backgroundColor: colorThemes.find(t => t.id === selectedTheme)?.secondary }}
                ></div>
                <span className="text-xs text-gray-600">Secundario</span>
              </div>
              <div className="text-center">
                <div 
                  className="h-16 rounded-lg shadow mb-2"
                  style={{ backgroundColor: colorThemes.find(t => t.id === selectedTheme)?.accent }}
                ></div>
                <span className="text-xs text-gray-600">Acento</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selector de temas */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Temas Disponibles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {colorThemes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelectedTheme(theme.id)}
                className={`relative group text-left p-4 rounded-lg border-2 transition-all ${
                  selectedTheme === theme.id
                    ? 'border-purple-600 bg-purple-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md'
                }`}
              >
                {/* Preview gradient */}
                <div 
                  className="h-24 rounded-lg mb-3 flex items-center justify-center"
                  style={{ background: theme.preview }}
                >
                  {selectedTheme === theme.id && (
                    <div className="bg-white rounded-full p-2">
                      <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Nombre y descripción */}
                <h4 className="font-semibold text-gray-900 mb-1">{theme.name}</h4>
                <p className="text-xs text-gray-600">{theme.description}</p>
                
                {/* Color swatches */}
                <div className="flex gap-2 mt-3">
                  <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: theme.primary }}></div>
                  <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: theme.secondary }}></div>
                  <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: theme.accent }}></div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Personalización de Colores */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Personalizar Colores {isCustomized && <span className="text-purple-600">(Personalizado)</span>}</h3>
            {isCustomized && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomColors(null);
                  setIsCustomized(false);
                }}
                className="text-sm"
              >
                Resetear Colores
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-600 mb-4">
            Personaliza los colores del tema seleccionado. Los cambios se aplicarán inmediatamente.
          </p>
          
          {(() => {
            const currentTheme = getTheme(selectedTheme);
            const activeColors = customColors || currentTheme;
            
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Color Principal */}
                <div>
                  <Label htmlFor="color-primary" className="text-xs text-gray-700 mb-2 block">
                    Color Principal
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="color-primary"
                      value={activeColors.primary}
                      onChange={(e) => {
                        const newColors = { ...currentTheme, ...customColors, primary: e.target.value };
                        setCustomColors(newColors);
                        setIsCustomized(true);
                      }}
                      className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={activeColors.primary}
                      onChange={(e) => {
                        const newColors = { ...currentTheme, ...customColors, primary: e.target.value };
                        setCustomColors(newColors);
                        setIsCustomized(true);
                      }}
                      className="flex-1 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Color Secundario */}
                <div>
                  <Label htmlFor="color-secondary" className="text-xs text-gray-700 mb-2 block">
                    Color Secundario
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="color-secondary"
                      value={activeColors.secondary}
                      onChange={(e) => {
                        const newColors = { ...currentTheme, ...customColors, secondary: e.target.value };
                        setCustomColors(newColors);
                        setIsCustomized(true);
                      }}
                      className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={activeColors.secondary}
                      onChange={(e) => {
                        const newColors = { ...currentTheme, ...customColors, secondary: e.target.value };
                        setCustomColors(newColors);
                        setIsCustomized(true);
                      }}
                      className="flex-1 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Color Acento */}
                <div>
                  <Label htmlFor="color-accent" className="text-xs text-gray-700 mb-2 block">
                    Color Acento
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="color-accent"
                      value={activeColors.accent}
                      onChange={(e) => {
                        const newColors = { ...currentTheme, ...customColors, accent: e.target.value };
                        setCustomColors(newColors);
                        setIsCustomized(true);
                      }}
                      className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={activeColors.accent}
                      onChange={(e) => {
                        const newColors = { ...currentTheme, ...customColors, accent: e.target.value };
                        setCustomColors(newColors);
                        setIsCustomized(true);
                      }}
                      className="flex-1 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Fondo del Sitio */}
                <div>
                  <Label htmlFor="color-bg-site" className="text-xs text-gray-700 mb-2 block">
                    Fondo del Sitio
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="color-bg-site"
                      value={activeColors.bgSite}
                      onChange={(e) => {
                        const newColors = { ...currentTheme, ...customColors, bgSite: e.target.value };
                        setCustomColors(newColors);
                        setIsCustomized(true);
                      }}
                      className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={activeColors.bgSite}
                      onChange={(e) => {
                        const newColors = { ...currentTheme, ...customColors, bgSite: e.target.value };
                        setCustomColors(newColors);
                        setIsCustomized(true);
                      }}
                      className="flex-1 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Fondo de Página */}
                <div>
                  <Label htmlFor="color-bg-page" className="text-xs text-gray-700 mb-2 block">
                    Fondo de Página
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="color-bg-page"
                      value={activeColors.bgPage}
                      onChange={(e) => {
                        const newColors = { ...currentTheme, ...customColors, bgPage: e.target.value };
                        setCustomColors(newColors);
                        setIsCustomized(true);
                      }}
                      className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={activeColors.bgPage}
                      onChange={(e) => {
                        const newColors = { ...currentTheme, ...customColors, bgPage: e.target.value };
                        setCustomColors(newColors);
                        setIsCustomized(true);
                      }}
                      className="flex-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Botón Guardar */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {loading ? "Guardando..." : "Guardar Tema"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente del Modal de Configuración de Barra de Información
function InfoBarConfigModal({
  config,
  onConfigChange,
  onClose,
  onApply,
}: {
  config: { enabled: boolean; leftFields: string[]; rightFields: string[]; showIcons: boolean };
  onConfigChange: (config: any) => void;
  onClose: () => void;
  onApply?: () => Promise<void>;
}) {
  const fieldOptions = [
    { value: 'format', label: 'Formato (Vinilo, CD, Cassette, etc)' },
    { value: 'label', label: 'Sello Discográfico' },
    { value: 'year', label: 'Año' },
    { value: 'country', label: 'País' },
    { value: 'artist', label: 'Artista' },
    { value: 'album', label: 'Título del Disco' },
    { value: 'goldmine', label: 'Escala Goldmine (Media/Sleeve)' },
  ];

  const toggleLeftField = (field: string) => {
    const newLeftFields = config.leftFields.includes(field)
      ? config.leftFields.filter((f) => f !== field)
      : [...config.leftFields, field];
    onConfigChange({ ...config, leftFields: newLeftFields });
  };

  const toggleRightField = (field: string) => {
    const newRightFields = config.rightFields.includes(field)
      ? config.rightFields.filter((f) => f !== field)
      : [...config.rightFields, field];
    onConfigChange({ ...config, rightFields: newRightFields });
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>⚙️ Configurar Barra de Información del Producto</CardTitle>
          <CardDescription>
            Selecciona qué campos mostrar en la barra superior. Los campos de la izquierda se alinean a la izquierda, los de la derecha a la derecha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle para habilitar/deshabilitar la barra */}
          <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <span className="font-medium text-gray-700">Mostrar barra de información</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.enabled}
                onChange={(e) => onConfigChange({ ...config, enabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Toggle para mostrar iconos */}
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div>
              <span className="font-medium text-gray-700">Mostrar iconos en los campos</span>
              <p className="text-xs text-gray-500 mt-1">Muestra iconos junto a cada campo (💿 Vinilo, 📅 Año, etc)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.showIcons ?? true}
                onChange={(e) => onConfigChange({ ...config, showIcons: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Campos de la izquierda */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              ⬅️ Campos Alineados a la Izquierda
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              {fieldOptions
                .filter((opt) => opt.value !== 'goldmine')
                .map((field) => (
                  <label key={field.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.leftFields.includes(field.value)}
                      onChange={() => toggleLeftField(field.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{field.label}</span>
                  </label>
                ))}
            </div>
          </div>

          {/* Campos de la derecha */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              ➡️ Campos Alineados a la Derecha
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              {fieldOptions
                .filter((opt) => opt.value === 'goldmine')
                .map((field) => (
                  <label key={field.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.rightFields.includes(field.value)}
                      onChange={() => toggleRightField(field.value)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">{field.label}</span>
                  </label>
                ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">👁️ Vista Previa</h4>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-4 text-sm text-gray-700 flex-wrap">
                <div className="flex gap-3 flex-wrap">
                  {config.leftFields.map((field) => {
                    const label = fieldOptions.find((f) => f.value === field)?.label;
                    return (
                      <span key={field} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {label}
                      </span>
                    );
                  })}
                </div>
                <div className="flex gap-3 flex-wrap">
                  {config.rightFields.map((field) => {
                    const label = fieldOptions.find((f) => f.value === field)?.label;
                    return (
                      <span key={field} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="px-6">
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (onApply) {
                  await onApply();
                }
                onClose();
              }}
              className="px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              ✓ Aplicar Cambios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
}

// ========================================
// GRID CATEGORY DISPLAY MODAL
// ========================================

function GridCategoryDisplayModal({
  config,
  onConfigChange,
  onClose,
  onApply,
}: {
  config: { mode: 'none' | 'icon' | 'name'; position: string };
  onConfigChange: (config: any) => void;
  onClose: () => void;
  onApply?: () => Promise<void>;
}) {
  const modeOptions = [
    { value: 'none', label: 'No mostrar nada', icon: '❌' },
    { value: 'icon', label: 'Solo ícono', icon: '🏷️' },
    { value: 'name', label: 'Solo nombre', icon: '📝' },
  ];

  const positionOptions = [
    { value: 'top-left', label: 'Arriba Izquierda', icon: '↖️' },
    { value: 'top-right', label: 'Arriba Derecha', icon: '↗️' },
    { value: 'bottom-left', label: 'Abajo Izquierda', icon: '↙️' },
    { value: 'bottom-right', label: 'Abajo Derecha', icon: '↘️' },
  ];

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>🏷️ Configurar Categoría en Grid de Productos</CardTitle>
          <CardDescription>
            Elige cómo mostrar la categoría en cada producto del grid (portada y categorías)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Modo de visualización */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">📺 Modo de Visualización</h4>
            <div className="space-y-2">
              {modeOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="mode"
                    value={option.value}
                    checked={config.mode === option.value}
                    onChange={(e) => onConfigChange({ ...config, mode: e.target.value })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-lg">{option.icon}</span>
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Posición */}
          {config.mode !== 'none' && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">📍 Posición en la Imagen</h4>
              <div className="grid grid-cols-2 gap-2">
                {positionOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="position"
                      value={option.value}
                      checked={config.position === option.value}
                      onChange={(e) => onConfigChange({ ...config, position: e.target.value })}
                      className="w-4 h-4 text-green-600"
                    />
                    <span className="text-lg">{option.icon}</span>
                    <span className="text-xs text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {config.mode !== 'none' && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">👁️ Vista Previa</h4>
              <div className="relative w-full h-48 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg border-2 border-dashed border-purple-300 flex items-center justify-center overflow-hidden">
                <div className="text-center text-gray-600">
                  <div className="text-4xl mb-2">🎵</div>
                  <span className="text-sm">Producto de Ejemplo</span>
                </div>
                {/* Badge de categoría */}
                <div className={`absolute p-2 rounded-lg bg-white/90 shadow-md text-xs font-semibold
                  ${config.position === 'top-left' ? 'top-2 left-2' : ''}
                  ${config.position === 'top-right' ? 'top-2 right-2' : ''}
                  ${config.position === 'bottom-left' ? 'bottom-2 left-2' : ''}
                  ${config.position === 'bottom-right' ? 'bottom-2 right-2' : ''}
                `}>
                  {config.mode === 'icon' && '🏷️'}
                  {config.mode === 'name' && 'Vinilo'}
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="px-6">
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (onApply) {
                  await onApply();
                }
                onClose();
              }}
              className="px-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              ✓ Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
}

// ========================================
// SHIPPING METHODS SECTION
// ========================================

function ShippingMethodsSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shippingMethods, setShippingMethods] = useState<any[]>([]);
  const [vendorMethods, setVendorMethods] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [communes, setCommunes] = useState<any[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [showCommuneConfig, setShowCommuneConfig] = useState(false);
  const [showShippingConfig, setShowShippingConfig] = useState(false);
  const [credentials, setCredentials] = useState<{
    apiKey: string;
    accountName: string;
    serviceType: string;
    originCommune: string;
    userToken: string;
    rut: string;
    originAgency: string;
    checkingAccount: string;
  }>({
    apiKey: '',
    accountName: '',
    serviceType: 'NORMAL',
    originCommune: 'Santiago',
    userToken: '',
    rut: '',
    originAgency: '',
    checkingAccount: '',
  });

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [methodsRes, vendorMethodsRes, regionsRes, communesRes] = await Promise.all([
        api.getShippingMethods(),
        api.getVendorShippingMethods(vendorId),
        api.getRegions(),
        api.getAllCommunes(),
      ]);

      setShippingMethods(methodsRes);
      setVendorMethods(vendorMethodsRes);
      setRegions(regionsRes);
      setCommunes(communesRes);
    } catch (error) {
      console.error('Error loading shipping data:', error);
      alert('Error al cargar datos de envío');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableMethod = async (methodId: number) => {
    const method = shippingMethods.find(m => m.id === methodId);
    if (!method) return;

    try {
      setSaving(true);
      let config: any = {};
      
      if (method.code === 'bluex') {
        config = {
          apiKey: credentials.apiKey,
          baseUrl: method.config?.api_base_url || 'https://apiqa.bluex.cl/bx-core',
          accountName: credentials.accountName,
          sandboxMode: true,
          serviceType: credentials.serviceType,
          familiaProducto: 'PAQU',
          originCommune: credentials.originCommune,
          originRegion: 'Región Metropolitana',
        };
      }
      
      await api.enableShippingMethod(vendorId, methodId, config);
      
      // Obtener el vendor shipping method recién creado
      const updatedVendorMethods = await api.getVendorShippingMethods(vendorId);
      const newVendorMethod = updatedVendorMethods.find((vm: any) => vm.shippingMethodId === methodId);
      
      if (newVendorMethod) {
        // Configurar todas las comunas como disponibles con precio 0 (usar API)
        const allCommunesConfig = communes.map(commune => ({
          communeId: commune.id,
          isAvailable: true,
          baseCost: 0,
          estimatedDays: 3,
        }));
        
        await api.bulkSetCommuneConfig(newVendorMethod.id, allCommunesConfig);
      }
      
      await loadData();
      alert(`${method.name} activado correctamente. Todas las comunas están disponibles usando cotización en tiempo real.`);
      setShowShippingConfig(false);
      setCredentials({
        apiKey: '',
        accountName: '',
        serviceType: 'NORMAL',
        originCommune: 'Santiago',
        userToken: '',
        rut: '',
        originAgency: '',
        checkingAccount: '',
      });
    } catch (error) {
      console.error('Error enabling method:', error);
      alert('Error al activar método de envío');
    } finally {
      setSaving(false);
    }
  };

  const handleDisableMethod = async (methodId: number) => {
    try {
      setSaving(true);
      await api.disableShippingMethod(vendorId, methodId);
      await loadData();
      alert('Método desactivado correctamente');
    } catch (error) {
      console.error('Error disabling method:', error);
      alert('Error al desactivar método de envío');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigureCommunesClick = (vendorMethod: any) => {
    setSelectedMethod(vendorMethod);
    setShowCommuneConfig(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Métodos de Envío</CardTitle>
          <CardDescription>Cargando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Métodos de Envío Disponibles
          </CardTitle>
          <CardDescription>
            Activa y configura los métodos de envío para tu tienda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {shippingMethods.map((method) => {
            const vendorMethod = vendorMethods.find(
              (vm) => vm.shippingMethodId === method.id
            );
            const isEnabled = vendorMethod?.isEnabled || false;

            return (
              <div
                key={method.id}
                className={`p-4 border rounded-lg ${
                  isEnabled ? 'border-green-300 bg-green-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{method.name}</h3>
                      {isEnabled && (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{method.description}</p>

                    {isEnabled && vendorMethod && (
                      <div className="mt-4 space-y-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfigureCommunesClick(vendorMethod)}
                        >
                          Configurar Comunas y Precios
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMethod(vendorMethod);
                            setCredentials({
                              apiKey: vendorMethod.config?.apiKey || '',
                              accountName: vendorMethod.config?.accountName || '',
                              serviceType: vendorMethod.config?.serviceType || 'NORMAL',
                              originCommune: vendorMethod.config?.originCommune || 'Santiago',
                              userToken: vendorMethod.config?.userToken || '',
                              rut: vendorMethod.config?.rut || '',
                              originAgency: vendorMethod.config?.originAgency || '',
                              checkingAccount: vendorMethod.config?.checkingAccount || '',
                            });
                            setShowShippingConfig(true);
                          }}
                        >
                          Configurar Credenciales
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isEnabled ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDisableMethod(method.id)}
                        disabled={saving}
                      >
                        Desactivar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedMethod(method);
                          setShowShippingConfig(true);
                        }}
                        disabled={saving}
                      >
                        Activar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {showCommuneConfig && selectedMethod && (
        <CommuneConfigModal
          vendorMethod={selectedMethod}
          regions={regions}
          communes={communes}
          onClose={() => {
            setShowCommuneConfig(false);
            setSelectedMethod(null);
          }}
          onSave={async () => {
            await loadData();
          }}
        />
      )}

      {showShippingConfig && selectedMethod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <ShippingConfig
            vendorId={vendorId}
            methodCode={(selectedMethod.code || selectedMethod.shippingMethod?.code) as 'bluex'}
            methodName={selectedMethod.name || selectedMethod.shippingMethod?.name || 'Método de Envío'}
            currentConfig={selectedMethod.config || {}}
            onSave={async () => {
              await loadData();
              setShowShippingConfig(false);
              setSelectedMethod(null);
            }}
            onCancel={() => {
              setShowShippingConfig(false);
              setSelectedMethod(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ========================================
// COMMUNE CONFIG MODAL
// ========================================

function CommuneConfigModal({
  vendorMethod,
  regions,
  communes,
  onClose,
  onSave,
}: {
  vendorMethod: any;
  regions: any[];
  communes: any[];
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [communeConfigs, setCommuneConfigs] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCommuneConfigs();
  }, [vendorMethod.id]);

  const loadCommuneConfigs = async () => {
    try {
      setLoading(true);
      const configs = await api.getCommuneConfig(vendorMethod.id);
      setCommuneConfigs(configs);
    } catch (error) {
      console.error('Error loading commune configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCommune = (communeId: number, currentValue: boolean) => {
    const existingConfig = communeConfigs.find((c) => c.communeId === communeId);

    if (existingConfig) {
      setCommuneConfigs(
        communeConfigs.map((c) =>
          c.communeId === communeId ? { ...c, isAvailable: !currentValue } : c
        )
      );
    } else {
      setCommuneConfigs([
        ...communeConfigs,
        {
          communeId,
          isAvailable: true,
          baseCost: 0,
          estimatedDays: 3,
        },
      ]);
    }
  };

  const handlePriceChange = (communeId: number, price: number) => {
    setCommuneConfigs(
      communeConfigs.map((c) =>
        c.communeId === communeId ? { ...c, baseCost: price } : c
      )
    );
  };

  const handleDaysChange = (communeId: number, days: number) => {
    setCommuneConfigs(
      communeConfigs.map((c) =>
        c.communeId === communeId ? { ...c, estimatedDays: days } : c
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const configsToSave = communeConfigs.filter((c) => c.isAvailable);
      await api.bulkSetCommuneConfig(vendorMethod.id, configsToSave);
      await onSave();
      alert('Configuración guardada correctamente');
      onClose();
    } catch (error) {
      console.error('Error saving commune configs:', error);
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const filteredCommunes = communes.filter((commune) => {
    const matchesRegion = !selectedRegion || commune.regionId === selectedRegion;
    const matchesSearch =
      !searchTerm ||
      commune.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      commune.region?.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRegion && matchesSearch;
  });

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <CardTitle>Configurar Comunas - {vendorMethod.shippingMethod?.name}</CardTitle>
          <CardDescription>
            Selecciona las comunas disponibles y configura precios de envío
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-6">
          {/* Filtros */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Filtrar por Región</label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={selectedRegion || ''}
                  onChange={(e) =>
                    setSelectedRegion(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Todas las regiones</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Buscar Comuna</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg"
                  placeholder="Buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Lista de Comunas */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Cargando comunas...</div>
          ) : (
            <div className="space-y-3">
              {filteredCommunes.map((commune) => {
                const config = communeConfigs.find((c) => c.communeId === commune.id);
                const isAvailable = config?.isAvailable || false;

                return (
                  <div
                    key={commune.id}
                    className={`p-4 border rounded-lg ${
                      isAvailable ? 'border-green-300 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={isAvailable}
                        onChange={() => handleToggleCommune(commune.id, isAvailable)}
                        className="w-5 h-5"
                      />

                      <div className="flex-1">
                        <div className="font-medium">{commune.name}</div>
                        <div className="text-sm text-gray-500">{commune.region?.name}</div>
                      </div>

                      {isAvailable && (
                        <div className="flex gap-4 items-center">
                          <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            Precio vía API
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 block mb-1">
                              Días estimados
                            </label>
                            <input
                              type="number"
                              className="w-20 p-2 border rounded text-sm"
                              value={config?.estimatedDays || 3}
                              onChange={(e) =>
                                handleDaysChange(commune.id, Number(e.target.value))
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        <div className="border-t p-4 flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </Card>
    </div>,
    document.body
  );
}

// ========================================
// PAYMENT METHODS SECTION
// ========================================

function PaymentMethodsSection({ vendorId }: { vendorId: string }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            MÃ©todos de Pago del Marketplace
          </CardTitle>
          <CardDescription>
            Los mÃ©todos de pago configurados aquÃ­ se aplicarÃ¡n automÃ¡ticamente a todas las tiendas del marketplace.
            Los vendedores podrÃ¡n ver estos mÃ©todos pero no podrÃ¡n desactivarlos ni modificar su configuraciÃ³n.
          </CardDescription>
        </CardHeader>
      </Card>

      <FlowPaymentConfig />
      <PaykuPaymentConfig />
    </div>
  );
}
