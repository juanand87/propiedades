"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, API_URL } from "@/lib/api";
import { getImageUrl } from "@/lib/imageUtils";
import { Store, Palette, Truck, CreditCard, Plug, TrendingUp, Package, GripVertical, Mail, Globe, Loader2, ShoppingCart, ExternalLink, Save, ShieldCheck } from "lucide-react";
import GridConfigUI from "@/components/admin/GridConfigUI";
import BannerConfigUI from "@/components/admin/BannerConfigUI";
import PromotionsOverview from "@/components/admin/PromotionsOverview";
import StoreDesignConfig from "@/components/admin/StoreDesignConfig";
import VendorPaykuConfig from "@/components/vendor/VendorPaykuConfig";
import CustomDomainSection from "@/components/dashboard/CustomDomainSection";
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
import PosSettingsSection from "@/components/pos/PosSettingsSection";
import ReturnsPolicyContent from "@/components/policies/ReturnsPolicyContent";
import { DEFAULT_RETURNS_POLICY, getReturnsPolicySettings } from "@/lib/returnsPolicy";

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vendorId, setVendorId] = useState<string>("");
  const [hasVendor, setHasVendor] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("general");
  const [activeSubsection, setActiveSubsection] = useState("configuracion-general");
  const initialSliderId = (() => {
    const sliderIdParam = searchParams.get('sliderId');
    const parsed = sliderIdParam ? Number(sliderIdParam) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  })();

  useEffect(() => {
    loadVendorProfile();
    
    // Leer parámetros de URL para navegar a sección específica
    const section = searchParams.get('section');
    const subsection = searchParams.get('subsection');
    
    if (section) {
      setActiveSection(section);
      if (subsection) {
        setActiveSubsection(subsection);
      }
    }
  }, [searchParams]);

  const loadVendorProfile = async () => {
    try {
      const response = await api.getMyVendor();
      
      if (response.hasVendor && response.id) {
        setVendorId(response.id);
        setHasVendor(true);
      } else {
        setHasVendor(false);
      }
    } catch (error: any) {
      console.error("Error loading vendor profile:", error);
      
      // Si es un error 401, redirigir al login
      if (error.message?.includes('401')) {
        api.removeToken();
        router.push('/login');
        return;
      }
      
      setHasVendor(false);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const sections = [
    {
      id: "general",
      name: "General",
      icon: Store,
      subsections: [
        { id: "configuracion-general", name: "Configuración General" },
        { id: "marketplace", name: "Publicar en Marketplace" },
        { id: "mayorista", name: "Modo Mayorista" },
        { id: "dominio-personalizado", name: "Dominio Personalizado" },
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
        { id: "grids", name: "Grids" },
        { id: "logo", name: "Logo" },
        { id: "header", name: "Header" },
        { id: "redes-sociales", name: "Redes Sociales" },
        { id: "menus", name: "Menús" },
        { id: "footer", name: "Footer" },
        { id: "pagina-producto", name: "Página de Producto" },
        { id: "promociones", name: "Bloques de contenido" },
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
        { id: "categorias", name: "Categorías" },
        { id: "descripcion-corta", name: "Descripción Corta" },
        { id: "datos-tecnicos", name: "Datos Técnicos" },
        { id: "imagenes", name: "Imágenes" },
      ],
    },
    {
      id: "envio",
      name: "Envíos",
      icon: Truck,
    },
    {
      id: "pago",
      name: "Métodos de Pago",
      icon: CreditCard,
    },
    {
      id: "pos",
      name: "Punto de venta",
      icon: ShoppingCart,
      subsections: [
        { id: "cajas", name: "Cajas" },
        { id: "usuarios", name: "Usuarios" },
        { id: "configuracion-pos", name: "Configuración" },
      ],
    },
    {
      id: "email",
      name: "E-mail - SMTP",
      icon: Mail,
    },
    {
      id: "integraciones",
      name: "Integraciones",
      icon: Plug,
      subsections: [
        { id: "woocommerce", name: "WooCommerce" },
        { id: "mercadolibre", name: "Mercado Libre" },
        { id: "falabella", name: "Falabella Seller Center" },
        { id: "paris", name: "Marketplace Paris" },
        { id: "discogs", name: "Discogs API" },
        { id: "spotify", name: "Spotify" },
        { id: "gemini", name: "Gemini AI - Descripciones" },
        { id: "redes-sociales", name: "Redes Sociales" },
        { id: "analytics", name: "Google Analytics" },
        { id: "google-merchant", name: "Google Merchant Center" },
        { id: "facebook-pixel", name: "Facebook Pixel" },
      ],
    },
    {
      id: "seo-marketing",
      name: "SEO y Marketing",
      icon: TrendingUp,
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
      if (activeSubsection === "dominio-personalizado") {
        return <CustomDomainSection />;
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
      if (activeSubsection === "logo") {
        return <LogoSection vendorId={vendorId} />;
      }
      if (activeSubsection === "header") {
        return <HeaderSection vendorId={vendorId} />;
      }
      if (activeSubsection === "redes-sociales") {
        return <RedesSocialesSection vendorId={vendorId} />;
      }
      if (activeSubsection === "menus") {
        return <MenusManagement vendorId={vendorId} />;
      }
      if (activeSubsection === "footer") {
        return <FooterSection vendorId={vendorId} />;
      }
      if (activeSubsection === "pagina-producto") {
        return <PaginaProductoSection vendorId={vendorId} />;
      }
      if (["promociones", "slides", "banners"].includes(activeSubsection)) {
        return <PromotionsSection vendorId={vendorId} initialMode={activeSubsection === "slides" ? "carousels" : activeSubsection === "banners" ? "banners" : "overview"} initialSliderId={initialSliderId} />;
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
      if (activeSubsection === "categorias") {
        return <CategoriasSection vendorId={vendorId} />;
      }
      if (activeSubsection === "descripcion-corta") {
        return <DescripcionCortaSection vendorId={vendorId} />;
      }
      if (activeSubsection === "datos-tecnicos") {
        return <DatosTecnicosSection vendorId={vendorId} />;
      }
      if (activeSubsection === "imagenes") {
        return <ImagenesSection vendorId={vendorId} />;
      }
      return <PlaceholderSection title={activeSubsection} />;
    }

    // Integraciones Section
    if (activeSection === "integraciones") {
      if (activeSubsection === "mercadolibre") {
        return <MercadoLibreSection />;
      }
      if (activeSubsection === "falabella") {
        return <FalabellaSection />;
      }
      if (activeSubsection === "paris") {
        return <ParisSection />;
      }
      if (activeSubsection === "woocommerce") {
        return <WooCommerceSection vendorId={vendorId} />;
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
      if (activeSubsection === "redes-sociales") {
        return <RedesSocialesSection vendorId={vendorId} />;
      }
      if (activeSubsection === "analytics") {
        return <AnalyticsSection vendorId={vendorId} />;
      }
      if (activeSubsection === "google-merchant") {
        return <GoogleMerchantSection vendorId={vendorId} />;
      }
      if (activeSubsection === "facebook-pixel") {
        return <FacebookPixelSection vendorId={vendorId} />;
      }
      return <PlaceholderSection title={activeSubsection} />;
    }

    if (activeSection === "seo-marketing") {
      return <SeoMarketingSection vendorId={vendorId} />;
    }

    // Métodos de Envío Section
    if (activeSection === "envio") {
      return <ShippingMethodsSection vendorId={vendorId} />;
    }

    // Métodos de Pago Section
    if (activeSection === "pago") {
      return <VendorPaykuConfig vendorId={vendorId} />;
    }

    if (activeSection === "pos") {
      return <PosSettingsSection initialTab={activeSubsection} />;
    }

    // Email SMTP Section
    if (activeSection === "email") {
      return <EmailSmtpSection vendorId={vendorId} />;
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

// Email SMTP Configuration Section
function EmailSmtpSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    smtpFromEmail: '',
    smtpFromName: '',
  });
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    loadSmtpConfig();
  }, [vendorId]);

  const loadSmtpConfig = async () => {
    try {
      setLoading(true);
      const settings = await api.getVendorSettings(vendorId);
      
      if (settings) {
        setConfig({
          smtpHost: settings.smtpHost || '',
          smtpPort: settings.smtpPort || 587,
          smtpSecure: settings.smtpSecure || false,
          smtpUser: settings.smtpUser || '',
          smtpPassword: settings.smtpPassword || '',
          smtpFromEmail: settings.smtpFromEmail || '',
          smtpFromName: settings.smtpFromName || '',
        });
      }
    } catch (error) {
      console.error('Error loading SMTP config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateVendorSettings(vendorId, config);
      alert('✅ Configuración SMTP guardada exitosamente');
    } catch (error) {
      console.error('Error saving SMTP config:', error);
      alert('❌ Error al guardar la configuración SMTP');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
      alert('Por favor completa al menos Host, Usuario y Contraseña');
      return;
    }

    try {
      setTesting(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/vendors/test-smtp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpSecure,
          user: config.smtpUser,
          password: config.smtpPassword,
          fromEmail: config.smtpFromEmail,
          fromName: config.smtpFromName,
          testEmail: testEmail || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ ' + data.message);
      } else {
        alert('❌ ' + data.message);
      }
    } catch (error: any) {
      console.error('Error testing SMTP:', error);
      alert('❌ Error al probar conexión: ' + (error.message || 'Error desconocido'));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando configuración...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración SMTP</CardTitle>
          <CardDescription>
            Configura el servidor SMTP para enviar correos electrónicos automáticos de pedidos, notificaciones, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* SMTP Host */}
          <div>
            <Label htmlFor="smtpHost">Host SMTP *</Label>
            <Input
              id="smtpHost"
              placeholder="smtp.gmail.com"
              value={config.smtpHost}
              onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Ejemplo: smtp.gmail.com, smtp.office365.com, smtp.sendgrid.net
            </p>
          </div>

          {/* SMTP Port & Secure */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="smtpPort">Puerto *</Label>
              <Input
                id="smtpPort"
                type="number"
                placeholder="587"
                value={config.smtpPort}
                onChange={(e) => setConfig({ ...config, smtpPort: Number(e.target.value) })}
              />
              <p className="text-xs text-gray-500 mt-1">
                587 (TLS) o 465 (SSL)
              </p>
            </div>
            <div>
              <Label htmlFor="smtpSecure">Conexión Segura (SSL)</Label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="smtpSecure"
                  checked={config.smtpSecure}
                  onChange={(e) => setConfig({ ...config, smtpSecure: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Usar SSL/TLS directo (puerto 465)</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ⚠️ Desactiva esto para puerto 587 (usa STARTTLS automáticamente)
              </p>
            </div>
          </div>

          {/* SMTP User */}
          <div>
            <Label htmlFor="smtpUser">Usuario SMTP *</Label>
            <Input
              id="smtpUser"
              type="email"
              placeholder="tu-email@gmail.com"
              value={config.smtpUser}
              onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
            />
          </div>

          {/* SMTP Password */}
          <div>
            <Label htmlFor="smtpPassword">Contraseña SMTP *</Label>
            <Input
              id="smtpPassword"
              type="password"
              placeholder="••••••••"
              value={config.smtpPassword}
              onChange={(e) => setConfig({ ...config, smtpPassword: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Para Gmail, usa una <a href="https://myaccount.google.com/apppasswords" target="_blank" className="text-blue-600 underline">Contraseña de Aplicación</a>
            </p>
          </div>

          {/* From Email */}
          <div>
            <Label htmlFor="smtpFromEmail">Email Remitente</Label>
            <Input
              id="smtpFromEmail"
              type="email"
              placeholder="tienda@ejemplo.com"
              value={config.smtpFromEmail}
              onChange={(e) => setConfig({ ...config, smtpFromEmail: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Email que aparecerá como remitente (puede ser igual al usuario SMTP)
            </p>
          </div>

          {/* From Name */}
          <div>
            <Label htmlFor="smtpFromName">Nombre Remitente</Label>
            <Input
              id="smtpFromName"
              placeholder="Mi Tienda"
              value={config.smtpFromName}
              onChange={(e) => setConfig({ ...config, smtpFromName: e.target.value })}
            />
          </div>

          {/* Test Section */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-base font-semibold mb-2 block">Probar Conexión</Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="testEmail">Email de Prueba (opcional)</Label>
                <Input
                  id="testEmail"
                  type="email"
                  placeholder="test@ejemplo.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Si proporcionas un email, se enviará un correo de prueba
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full"
              >
                {testing ? 'Probando...' : '🔌 Probar Conexión SMTP'}
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || !config.smtpHost || !config.smtpUser || !config.smtpPassword}
          >
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración de Tienda</h1>
        <p className="text-gray-600 mt-2">Administra todos los aspectos de tu tienda</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-3">
          <Card className="lg:sticky lg:top-6">
            <CardContent className="p-2 lg:p-4">
              <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  
                  return (
                    <div key={section.id} className="shrink-0 lg:shrink">
                      <button
                        onClick={() => handleSectionClick(section.id)}
                        className={`flex min-w-[86px] flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors lg:w-full lg:min-w-0 lg:flex-row lg:justify-start lg:gap-3 lg:text-sm ${
                          isActive
                            ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                            : "text-gray-700 hover:bg-purple-50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-center leading-tight lg:text-left">{section.name}</span>
                      </button>

                      {/* Subsections */}
                      {isActive && section.subsections && (
                        <div className="hidden lg:block ml-4 mt-1 space-y-1">
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
              {sections.find((section) => section.id === activeSection)?.subsections && (
                <div className="mt-2 flex gap-2 overflow-x-auto border-t pt-2 lg:hidden">
                  {sections.find((section) => section.id === activeSection)?.subsections?.map((subsection) => (
                    <button
                      key={subsection.id}
                      onClick={() => setActiveSubsection(subsection.id)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeSubsection === subsection.id
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {subsection.name}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="min-w-0 lg:col-span-9">
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

function AnalyticsSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState("");

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setGoogleAnalyticsId(data?.headerConfig?.marketing?.googleAnalyticsId || "");
    } catch (error) {
      console.error("Error loading analytics settings:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const currentSettings = await api.getVendorSettings(vendorId);
      const updatedHeaderConfig = {
        ...(currentSettings.headerConfig || {}),
        marketing: {
          ...(currentSettings.headerConfig?.marketing || {}),
          googleAnalyticsId: googleAnalyticsId.trim(),
        },
      };
      await api.updateVendorSettings(vendorId, { headerConfig: updatedHeaderConfig });
      alert("Google Analytics guardado correctamente");
    } catch (error: any) {
      console.error("Error saving analytics settings:", error);
      alert(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Analytics (GA4)</CardTitle>
        <CardDescription>
          Configura tu Measurement ID (ej: G-XXXXXXXXXX). Se inyectará automáticamente en tu tienda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Measurement ID</label>
            <Input
              value={googleAnalyticsId}
              onChange={(e) => setGoogleAnalyticsId(e.target.value)}
              placeholder="G-XXXXXXXXXX"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-2">Admin de Google Analytics → Flujo web → ID de medición</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar Google Analytics"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

function MercadoLibreSection() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectMode, setDisconnectMode] = useState<"account" | "account-and-publications" | null>(null);
  const [disconnectProgress, setDisconnectProgress] = useState<{
    total: number;
    processed: number;
    closed: number;
    paused: number;
    remaining: number;
    current: string;
  } | null>(null);
  const [syncSummary, setSyncSummary] = useState<{ total: number; processed: number; succeeded: number; failed: number; current: string; errors: string[] } | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [publicationConfig, setPublicationConfig] = useState<any>({ freeShipping: false, listingType: "gold_special", categoryRules: [] });
  const [connection, setConnection] = useState<{ connected: boolean; appConfigured: boolean; userId?: string }>({
    connected: false,
    appConfigured: false,
  });

  useEffect(() => {
    const callbackStatus = searchParams.get("mlStatus");
    if (!callbackStatus) return;

    if (callbackStatus === "success") {
      setMessageType("success");
      setMessage("Mercado Libre se conectó correctamente. Ya puedes configurar y sincronizar tus publicaciones.");
    } else {
      setMessageType("error");
      setMessage(searchParams.get("mlMessage") || "No pudimos conectar la cuenta de Mercado Libre. Inténtalo nuevamente.");
    }

    const cleanedParams = new URLSearchParams(window.location.search);
    cleanedParams.delete("mlStatus");
    cleanedParams.delete("mlMessage");
    const query = cleanedParams.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [searchParams]);

  useEffect(() => {
    const load = async (path: string) => {
      const response = await fetch(`${API_URL}/mercadolibre/${path}`, { headers: { Authorization: `Bearer ${api.getToken()}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo cargar la integración");
      return data;
    };
    load("connection")
      .then((connectionData) => {
        setConnection(connectionData);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
    load("configuration")
      .then((configData) => {
        setCategories(configData.categories || []);
        setPublicationConfig(configData);
      })
      .catch((error) => setMessage(error.message));
  }, []);

  const connect = async () => {
    setConnecting(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/mercadolibre/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo iniciar la conexión");
      window.location.assign(data.authorizationUrl);
    } catch (error: any) {
      setMessageType("error");
      setMessage(error.message);
      setConnecting(false);
    }
  };

  const updateRule = (categoryId: string, changes: any) => {
    setPublicationConfig((current: any) => {
      const existing = current.categoryRules.find((rule: any) => rule.categoryId === categoryId) || {
        categoryId, priceAdjustmentType: "fixed", priceAdjustmentValue: 0, titlePrefix: "", titleSuffix: "",
      };
      return { ...current, categoryRules: [...current.categoryRules.filter((rule: any) => rule.categoryId !== categoryId), { ...existing, ...changes }] };
    });
  };

  const saveConfiguration = async () => {
    setSavingConfig(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/mercadolibre/configuration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}` },
        body: JSON.stringify(publicationConfig),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo guardar la configuración");
      setPublicationConfig(data);
      setMessageType("success");
      setMessage("Configuración de publicación guardada.");
    } catch (error: any) { setMessageType("error"); setMessage(error.message); } finally { setSavingConfig(false); }
  };

  const syncAllProducts = async () => {
    setSyncingAll(true);
    setMessage("");
    try {
      const vendor = await api.getMyVendor();
      const pageSize = 500;
      const allProducts: any[] = [];
      let offset = 0;
      let total = Infinity;
      setSyncSummary({ total: 0, processed: 0, succeeded: 0, failed: 0, current: "Cargando catálogo completo…", errors: [] });
      while (offset < total) {
        const response = await api.getProducts({ vendorId: vendor.id, limit: pageSize, offset, includeOutOfStock: true });
        const page = Array.isArray(response) ? response : response.products || response.data || [];
        allProducts.push(...page);
        total = Array.isArray(response) ? page.length : Number(response.total ?? page.length);
        if (!page.length) break;
        offset += page.length;
      }
      const products = allProducts.filter((product: any) => product.status === "active");
      setSyncSummary({ total: products.length, processed: 0, succeeded: 0, failed: 0, current: "Preparando productos…", errors: [] });
      for (const product of products) {
        setSyncSummary((current) => current ? { ...current, current: product.title } : current);
        try {
          const publishResponse = await fetch(`${API_URL}/mercadolibre/products/${product.id}/publish`, {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}` },
          });
          const data = await publishResponse.json().catch(() => ({}));
          if (!publishResponse.ok) throw new Error(data.message || "No se pudo sincronizar");
          setSyncSummary((current) => current ? { ...current, processed: current.processed + 1, succeeded: current.succeeded + 1 } : current);
        } catch (error: any) {
          setSyncSummary((current) => current ? { ...current, processed: current.processed + 1, failed: current.failed + 1, errors: [...current.errors, `${product.title}: ${error.message}`].slice(-10) } : current);
        }
      }
      setSyncSummary((current) => current ? { ...current, current: "Sincronización finalizada" } : current);
    } catch (error: any) { setMessageType("error"); setMessage(error.message || "No se pudo iniciar la sincronización masiva"); } finally { setSyncingAll(false); }
  };

  const requestMercadoLibre = async (path: string, method: "GET" | "POST" = "POST") => {
    const response = await fetch(`${API_URL}/mercadolibre/${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "No se pudo completar la operación en Mercado Libre");
    return data;
  };

  const disconnectMercadoLibre = async () => {
    const mode = disconnectMode;
    if (!mode) return;
    setDisconnecting(true);
    setMessage("");
    setDisconnectProgress(null);
    try {
      if (mode === "account-and-publications") {
        const status = await requestMercadoLibre("account/publication-removal-status", "GET");
        let totals = {
          total: Number(status.total || 0),
          processed: 0,
          closed: 0,
          paused: 0,
          remaining: Number(status.total || 0),
          current: status.nextProductTitle || "Preparando publicaciones…",
        };
        setDisconnectProgress(totals);
        while (true) {
          const batch = await requestMercadoLibre("account/close-publications");
          totals = {
            total: totals.total,
            processed: totals.processed + Number(batch.processed || 0),
            closed: totals.closed + Number(batch.closed || 0),
            paused: totals.paused + Number(batch.paused || 0),
            remaining: Number(batch.remaining || 0),
            current: batch.nextProductTitle || "Finalizando desconexión…",
          };
          setDisconnectProgress(totals);
          if (batch.failed) {
            const firstFailure = batch.failures?.[0];
            throw new Error(`${batch.failed} publicación(es) no pudieron retirarse.${firstFailure ? ` ${firstFailure.title}: ${firstFailure.reason}` : ""}`);
          }
          if (!batch.remaining) break;
        }
      }

      const result = await requestMercadoLibre("account/disconnect");
      setConnection((current) => ({ ...current, connected: false, userId: undefined }));
      setMessageType(result.warning ? "error" : "success");
      setMessage(result.warning ? `${result.message} ${result.warning}` : result.message);
    } catch (error: any) {
      setMessageType("error");
      setMessage(error.message || "No se pudo desconectar la tienda de Mercado Libre");
    } finally {
      setDisconnecting(false);
      setDisconnectMode(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integración Mercado Libre</CardTitle>
        <CardDescription>Conecta la cuenta de Mercado Libre de esta tienda para publicar productos y sincronizar precio y stock.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-gray-500">Comprobando conexión…</p> : !connection.appConfigured ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">La aplicación de Mercado Libre aún no fue configurada por el administrador de la plataforma.</p>
        ) : connection.connected ? (
          <div className="space-y-5">
            <div className="rounded-lg bg-green-50 p-4 text-green-800">
              <p className="font-medium">Cuenta conectada correctamente</p>
              <p className="mt-1 text-sm">Usuario de Mercado Libre: {connection.userId}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => window.location.assign("/dashboard/integrations/mercadolibre")}>Gestionar publicaciones</Button>
                <Button variant="outline" onClick={connect} disabled={connecting}>{connecting ? "Reconectando…" : "Reconectar cuenta"}</Button>
              </div>
              <p className="mt-2 text-xs text-green-700">Usa Reconectar cuenta si Mercado Libre informa que la autorización expiró. Las publicaciones existentes se conservarán.</p>
            </div>
            <div className="space-y-4 rounded-lg border p-4">
              <div><h3 className="font-semibold text-slate-900">Publicación y envíos</h3><p className="text-sm text-slate-500">Estas reglas se aplican al publicar y resincronizar.</p></div>
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={publicationConfig.freeShipping} onChange={(event) => setPublicationConfig((current: any) => ({ ...current, freeShipping: event.target.checked }))} /> Ofrecer envío gratis mediante Mercado Envíos</label>
              <div><Label>Tipo de publicación</Label><select className="mt-1 w-full rounded-md border p-2" value={publicationConfig.listingType} onChange={(event) => setPublicationConfig((current: any) => ({ ...current, listingType: event.target.value }))}><option value="gold_special">Clásica</option><option value="gold_pro">Premium</option></select></div>
            </div>
            <div className="space-y-4 rounded-lg border p-4"><div><h3 className="font-semibold text-slate-900">Precios y títulos por categoría</h3><p className="text-sm text-slate-500">El ajuste se suma al precio de la tienda y el texto se agrega al título en Mercado Libre.</p></div>
              {categories.length ? categories.map((category) => { const rule = publicationConfig.categoryRules.find((item: any) => item.categoryId === category.id) || {}; return <div key={category.id} className="grid gap-3 rounded border p-3 md:grid-cols-5"><div className="font-medium md:col-span-1">{category.name}</div><select className="rounded border p-2" value={rule.priceAdjustmentType || "fixed"} onChange={(event) => updateRule(category.id, { priceAdjustmentType: event.target.value })}><option value="fixed">Monto $</option><option value="percentage">Porcentaje %</option></select><Input type="number" min="0" placeholder="Aumento" value={rule.priceAdjustmentValue || ""} onChange={(event) => updateRule(category.id, { priceAdjustmentValue: event.target.value })} /><Input placeholder="Texto al inicio" value={rule.titlePrefix || ""} onChange={(event) => updateRule(category.id, { titlePrefix: event.target.value })} /><Input placeholder="Texto al final" value={rule.titleSuffix || ""} onChange={(event) => updateRule(category.id, { titleSuffix: event.target.value })} /></div>; }) : <p className="text-sm text-slate-500">Aún no hay categorías activas con productos en esta tienda.</p>}
            </div>
            <div className="flex flex-wrap gap-3"><Button onClick={saveConfiguration} disabled={savingConfig || syncingAll}>{savingConfig ? "Guardando…" : "Guardar configuración"}</Button><Button variant="outline" onClick={syncAllProducts} disabled={syncingAll || savingConfig}>{syncingAll ? "Sincronizando…" : "Sincronizar todos los productos"}</Button></div>
            {syncSummary && <div className="rounded-lg border bg-slate-50 p-4 text-sm"><p className="font-semibold text-slate-900">Sincronización masiva</p><p className="mt-1 text-slate-600">{syncSummary.processed}/{syncSummary.total} procesados · <span className="text-emerald-700">{syncSummary.succeeded} correctos</span> · <span className="text-red-700">{syncSummary.failed} con error</span></p><p className="mt-2 truncate text-slate-700">{syncSummary.current}</p>{syncSummary.errors.length > 0 && <ul className="mt-3 max-h-32 list-disc space-y-1 overflow-y-auto pl-5 text-red-700">{syncSummary.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>}</div>}
            <div className="border-t border-red-200 pt-5">
              <h3 className="font-semibold text-red-800">Desconectar integración</h3>
              <p className="mt-1 text-sm text-slate-600">Puedes conservar las publicaciones en Mercado Libre o retirarlas antes de revocar el acceso de esta tienda.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={disconnecting} onClick={() => setDisconnectMode("account")}>Desconectar tienda</Button>
                <Button variant="destructive" disabled={disconnecting} onClick={() => setDisconnectMode("account-and-publications")}>Desconectar y retirar publicaciones</Button>
              </div>
              {disconnectProgress && (
                <div className="mt-4 max-w-2xl rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-4 font-medium text-slate-900">
                    <span>Retirando publicación {Math.min(disconnectProgress.processed + 1, disconnectProgress.total)} de {disconnectProgress.total}</span>
                    <span>{disconnectProgress.total > 0 ? Math.round((disconnectProgress.processed / disconnectProgress.total) * 100) : 100}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${disconnectProgress.total > 0 ? (disconnectProgress.processed / disconnectProgress.total) * 100 : 100}%` }} />
                  </div>
                  <p className="mt-3 truncate font-medium text-slate-800" title={disconnectProgress.current}>{disconnectProgress.current}</p>
                  <p className="mt-1 text-slate-600">Procesadas: {disconnectProgress.processed} · Finalizadas: {disconnectProgress.closed} · Pausadas: {disconnectProgress.paused} · Restantes: {disconnectProgress.remaining}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600">Al continuar, iniciarás sesión en Mercado Libre para autorizar sólo a esta tienda.</p>
            <Button className="mt-4" onClick={connect} disabled={connecting}>{connecting ? "Conectando…" : "Conectar Mercado Libre"}</Button>
          </div>
        )}
        {message && <p className={`rounded-lg p-3 text-sm ${messageType === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message}</p>}
      </CardContent>
      <ConfirmDialog
        open={disconnectMode !== null}
        onOpenChange={(open) => { if (!open && !disconnecting) setDisconnectMode(null); }}
        onConfirm={disconnectMercadoLibre}
        title={disconnectMode === "account-and-publications" ? "Desconectar y retirar publicaciones" : "Desconectar tienda"}
        description={disconnectMode === "account-and-publications"
          ? "Se intentará finalizar cada publicación vinculada. Si Mercado Libre no permite finalizar alguna, se pausará. La cuenta se desconectará solamente cuando todas hayan sido retiradas."
          : "Se revocará el acceso de MundoBeat a esta cuenta. Las publicaciones existentes permanecerán activas en Mercado Libre y dejarán de sincronizar precio y stock."}
        confirmText={disconnectMode === "account-and-publications" ? "Retirar y desconectar" : "Desconectar"}
        variant="destructive"
        loading={disconnecting}
      />
    </Card>
  );
}

function FalabellaSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [syncingOrders, setSyncingOrders] = useState(false);
  const [message, setMessage] = useState("");
  const [config, setConfig] = useState({ userId: "", apiKey: "", country: "cl", apiKeyConfigured: false, connected: false, webhookConfigured: false, config: { primaryCategory: "", brand: "", conditionType: "Nuevo", packageHeight: 1, packageWidth: 1, packageLength: 1, packageWeight: 1 } });
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(false);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch(`${API_URL}/falabella/categories`, { headers: { Authorization: `Bearer ${api.getToken()}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudieron cargar las categorías de Falabella");
      setCategories(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setMessage(error.message || "No se pudieron cargar las categorías de Falabella");
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetch(`${API_URL}/falabella/configuration`, { headers: { Authorization: `Bearer ${api.getToken()}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "No se pudo cargar la configuración");
        setConfig((current) => ({ ...current, ...data }));
        if (data.connected) void loadCategories();
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/falabella/configuration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}` },
        body: JSON.stringify({ userId: config.userId, apiKey: config.apiKey, country: config.country, config: config.config }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo guardar la configuración");
      setConfig((current) => ({ ...current, ...data, apiKey: "" }));
      setMessage("Credenciales de Falabella guardadas correctamente.");
      if (data.connected) void loadCategories();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const registerWebhook = async () => {
    setRegisteringWebhook(true); setMessage("");
    try {
      const response = await fetch(`${API_URL}/falabella/webhook/register`, { method: "POST", headers: { Authorization: `Bearer ${api.getToken()}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo registrar el webhook");
      setConfig((current) => ({ ...current, webhookConfigured: true }));
      setMessage("Webhook de pedidos Falabella registrado correctamente.");
    } catch (error: any) { setMessage(error.message); }
    finally { setRegisteringWebhook(false); }
  };

  const syncOrders = async () => {
    setSyncingOrders(true); setMessage("");
    try {
      const response = await fetch(`${API_URL}/falabella/orders/sync`, { method: "POST", headers: { Authorization: `Bearer ${api.getToken()}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudieron sincronizar los pedidos");
      setMessage(`Pedidos Falabella sincronizados: ${data.processed}.`);
    } catch (error: any) { setMessage(error.message); }
    finally { setSyncingOrders(false); }
  };

  return <Card>
    <CardHeader>
      <CardTitle>Integración Falabella Seller Center</CardTitle>
      <CardDescription>Conecta esta tienda con su propia cuenta Falabella para publicar catálogo y sincronizar precio y stock.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {loading ? <p className="text-sm text-gray-500">Cargando configuración…</p> : <>
        {config.connected && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Credenciales configuradas. Los productos se publican desde el listado de productos y Falabella procesa cada envío como un feed.</p>}
        <div className="space-y-2"><Label>UserID</Label><Input value={config.userId} onChange={(event) => setConfig((current) => ({ ...current, userId: event.target.value }))} placeholder="Usuario o correo de integración" /></div>
        <div className="space-y-2"><Label>API Key</Label><Input type="password" value={config.apiKey} onChange={(event) => setConfig((current) => ({ ...current, apiKey: event.target.value }))} placeholder={config.apiKeyConfigured ? "Deja vacío para conservar la API Key actual" : "API Key de Falabella Seller Center"} /></div>
        <div className="space-y-2"><Label>País</Label><select className="w-full rounded-md border p-2" value={config.country} onChange={(event) => setConfig((current) => ({ ...current, country: event.target.value }))}><option value="cl">Chile</option><option value="pe">Perú</option><option value="co">Colombia</option></select></div>
        <div className="rounded-lg border p-4 space-y-4">
          <div><h3 className="font-medium">Datos predeterminados del catálogo</h3><p className="text-xs text-muted-foreground mt-1">Falabella exige estos valores al crear el producto. La categoría primaria debe ser el identificador de Seller Center.</p></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3"><Label>Categoría primaria de Falabella</Label><Button type="button" variant="outline" size="sm" onClick={loadCategories} disabled={loadingCategories}>{loadingCategories ? "Cargando…" : "Actualizar categorías"}</Button></div>
            <Input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Buscar por nombre o ID…" disabled={loadingCategories} />
            <select className="w-full rounded-md border p-2" value={config.config.primaryCategory} onChange={(event) => setConfig((current) => ({ ...current, config: { ...current.config, primaryCategory: event.target.value } }))} disabled={loadingCategories || categories.length === 0}>
              <option value="">{loadingCategories ? "Cargando categorías…" : categories.length ? "Selecciona una categoría" : "Guarda las credenciales para cargar categorías"}</option>
              {categories.filter((category) => `${category.name} ${category.id}`.toLocaleLowerCase('es').includes(categorySearch.toLocaleLowerCase('es'))).slice(0, 300).map((category) => <option key={category.id} value={category.id}>{category.name} — {category.id}</option>)}
            </select>
            {categories.length > 300 && <p className="text-xs text-muted-foreground">Escribe para filtrar las {categories.length} categorías disponibles.</p>}
          </div>
          <div className="space-y-2"><Label>Marca predeterminada</Label><Input value={config.config.brand} onChange={(event) => setConfig((current) => ({ ...current, config: { ...current.config, brand: event.target.value } }))} placeholder="Marca aceptada por Falabella" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>Condición</Label><select className="w-full rounded-md border p-2" value={config.config.conditionType} onChange={(event) => setConfig((current) => ({ ...current, config: { ...current.config, conditionType: event.target.value } }))}><option value="Nuevo">Nuevo</option><option value="Usado">Usado</option></select></div>
            <div className="space-y-2"><Label>Peso predeterminado (kg)</Label><Input type="number" min="0.01" step="0.01" value={config.config.packageWeight} onChange={(event) => setConfig((current) => ({ ...current, config: { ...current.config, packageWeight: Number(event.target.value) } }))} /></div>
            <div className="space-y-2"><Label>Alto predeterminado (cm)</Label><Input type="number" min="0.01" step="0.01" value={config.config.packageHeight} onChange={(event) => setConfig((current) => ({ ...current, config: { ...current.config, packageHeight: Number(event.target.value) } }))} /></div>
            <div className="space-y-2"><Label>Ancho predeterminado (cm)</Label><Input type="number" min="0.01" step="0.01" value={config.config.packageWidth} onChange={(event) => setConfig((current) => ({ ...current, config: { ...current.config, packageWidth: Number(event.target.value) } }))} /></div>
            <div className="space-y-2"><Label>Largo predeterminado (cm)</Label><Input type="number" min="0.01" step="0.01" value={config.config.packageLength} onChange={(event) => setConfig((current) => ({ ...current, config: { ...current.config, packageLength: Number(event.target.value) } }))} /></div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Crea un usuario con rol Seller Full Access en Falabella Seller Center. Cada tienda debe ingresar sus propias credenciales.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar credenciales"}</Button>
          <Button type="button" variant="outline" onClick={registerWebhook} disabled={!config.connected || config.webhookConfigured || registeringWebhook}>{registeringWebhook ? "Registrando…" : config.webhookConfigured ? "Webhook de pedidos registrado" : "Registrar webhook de pedidos"}</Button>
          <Button type="button" variant="outline" onClick={syncOrders} disabled={!config.connected || syncingOrders}>{syncingOrders ? "Sincronizando…" : "Sincronizar pedidos ahora"}</Button>
        </div>
        {config.webhookConfigured && <p className="text-xs text-green-700">Webhook de pedidos activo.</p>}
      </>}
      {message && <p className={`rounded-lg p-3 text-sm ${message.includes("correctamente") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message}</p>}
    </CardContent>
  </Card>;
}

function ParisSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [familyId, setFamilyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priceTypeId, setPriceTypeId] = useState("");
  const [families, setFamilies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [vendorCategories, setVendorCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [priceTypes, setPriceTypes] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<any[]>([]);
  const [variantAttributes, setVariantAttributes] = useState<any[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [variantAttributeValues, setVariantAttributeValues] = useState<Record<string, string>>({});
  const [categoryRules, setCategoryRules] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"integration" | "fields">("integration");
  const [message, setMessage] = useState("");

  const headers = { Authorization: `Bearer ${api.getToken()}` };

  const loadCategories = async (selectedFamilyId: string) => {
    if (!selectedFamilyId) {
      setCategories([]);
      return;
    }
    const response = await fetch(`${API_URL}/paris/families/${encodeURIComponent(selectedFamilyId)}/categories`, { headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudieron cargar las categorías de París");
    setCategories(Array.isArray(data) ? data : []);
  };

  const loadAttributes = async (selectedFamilyId: string) => {
    if (!selectedFamilyId) {
      setAttributes([]);
      setVariantAttributes([]);
      return;
    }
    const response = await fetch(`${API_URL}/paris/families/${encodeURIComponent(selectedFamilyId)}/attributes`, { headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudieron cargar los atributos de París");
    setAttributes(Array.isArray(data.product) ? data.product : []);
    setVariantAttributes(Array.isArray(data.variant) ? data.variant : []);
  };

  useEffect(() => {
    fetch(`${API_URL}/paris/configuration`, { headers: { Authorization: `Bearer ${api.getToken()}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "No se pudo cargar la configuración");
        setConfigured(Boolean(data.apiKeyConfigured));
        setFamilyId(data.config?.familyId || "");
        setCategoryId(data.config?.categoryId || "");
        setPriceTypeId(data.config?.priceTypeId || "");
        setAttributeValues(data.config?.attributeValues || {});
        setVariantAttributeValues(data.config?.variantAttributeValues || {});
        setCategoryRules(data.config?.categoryRules || []);
        setVendorCategories(data.categories || []);
        if (data.apiKeyConfigured) {
          const familiesResponse = await fetch(`${API_URL}/paris/families`, { headers });
          const familiesData = await familiesResponse.json();
          if (!familiesResponse.ok) throw new Error(familiesData.message || "No se pudieron cargar las familias de París");
          setFamilies(Array.isArray(familiesData) ? familiesData : []);
          const priceTypesResponse = await fetch(`${API_URL}/paris/price-types`, { headers });
          const priceTypesData = await priceTypesResponse.json();
          if (!priceTypesResponse.ok) throw new Error(priceTypesData.message || "No se pudieron cargar los tipos de precio de París");
          setPriceTypes(Array.isArray(priceTypesData) ? priceTypesData : []);
          if (data.config?.familyId) {
            await Promise.all([loadCategories(data.config.familyId), loadAttributes(data.config.familyId)]);
          }
        }
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/paris/configuration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}` },
        body: JSON.stringify({ apiKey, config: { familyId, categoryId, priceTypeId, attributeValues, variantAttributeValues, categoryRules } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo guardar la configuración");
      setConfigured(Boolean(data.apiKeyConfigured));
      if (data.apiKeyConfigured && families.length === 0) {
        const familiesResponse = await fetch(`${API_URL}/paris/families`, { headers });
        const familiesData = await familiesResponse.json();
        if (!familiesResponse.ok) throw new Error(familiesData.message || "No se pudieron cargar las familias de París");
        setFamilies(Array.isArray(familiesData) ? familiesData : []);
      }
      setApiKey("");
      setMessage("Configuración de Marketplace Paris guardada correctamente.");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/paris/connection/test`, { method: "POST", headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo validar la conexión");
      setMessage("Conexión con Marketplace Paris validada correctamente.");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setTesting(false);
    }
  };

  const updateCategoryRule = (categoryId: string, changes: any) => {
    setCategoryRules((current) => {
      const existing = current.find((rule) => rule.categoryId === categoryId) || {
        categoryId, priceAdjustmentType: "fixed", priceAdjustmentValue: 0, titlePrefix: "", titleSuffix: "",
      };
      return [...current.filter((rule) => rule.categoryId !== categoryId), { ...existing, ...changes }];
    });
  };

  return <Card>
    <CardHeader>
      <CardTitle>Integración Marketplace Paris</CardTitle>
      <CardDescription>Conecta esta tienda con Marketplace Paris / Cencosud y selecciona la familia y categoría para las publicaciones.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {loading ? <p className="text-sm text-gray-500">Cargando configuración…</p> : <>
        <div className="flex gap-2 border-b">
          <button type="button" onClick={() => setActiveTab("integration")} className={`border-b-2 px-3 py-2 text-sm font-medium ${activeTab === "integration" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Integración y reglas</button>
          <button type="button" onClick={() => setActiveTab("fields")} disabled={!configured} className={`border-b-2 px-3 py-2 text-sm font-medium ${activeTab === "fields" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>Campos de producto</button>
        </div>
        {activeTab === "integration" && <>
          {configured && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">API Key configurada para esta tienda.</p>}
          <div className="space-y-2"><Label>API Key</Label><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={configured ? "Ingresa una nueva clave solo si deseas reemplazarla" : "API Key de Marketplace Paris"} /></div>
          <p className="text-xs text-muted-foreground">Obtén la clave en Marketplace Cencosud → Mi Cuenta → Integraciones. La tienda debe tener habilitado el modelo de integración propia.</p>
          {configured && <div className="space-y-4 rounded-lg border p-4"><div><h3 className="font-semibold text-slate-900">Precios y títulos por categoría</h3><p className="text-sm text-slate-500">El ajuste se suma al precio de la tienda y el texto se agrega al título en París.</p></div>
            {vendorCategories.length ? vendorCategories.map((category) => { const rule = categoryRules.find((item) => item.categoryId === category.id) || {}; return <div key={category.id} className="grid gap-3 rounded border p-3 md:grid-cols-5"><div className="font-medium md:col-span-1">{category.name}</div><select className="rounded border p-2" value={rule.priceAdjustmentType || "fixed"} onChange={(event) => updateCategoryRule(category.id, { priceAdjustmentType: event.target.value })}><option value="fixed">Monto $</option><option value="percentage">Porcentaje %</option></select><Input type="number" min="0" placeholder="Aumento" value={rule.priceAdjustmentValue || ""} onChange={(event) => updateCategoryRule(category.id, { priceAdjustmentValue: event.target.value })} /><Input placeholder="Texto al inicio" value={rule.titlePrefix || ""} onChange={(event) => updateCategoryRule(category.id, { titlePrefix: event.target.value })} /><Input placeholder="Texto al final" value={rule.titleSuffix || ""} onChange={(event) => updateCategoryRule(category.id, { titleSuffix: event.target.value })} /></div>; }) : <p className="text-sm text-slate-500">Aún no hay categorías activas con productos en esta tienda.</p>}
          </div>}
        </>}
        {activeTab === "fields" && configured && <>
          <div className="grid gap-4 md:grid-cols-2">
            <SearchableParisSelect
              label="Familia París"
              placeholder="Buscar familia..."
              options={families}
              value={familyId}
              onChange={async (value) => { setFamilyId(value); setCategoryId(""); setAttributeValues({}); setVariantAttributeValues({}); try { await Promise.all([loadCategories(value), loadAttributes(value)]); } catch (error: any) { setMessage(error.message); } }}
            />
            <SearchableParisSelect
              label="Categoría París"
              placeholder="Buscar categoría..."
              options={categories}
              value={categoryId}
              disabled={!familyId}
              onChange={setCategoryId}
            />
            <div className="space-y-2 md:col-span-2">
              <Label>Tipo de precio de lista</Label>
              <select value={priceTypeId} onChange={(event) => setPriceTypeId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecciona el precio de lista de París</option>
                {priceTypes.map((priceType) => <option key={priceType.id || priceType.code} value={priceType.id || priceType.code}>{priceType.name || priceType.code || priceType.id}</option>)}
              </select>
            </div>
          </div>
        </>}
        {activeTab === "fields" && attributes.length > 0 && <div className="space-y-3 rounded-lg border p-4">
          <div><Label>Atributos del producto</Label><p className="text-xs text-muted-foreground">Completa los atributos requeridos por París. En las listas, selecciona una opción válida.</p></div>
          <div className="grid gap-3 md:grid-cols-2">
            {attributes.map((attribute) => {
              const options = Array.isArray(attribute.attributeOptions) ? attribute.attributeOptions : [];
              return options.length > 0
                ? <SearchableParisSelect key={attribute.id} label={attribute.name} placeholder={`Buscar ${attribute.name.toLowerCase()}...`} options={options} value={attributeValues[attribute.id] || ""} onChange={(value) => setAttributeValues((current) => ({ ...current, [attribute.id]: value }))} />
                : <div key={attribute.id} className="space-y-1"><Label className="text-sm">{attribute.name}</Label><Input value={attributeValues[attribute.id] || ""} onChange={(event) => setAttributeValues((current) => ({ ...current, [attribute.id]: event.target.value }))} /></div>;
            })}
          </div>
        </div>}
        {activeTab === "fields" && variantAttributes.length > 0 && <div className="space-y-3 rounded-lg border p-4">
          <div><Label>Atributos de la variante</Label><p className="text-xs text-muted-foreground">París exige al menos un atributo de variante. Para discos sin variantes, configura el valor que aplique a la unidad vendida.</p></div>
          <div className="grid gap-3 md:grid-cols-2">
            {variantAttributes.map((attribute) => {
              const options = Array.isArray(attribute.attributeOptions) ? attribute.attributeOptions : [];
              return options.length > 0
                ? <SearchableParisSelect key={attribute.id} label={attribute.name} placeholder={`Buscar ${attribute.name.toLowerCase()}...`} options={options} value={variantAttributeValues[attribute.id] || ""} onChange={(value) => setVariantAttributeValues((current) => ({ ...current, [attribute.id]: value }))} />
                : <div key={attribute.id} className="space-y-1"><Label className="text-sm">{attribute.name}</Label><Input value={variantAttributeValues[attribute.id] || ""} onChange={(event) => setVariantAttributeValues((current) => ({ ...current, [attribute.id]: event.target.value }))} /></div>;
            })}
          </div>
        </div>}
        <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</Button>{configured && <Button type="button" variant="outline" onClick={testConnection} disabled={testing}>{testing ? "Validando…" : "Probar conexión"}</Button>}</div>
      </>}
      {message && <p className={`rounded-lg p-3 text-sm ${message.includes("correctamente") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{message}</p>}
    </CardContent>
  </Card>;
}

function SearchableParisSelect({ label, placeholder, options, value, disabled = false, onChange }: { label: string; placeholder: string; options: any[]; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);
  const selectedLabel = selected?.name || selected?.code || selected?.id || "";
  const normalizedQuery = query.trim().toLocaleLowerCase('es-CL');
  const filteredOptions = options
    .filter((option) => String(option.name || option.code || option.id || "").toLocaleLowerCase('es-CL').includes(normalizedQuery))
    .slice(0, 50);

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [open, selectedLabel]);

  return <div className="space-y-2 relative">
    <Label>{label}</Label>
    <Input
      value={open ? query : selectedLabel}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => { setQuery(""); setOpen(true); }}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
      onBlur={() => window.setTimeout(() => setOpen(false), 150)}
    />
    {open && !disabled && <div className="absolute z-30 top-[4.5rem] max-h-64 w-full overflow-y-auto rounded-md border border-input bg-white py-1 shadow-lg">
      {filteredOptions.length === 0 ? <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p> : <>{options.length > 50 && <p className="px-3 py-2 text-xs text-muted-foreground">Escribe para filtrar. Se muestran hasta 50 resultados.</p>}{filteredOptions.map((option) => {
        const optionLabel = option.name || option.code || option.id;
        return <button key={option.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.id); setOpen(false); }}>{optionLabel}</button>;
      })}</>}
    </div>}
  </div>;
}

function GoogleMerchantSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [feedUrl, setFeedUrl] = useState("");
  const [diagnostics, setDiagnostics] = useState({ total: 0, included: 0, missingImage: 0, missingDescription: 0 });
  const [config, setConfig] = useState({
    enabled: true,
    verificationCode: "",
    merchantId: "",
    condition: "all",
  });

  useEffect(() => {
    if (!vendorId) return;
    const load = async () => {
      setLoadingData(true);
      try {
        const [settings, vendor, productsResponse] = await Promise.all([
          api.getVendorSettings(vendorId),
          api.getVendor(vendorId),
          api.getProducts({ vendorId, limit: 500, includeOutOfStock: true }),
        ]);
        const saved = settings?.headerConfig?.marketing?.googleMerchant || {};
        const customDomain = vendor?.customDomainVerified && vendor?.customDomain
          ? String(vendor.customDomain).replace(/^https?:\/\//, "").replace(/\/$/, "")
          : "";
        const storeHost = customDomain || `${vendor.slug}.mundobeat.cl`;
        setFeedUrl(`https://${storeHost}/google-merchant.xml`);
        setConfig({
          enabled: saved.enabled !== false,
          verificationCode: saved.verificationCode || "",
          merchantId: saved.merchantId || "",
          condition: saved.condition || "all",
        });

        const products = Array.isArray(productsResponse)
          ? productsResponse
          : productsResponse?.products || productsResponse?.data || [];
        const eligible = products.filter((product: any) =>
          product.status !== "trash" && product.status !== "inactive" && Number(product.stock) > 0,
        );
        const included = eligible.filter((product: any) =>
          Array.isArray(product.images) && Boolean(product.images[0]) && Number(product.price) > 0,
        );
        setDiagnostics({
          total: products.length,
          included: included.length,
          missingImage: eligible.filter((product: any) => !Array.isArray(product.images) || !product.images[0]).length,
          missingDescription: eligible.filter((product: any) => !String(product.shortDescription || product.description || "").trim()).length,
        });
      } catch (error) {
        console.error("Error loading Google Merchant settings:", error);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [vendorId]);

  const normalizeVerificationCode = (value: string) => {
    const contentMatch = value.match(/content=["']([^"']+)["']/i);
    return (contentMatch?.[1] || value).trim();
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const currentSettings = await api.getVendorSettings(vendorId);
      const googleMerchant = {
        ...config,
        verificationCode: normalizeVerificationCode(config.verificationCode),
      };
      const headerConfig = {
        ...(currentSettings.headerConfig || {}),
        marketing: {
          ...(currentSettings.headerConfig?.marketing || {}),
          googleMerchant,
        },
      };
      await api.updateVendorSettings(vendorId, { headerConfig });
      setConfig(googleMerchant);
      alert("Google Merchant Center guardado correctamente");
    } catch (error: any) {
      alert(error.message || "No se pudo guardar la integración");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return <Card><CardContent className="py-10 text-center text-gray-500">Cargando integración...</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Google Merchant Center</CardTitle>
          <CardDescription>Verifica el dominio y publica el catálogo de tu tienda mediante un feed automático.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) => setConfig({ ...config, enabled: event.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">Activar feed de productos</span>
            </label>

            <div>
              <Label htmlFor="merchant-verification">Código de verificación de Google</Label>
              <Input
                id="merchant-verification"
                value={config.verificationCode}
                onChange={(event) => setConfig({ ...config, verificationCode: event.target.value })}
                placeholder="Pega el código o la etiqueta meta completa"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-gray-500">Acepta solo el código o la etiqueta HTML entregada por Google.</p>
            </div>

            <div>
              <Label htmlFor="merchant-id">ID de Merchant Center</Label>
              <Input
                id="merchant-id"
                value={config.merchantId}
                onChange={(event) => setConfig({ ...config, merchantId: event.target.value.replace(/\D/g, "") })}
                placeholder="123456789"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="merchant-condition">Productos incluidos</Label>
              <select
                id="merchant-condition"
                value={config.condition}
                onChange={(event) => setConfig({ ...config, condition: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="all">Nuevos y usados</option>
                <option value="new">Solo nuevos</option>
                <option value="used">Solo usados</option>
              </select>
            </div>

            <Button type="submit" disabled={loading} className="text-white theme-gradient-bg">
              {loading ? "Guardando..." : "Guardar integración"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feed de productos</CardTitle>
          <CardDescription>Agrega esta URL como fuente de datos programada en Merchant Center.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={feedUrl} readOnly className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(feedUrl)}>Copiar URL</Button>
            <Button type="button" variant="outline" onClick={() => window.open(feedUrl, "_blank")}>Ver feed</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="border p-3"><p className="text-xs text-gray-500">Catálogo</p><p className="text-xl font-semibold">{diagnostics.total}</p></div>
            <div className="border p-3"><p className="text-xs text-gray-500">Incluidos</p><p className="text-xl font-semibold text-green-700">{diagnostics.included}</p></div>
            <div className="border p-3"><p className="text-xs text-gray-500">Sin imagen</p><p className="text-xl font-semibold text-amber-700">{diagnostics.missingImage}</p></div>
            <div className="border p-3"><p className="text-xs text-gray-500">Sin descripción</p><p className="text-xl font-semibold text-amber-700">{diagnostics.missingDescription}</p></div>
          </div>
          <p className="text-xs text-gray-500">El feed excluye automáticamente productos agotados, inactivos y enviados a papelera.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function FacebookPixelSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [facebookPixelId, setFacebookPixelId] = useState("");

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setFacebookPixelId(data?.headerConfig?.marketing?.facebookPixelId || "");
    } catch (error) {
      console.error("Error loading pixel settings:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const currentSettings = await api.getVendorSettings(vendorId);
      const updatedHeaderConfig = {
        ...(currentSettings.headerConfig || {}),
        marketing: {
          ...(currentSettings.headerConfig?.marketing || {}),
          facebookPixelId: facebookPixelId.trim(),
        },
      };
      await api.updateVendorSettings(vendorId, { headerConfig: updatedHeaderConfig });
      alert("Facebook Pixel guardado correctamente");
    } catch (error: any) {
      console.error("Error saving pixel settings:", error);
      alert(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facebook Pixel (Meta)</CardTitle>
        <CardDescription>
          Configura tu Pixel ID (solo números). Se inyectará automáticamente en tu tienda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Pixel ID</label>
            <Input
              value={facebookPixelId}
              onChange={(e) => setFacebookPixelId(e.target.value)}
              placeholder="123456789012345"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-2">Administrador de eventos de Meta → Orígenes de datos → Pixel ID</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar Facebook Pixel"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

function SeoMarketingSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [seo, setSeo] = useState({
    metaTitle: "",
    metaDescription: "",
    ogImage: "",
  });

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setSeo({
        metaTitle: data?.headerConfig?.seo?.metaTitle || "",
        metaDescription: data?.headerConfig?.seo?.metaDescription || "",
        ogImage: data?.headerConfig?.seo?.ogImage || "",
      });
    } catch (error) {
      console.error("Error loading seo settings:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const currentSettings = await api.getVendorSettings(vendorId);
      const updatedHeaderConfig = {
        ...(currentSettings.headerConfig || {}),
        seo: {
          ...(currentSettings.headerConfig?.seo || {}),
          metaTitle: seo.metaTitle.trim(),
          metaDescription: seo.metaDescription.trim(),
          ogImage: seo.ogImage.trim(),
        },
      };
      await api.updateVendorSettings(vendorId, { headerConfig: updatedHeaderConfig });
      alert("SEO y Marketing guardado correctamente");
    } catch (error: any) {
      console.error("Error saving seo settings:", error);
      alert(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO y Marketing</CardTitle>
        <CardDescription>
          Define título SEO, descripción y OG image para tu tienda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Título SEO</label>
            <Input
              value={seo.metaTitle}
              onChange={(e) => setSeo({ ...seo, metaTitle: e.target.value })}
              placeholder="CDmania | Tienda de música en MundoBeat"
              className="mt-1"
              maxLength={70}
            />
            <p className="text-xs text-gray-500 mt-2">Ideal: 50-60 caracteres</p>
          </div>
          <div>
            <label className="text-sm font-medium">Descripción SEO</label>
            <textarea
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
              maxLength={160}
              value={seo.metaDescription}
              onChange={(e) => setSeo({ ...seo, metaDescription: e.target.value })}
              placeholder="Descubre vinilos, CDs y más en CDmania."
            />
            <p className="text-xs text-gray-500 mt-2">Ideal: 140-160 caracteres</p>
          </div>
          <div>
            <label className="text-sm font-medium">OG Image URL</label>
            <Input
              value={seo.ogImage}
              onChange={(e) => setSeo({ ...seo, ogImage: e.target.value })}
              placeholder="https://.../imagen-og.jpg"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-2">Recomendado: 1200x630px</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar SEO y Marketing"}
          </button>
        </form>
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

  useEffect(() => {
    loadVendor();
  }, [vendorId]);

  const loadVendor = async () => {
    try {
      const data = await api.getVendor(vendorId);
      setVendor({
        storeName: data.storeName || "",
        slug: data.slug || "",
        email: data.email || "",
        phone: data.phone || "",
        description: data.description || "",
      });
      setCharCount(data.description?.length || 0);
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
          <label className="relative inline-flex items-center cursor-not-allowed opacity-75">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={publishInMarketplace}
              disabled={true}
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>¿Cómo funciona?</strong><br />
            Esta opción está siempre activada. Tus productos son visibles en la página principal del marketplace (<strong>http://localhost:3000</strong>), donde todos los visitantes pueden descubrirlos. Tu tienda individual seguirá siendo accesible independientemente de esta configuración.
          </p>
          <p className="text-sm text-blue-700 mt-2">
            <strong>Nota:</strong> Solo el administrador del marketplace puede desactivar esta opción si es necesario.
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
  const [policies, setPolicies] = useState<any>({});
  const [storeName, setStoreName] = useState("tu tienda");
  const [storeSlug, setStoreSlug] = useState("");
  const [additionalConditions, setAdditionalConditions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [settings, vendor] = await Promise.all([
          api.getVendorSettings(vendorId),
          api.getMyVendor(),
        ]);
        const currentPolicies = settings?.policies && typeof settings.policies === "object"
          ? settings.policies
          : {};
        setPolicies(currentPolicies);
        setAdditionalConditions(getReturnsPolicySettings(currentPolicies).additionalConditions);
        setStoreName(vendor?.storeName || vendor?.name || "tu tienda");
        setStoreSlug(vendor?.slug || "");
      } catch (error: any) {
        setMessage({ type: "error", text: error?.message || "No se pudo cargar la política" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [vendorId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const nextPolicies = {
        ...policies,
        returnsPolicy: {
          ...DEFAULT_RETURNS_POLICY,
          additionalConditions: additionalConditions.trim(),
        },
      };
      await api.updateVendorSettings(vendorId, { policies: nextPolicies });
      setPolicies(nextPolicies);
      setMessage({ type: "success", text: "Política guardada correctamente" });
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "No se pudo guardar la política" });
    } finally {
      setSaving(false);
    }
  };

  const publicPath = storeSlug
    ? `/tiendas/${storeSlug}/politicas-de-cambios-y-devoluciones`
    : "/politicas-de-cambios-y-devoluciones";

  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-56 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando políticas...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Políticas y devoluciones</CardTitle>
              <CardDescription className="mt-1">
                La política legal es común para todas las tiendas. Puedes agregar beneficios o condiciones que no reduzcan los derechos mínimos.
              </CardDescription>
            </div>
            <a href={publicPath} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full sm:w-auto">
                <ExternalLink className="mr-2 h-4 w-4" /> Ver página pública
              </Button>
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <div className={`border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {message.text}
            </div>
          )}

          <div className="flex gap-3 border border-sky-200 bg-sky-50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
            <div>
              <p className="font-semibold text-sky-950">Texto legal protegido</p>
              <p className="mt-1 text-sm leading-6 text-sky-900">
                El comprador paga la devolución cuando ejerce el retracto. Si hay una falla, error de despacho o incumplimiento, la devolución es pagada por la tienda.
              </p>
            </div>
          </div>

          <details className="border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer font-semibold text-slate-800">Ver texto obligatorio en modo sólo lectura</summary>
            <div className="mt-5 border-t border-slate-200 pt-5">
              <ReturnsPolicyContent storeName={storeName} compact />
            </div>
          </details>

          <div>
            <Label htmlFor="additional-return-conditions">Condiciones adicionales de la tienda</Label>
            <p className="mb-2 mt-1 text-sm text-slate-500">
              Puedes ofrecer cambios voluntarios, plazos más amplios u otros beneficios. No repitas el texto obligatorio ni agregues restricciones legales.
            </p>
            <textarea
              id="additional-return-conditions"
              value={additionalConditions}
              onChange={(event) => setAdditionalConditions(event.target.value.slice(0, 4000))}
              rows={7}
              maxLength={4000}
              placeholder="Ejemplo: Ofrecemos cambios voluntarios dentro de 30 días, presentando el comprobante de compra."
              className="w-full border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
            <div className="mt-1 text-right text-xs text-slate-400">{additionalConditions.length}/4000</div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar condiciones
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vista previa del contenido</CardTitle>
          <CardDescription>Así se integrarán tus condiciones con la política obligatoria.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReturnsPolicyContent storeName={storeName} additionalConditions={additionalConditions} compact />
        </CardContent>
      </Card>
    </div>
  );
}

function NotificacionesSection({ vendorId }: { vendorId: string }) {
  return <PlaceholderSection title="Notificaciones" />;
}

function FacturacionSection({ vendorId }: { vendorId: string }) {
  const emptyProfile = {
    taxpayerType: "natural",
    billingRut: "",
    billingLegalName: "",
    billingBusinessActivity: "",
    billingAddress: "",
    billingRegion: "",
    billingCommune: "",
    billingEmail: "",
  };
  const [profile, setProfile] = useState(emptyProfile);
  const [regions, setRegions] = useState<any[]>([]);
  const [communes, setCommunes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const requiredFields: { key: keyof typeof emptyProfile; label: string }[] = [
    { key: "taxpayerType", label: "tipo de contribuyente" },
    { key: "billingRut", label: "RUT" },
    { key: "billingLegalName", label: "nombre legal o razón social" },
    { key: "billingBusinessActivity", label: "giro o actividad" },
    { key: "billingAddress", label: "dirección tributaria" },
    { key: "billingRegion", label: "región" },
    { key: "billingCommune", label: "comuna" },
    { key: "billingEmail", label: "correo de facturación" },
  ];
  const missingFields = requiredFields.filter(({ key }) => !profile[key]?.trim());
  const isComplete = missingFields.length === 0;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const [billingProfile, loadedRegions] = await Promise.all([
          api.getVendorBillingProfile(vendorId),
          api.getShippingRegions(),
        ]);
        const nextProfile = { ...emptyProfile, ...billingProfile };
        setProfile(nextProfile);
        const regionList = Array.isArray(loadedRegions) ? loadedRegions : [];
        setRegions(regionList);
        const selectedRegion = regionList.find((region: any) => region.name === nextProfile.billingRegion);
        if (selectedRegion) {
          const loadedCommunes = await api.getCommunesByRegion(Number(selectedRegion.id));
          setCommunes(Array.isArray(loadedCommunes) ? loadedCommunes : []);
        }
      } catch (error: any) {
        setMessage({ type: "error", text: error.message || "No se pudieron cargar los datos de facturación" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [vendorId]);

  const updateField = (field: keyof typeof emptyProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handleRegionChange = async (regionName: string) => {
    updateField("billingRegion", regionName);
    updateField("billingCommune", "");
    const selectedRegion = regions.find((region: any) => region.name === regionName);
    if (!selectedRegion) {
      setCommunes([]);
      return;
    }
    const loadedCommunes = await api.getCommunesByRegion(Number(selectedRegion.id));
    setCommunes(Array.isArray(loadedCommunes) ? loadedCommunes : []);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const saved = await api.updateVendorBillingProfile(vendorId, profile);
      setProfile({ ...emptyProfile, ...saved });
      setMessage({ type: "success", text: saved.isComplete ? "Datos guardados. La tienda está lista para facturar." : "Datos guardados. Aún faltan antecedentes para facturar." });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "No se pudieron guardar los datos" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card><CardContent className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-sky-600" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Datos de facturación</CardTitle>
            <CardDescription className="mt-1">Información privada utilizada para preparar la facturación mensual de comisiones.</CardDescription>
          </div>
          <Badge className={isComplete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
            {isComplete ? "Listo para facturar" : "Datos incompletos"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSave} className="space-y-6">
          {!isComplete && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Completa los datos pendientes: {missingFields.map((field) => field.label).join(", ")}.
            </div>
          )}
          {message && (
            <div className={`rounded-md border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {message.text}
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="taxpayerType">Tipo de contribuyente *</Label>
              <select id="taxpayerType" value={profile.taxpayerType} onChange={(e) => updateField("taxpayerType", e.target.value)} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="natural">Persona natural</option>
                <option value="company">Empresa</option>
              </select>
            </div>
            <div>
              <Label htmlFor="billingRut">RUT *</Label>
              <Input id="billingRut" value={profile.billingRut} onChange={(e) => updateField("billingRut", e.target.value.toUpperCase())} placeholder="12.345.678-9" className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="billingLegalName">{profile.taxpayerType === "company" ? "Razón social" : "Nombre legal"} *</Label>
              <Input id="billingLegalName" value={profile.billingLegalName} onChange={(e) => updateField("billingLegalName", e.target.value)} className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="billingBusinessActivity">Giro o actividad *</Label>
              <Input id="billingBusinessActivity" value={profile.billingBusinessActivity} onChange={(e) => updateField("billingBusinessActivity", e.target.value)} placeholder="Venta de música y productos relacionados" className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="billingAddress">Dirección tributaria *</Label>
              <Input id="billingAddress" value={profile.billingAddress} onChange={(e) => updateField("billingAddress", e.target.value)} placeholder="Calle, número y oficina o departamento" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="billingRegion">Región *</Label>
              <select id="billingRegion" value={profile.billingRegion} onChange={(e) => handleRegionChange(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">Seleccionar región</option>
                {profile.billingRegion && !regions.some((region: any) => region.name === profile.billingRegion) && <option value={profile.billingRegion}>{profile.billingRegion}</option>}
                {regions.map((region: any) => <option key={region.id} value={region.name}>{region.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="billingCommune">Comuna *</Label>
              <select id="billingCommune" value={profile.billingCommune} onChange={(e) => updateField("billingCommune", e.target.value)} disabled={!profile.billingRegion} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm disabled:bg-gray-100">
                <option value="">Seleccionar comuna</option>
                {profile.billingCommune && !communes.some((commune: any) => commune.name === profile.billingCommune) && <option value={profile.billingCommune}>{profile.billingCommune}</option>}
                {communes.map((commune: any) => <option key={commune.id} value={commune.name}>{commune.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="billingEmail">Correo de facturación *</Label>
              <Input id="billingEmail" type="email" value={profile.billingEmail} onChange={(e) => updateField("billingEmail", e.target.value)} placeholder="facturacion@tienda.cl" className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end border-t pt-5">
            <Button type="submit" disabled={saving} className="bg-sky-600 text-white hover:bg-sky-700">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando</> : "Guardar datos de facturación"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
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
      // Enviar discogsApiKey también como discogsToken para la importación
      const settingsToSave = {
        ...settings,
        discogsToken: settings.discogsApiKey, // El token para importación
      };
      await api.updateVendorSettings(vendorId, settingsToSave);
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

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setSettings({
        spotifyEnabled: data.spotifyEnabled || false,
        spotifyClientId: data.spotifyClientId || "",
        spotifyClientSecret: data.spotifyClientSecret || "",
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
        <CardTitle>Integración con Spotify</CardTitle>
        <CardDescription>
          Muestra reproductores de Spotify en las páginas de tus productos automáticamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-medium">Spotify Client ID *</label>
            <input
              type="text"
              required
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={settings.spotifyClientId}
              onChange={(e) => setSettings({ ...settings, spotifyClientId: e.target.value })}
              placeholder="Tu Client ID de Spotify"
            />
            <p className="text-xs text-gray-500 mt-1">
              Obtén tus credenciales en{" "}
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Spotify for Developers
              </a>
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Spotify Client Secret *</label>
            <input
              type="password"
              required
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={settings.spotifyClientSecret}
              onChange={(e) => setSettings({ ...settings, spotifyClientSecret: e.target.value })}
              placeholder="Tu Client Secret de Spotify"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Habilitar Reproductor Spotify</h3>
              <p className="text-sm text-gray-500 mt-1">
                Activa la búsqueda automática y el reproductor de Spotify en tus productos
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.spotifyEnabled}
                onChange={(e) => setSettings({ ...settings, spotifyEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {settings.spotifyEnabled && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Cómo funciona:</h4>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li>Durante la importación de productos, el sistema buscará automáticamente el álbum en Spotify</li>
                <li>Al crear un producto manualmente, haz clic en "Buscar en Spotify"</li>
                <li>El sistema buscará usando el artista y álbum</li>
                <li>El reproductor se mostrará automáticamente en la página del producto</li>
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

function WooCommerceSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const webhookUrl = `${API_URL}/woocommerce/webhook/${vendorId}`;
  const [pluginCode, setPluginCode] = useState("");
  const [pluginCodeExpiresAt, setPluginCodeExpiresAt] = useState("");
  const [generatingPluginCode, setGeneratingPluginCode] = useState(false);
  
  const [credentials, setCredentials] = useState({
    storeUrl: "",
    consumerKey: "",
    consumerSecret: "",
  });

  // Auto-sync settings
  const [autoSync, setAutoSync] = useState(false);
  const [savingSync, setSavingSync] = useState(false);

  // Import panel state
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedWooIds, setImportedWooIds] = useState<Set<string>>(new Set());
  const [hideImported, setHideImported] = useState(false);
  const [wooCurrentPage, setWooCurrentPage] = useState(1);
  const [wooTotalPages, setWooTotalPages] = useState(1);
  const [wooTotal, setWooTotal] = useState(0);
  const [wooPerPage, setWooPerPage] = useState(50);

  // Configuration modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [mundoBeatCategories, setMundoBeatCategories] = useState<any[]>([]);
  const [spotifyEnabled, setSpotifyEnabled] = useState(false);
  const [productConfigs, setProductConfigs] = useState<Map<number, {
    condition: 'new' | 'used';
    mediaGrade?: string;
    sleeveGrade?: string;
    categoryIds?: string[];
    enableSpotify?: boolean;
  }>>(new Map());

  // Bulk configuration state
  const [showIndividualConfig, setShowIndividualConfig] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({
    condition: 'new' as 'new' | 'used',
    mediaGrade: '',
    sleeveGrade: '',
    categoryIds: [] as string[],
    enableSpotify: false,
  });

  // Import result state
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: number;
    details: {
      imported: { woocommerceId: number; name: string; success: boolean }[];
      errors: { productId: number; error: string }[];
    };
  } | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);

  useEffect(() => {
    loadCredentials();
    loadMundoBeatCategories();
    checkSpotifyEnabled();
  }, [vendorId]);

  const loadMundoBeatCategories = async () => {
    try {
      // Cargar solo las categorías activas del vendor actual
      const response = await fetch(
        `${API_URL}/vendors/${vendorId}/categories`,
        {
          headers: {
            Authorization: `Bearer ${api.getToken()}`,
          },
        }
      );
      const data = await response.json();
      // Las categorías del vendor ya están filtradas por activas
      setMundoBeatCategories(data);
    } catch (error) {
      console.error("Error loading vendor categories:", error);
    }
  };

  const checkSpotifyEnabled = async () => {
    try {
      const response = await fetch(
        `${API_URL}/vendors/${vendorId}/settings`,
        {
          headers: {
            Authorization: `Bearer ${api.getToken()}`,
          },
        }
      );
      const settings = await response.json();
      setSpotifyEnabled(settings.spotifyEnabled || false);
    } catch (error) {
      console.error("Error checking Spotify:", error);
    }
  };

  const loadCredentials = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setCredentials({
        storeUrl: data.wooStoreUrl || "",
        consumerKey: data.wooClientKey || "",
        consumerSecret: data.wooClientSecret || "",
      });
      
      setAutoSync(data.wooAutoSync || false);

      if (data.wooStoreUrl && data.wooClientKey) {
        testConnectionSilent();
      }
    } catch (error) {
      console.error("Error loading credentials:", error);
    }
  };

  const testConnectionSilent = async () => {
    try {
      const response = await fetch(
        `${API_URL}/woocommerce/test-connection/${vendorId}`,
        {
          headers: {
            Authorization: `Bearer ${api.getToken()}`,
          },
        }
      );
      const result = await response.json();
      setConnectionStatus(result.success ? 'connected' : 'error');
    } catch (error) {
      setConnectionStatus('error');
    }
  };

  const generatePluginCode = async () => {
    setGeneratingPluginCode(true);
    try {
      const response = await fetch(`${API_URL}/woocommerce/plugin-code/${vendorId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "No fue posible generar el código");
      setPluginCode(result.code);
      setPluginCodeExpiresAt(result.expiresAt);
    } catch (error: any) {
      alert(error.message || "No fue posible generar el código de conexión");
    } finally {
      setGeneratingPluginCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sanitize URL
      let sanitizedUrl = credentials.storeUrl.trim();
      
      // Fix common URL issues
      if (sanitizedUrl.startsWith('https//')) {
        sanitizedUrl = sanitizedUrl.replace('https//', 'https://');
      }
      if (sanitizedUrl.startsWith('http//')) {
        sanitizedUrl = sanitizedUrl.replace('http//', 'http://');
      }
      
      // Add https:// if missing protocol
      if (!sanitizedUrl.startsWith('http://') && !sanitizedUrl.startsWith('https://')) {
        sanitizedUrl = 'https://' + sanitizedUrl;
      }
      
      // Remove trailing slash
      sanitizedUrl = sanitizedUrl.replace(/\/$/, '');

      await api.updateVendorSettings(vendorId, {
        wooStoreUrl: sanitizedUrl,
        wooClientKey: credentials.consumerKey.trim(),
        wooClientSecret: credentials.consumerSecret.trim(),
      });
      
      // Update local state with sanitized URL
      setCredentials({
        ...credentials,
        storeUrl: sanitizedUrl,
      });
      
      alert("Credenciales guardadas exitosamente");
      loadCredentials();
    } catch (error: any) {
      alert(error.message || "Error al guardar credenciales");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch(
        `${API_URL}/woocommerce/test-connection/${vendorId}`,
        {
          headers: {
            Authorization: `Bearer ${api.getToken()}`,
          },
        }
      );
      const result = await response.json();
      
      if (result.success) {
        alert("✅ Conexión exitosa con WooCommerce");
        setConnectionStatus('connected');
      } else {
        alert(`❌ Error: ${result.message}`);
        setConnectionStatus('error');
      }
    } catch (error) {
      alert("Error al probar conexión");
      setConnectionStatus('error');
      console.error(error);
    } finally {
      setTesting(false);
    }
  };

  const handleAutoSyncChange = async (enabled: boolean) => {
    setSavingSync(true);
    try {
      await api.updateVendorSettings(vendorId, {
        wooAutoSync: enabled,
      });
      setAutoSync(enabled);
      alert(enabled 
        ? "✅ Sincronización automática activada" 
        : "⏸️ Sincronización automática desactivada");
    } catch (error: any) {
      alert(error.message || "Error al actualizar configuración");
      console.error(error);
    } finally {
      setSavingSync(false);
    }
  };

  const importProducts = async () => {
    if (connectionStatus !== 'connected') {
      alert("Primero prueba la conexión antes de importar");
      return;
    }

    setShowImportPanel(true);
    loadCategories();
    loadProducts();
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(
        `${API_URL}/woocommerce/categories/${vendorId}`,
        {
          headers: {
            Authorization: `Bearer ${api.getToken()}`,
          },
        }
      );
      const data = await response.json();
      setCategories(data.categories || data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadProducts = async (category: string = selectedCategory, page: number = 1, perPage: number = wooPerPage) => {
    setLoadingProducts(true);
    try {
      const url = new URL(`${API_URL}/woocommerce/products/${vendorId}`);
      if (category) {
        url.searchParams.append('category', category);
      }
      url.searchParams.append('page', page.toString());
      url.searchParams.append('perPage', perPage.toString());
      
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${api.getToken()}`,
        },
      });
      const data = await response.json();
      setProducts(data.products || []);
      setImportedWooIds(new Set((data.importedWooIds || []).map(String)));
      setWooCurrentPage(data.currentPage || 1);
      setWooTotalPages(data.totalPages || 1);
      setWooTotal(data.total || 0);
    } catch (error) {
      console.error("Error loading products:", error);
      alert("Error al cargar productos");
    } finally {
      setLoadingProducts(false);
    }
  };

  const toggleProductSelection = (productId: number) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const toggleSelectAll = () => {
    const available = products.filter(p => !importedWooIds.has(p.id.toString()));
    if (selectedProducts.size === available.length && available.length > 0) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(available.map(p => p.id)));
    }
  };

  const importSelectedProducts = async () => {
    if (selectedProducts.size === 0) {
      alert("Selecciona al menos un producto para importar");
      return;
    }

    // Reset bulk config to defaults before showing modal
    setBulkConfig({
      condition: 'new',
      mediaGrade: '',
      sleeveGrade: '',
      categoryIds: [],
      enableSpotify: false,
    });

    setShowConfigModal(true);
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const productsToImport = Array.from(selectedProducts).map(productId => ({
        productId,
        condition: bulkConfig.condition,
        mediaGrade: bulkConfig.condition === 'used' ? (bulkConfig.mediaGrade || undefined) : undefined,
        sleeveGrade: bulkConfig.condition === 'used' ? (bulkConfig.sleeveGrade || undefined) : undefined,
        categoryIds: [],
        enableSpotify: false,
      }));

      const response = await fetch(
        `${API_URL}/woocommerce/import-selected/${vendorId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${api.getToken()}`,
          },
          body: JSON.stringify({
            products: productsToImport,
          }),
        }
      );
      const result = await response.json();
      
      // Store the result for detailed display
      setImportResult(result);
      setShowImportResult(true);
      
      setShowConfigModal(false);
      setShowImportPanel(false);
      setSelectedProducts(new Set());
      setProductConfigs(new Map());
    } catch (error) {
      alert("Error al importar productos");
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const updateProductConfig = (productId: number, updates: Partial<typeof productConfigs extends Map<number, infer T> ? T : never>) => {
    const newConfigs = new Map(productConfigs);
    const current = newConfigs.get(productId) || {
      condition: 'new' as const,
      categoryIds: [],
      enableSpotify: false,
    };
    newConfigs.set(productId, { ...current, ...updates });
    setProductConfigs(newConfigs);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Integración WooCommerce</CardTitle>
              <CardDescription>
                Conecta tu tienda WooCommerce para sincronizar productos y stock
              </CardDescription>
            </div>
            {connectionStatus === 'connected' && (
              <Badge className="bg-green-500">Conectado</Badge>
            )}
            {connectionStatus === 'error' && (
              <Badge variant="destructive">Error</Badge>
            )}
            {connectionStatus === 'unknown' && (
              <Badge variant="secondary">No configurado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <p className="font-medium">La conexión se configura desde el plugin de WordPress.</p>
            <p className="mt-1 text-muted-foreground">El plugin crea automáticamente la API REST y los webhooks.</p>
            <a href="/plugin-woocommerce" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-medium text-blue-600 hover:underline">
              Descargar o actualizar el plugin
            </a>
          </div>
          <div className="space-y-2">
            <Label>ID de tienda</Label>
            <div className="flex gap-2">
              <Input value={vendorId} readOnly className="font-mono" />
              <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(vendorId)}>Copiar</Button>
            </div>
          </div>
          {pluginCode && (
            <div className="space-y-2">
              <Label>Código temporal de conexión</Label>
              <div className="flex gap-2">
                <Input value={pluginCode} readOnly className="font-mono" />
                <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(pluginCode)}>Copiar</Button>
              </div>
              <p className="text-xs text-muted-foreground">Válido hasta {new Date(pluginCodeExpiresAt).toLocaleString("es-CL")}. Pégalo en WooCommerce → MundoBeat.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={generatePluginCode} disabled={generatingPluginCode}>
              {generatingPluginCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {connectionStatus === "connected" ? "Generar código para reparar" : "Generar código de conexión"}
            </Button>
            {connectionStatus === "connected" && (
              <Button type="button" variant="outline" onClick={testConnection} disabled={testing}>
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Probar conexión
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {connectionStatus === 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Sincronización</CardTitle>
            <CardDescription>
              Configura cómo MundoBeat se sincroniza con WooCommerce
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Auto-sync Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="auto-sync" className="text-base font-semibold">
                  Sincronización Automática
                </Label>
                <p className="text-sm text-muted-foreground">
                  Los productos se sincronizarán automáticamente a WooCommerce al crearlos o actualizarlos
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="auto-sync"
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => handleAutoSyncChange(e.target.checked)}
                  disabled={savingSync}
                  className="w-5 h-5 cursor-pointer"
                />
                {savingSync && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>

            {/* Category Mapping Button */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="space-y-1">
                <h4 className="text-base font-semibold">Mapeo de Categorías</h4>
                <p className="text-sm text-muted-foreground">
                  Configura cómo las categorías de MundoBeat se mapean a las de WooCommerce
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = '/dashboard/woocommerce/categories';
                }}
              >
                🗂️ Configurar Mapeo de Categorías
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sincronización de Productos</CardTitle>
          <CardDescription>
            Importa productos desde WooCommerce a MundoBeat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La sincronización de stock se realiza automáticamente cuando se vende un producto en MundoBeat.
              El stock en WooCommerce se actualizará en tiempo real.
            </p>
            <Button
              onClick={importProducts}
              disabled={loading || connectionStatus !== 'connected'}
              variant="outline"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ver Productos Disponibles
            </Button>

            {showImportPanel && (
              <div className="mt-6 space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Productos de WooCommerce</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowImportPanel(false)}
                  >
                    ✕ Cerrar
                  </Button>
                </div>

                {/* Category Filter + Per-Page Selector */}
                <div className="flex flex-wrap gap-2 items-center">
                  <Label htmlFor="category-filter">Filtrar por categoría:</Label>
                  <select
                    id="category-filter"
                    className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-md"
                    value={selectedCategory}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setSelectedCategory(cat);
                      loadProducts(cat, 1, wooPerPage);
                    }}
                  >
                    <option value="">Todas las categorías</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.count})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <Label htmlFor="per-page-select" className="whitespace-nowrap text-sm">Por página:</Label>
                    <select
                      id="per-page-select"
                      className="px-2 py-2 border border-gray-300 rounded-md text-sm"
                      value={wooPerPage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setWooPerPage(val);
                        loadProducts(selectedCategory, 1, val);
                      }}
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                      <option value={0}>Todos</option>
                    </select>
                  </div>
                </div>

                {/* Products Table */}
                {(() => {
                  const displayProducts = hideImported
                    ? products.filter(p => !importedWooIds.has(p.id.toString()))
                    : products;
                  const availableForImport = products.filter(p => !importedWooIds.has(p.id.toString()));
                  return loadingProducts ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : products.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No se encontraron productos
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedProducts.size === availableForImport.length && availableForImport.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-medium">
                            Seleccionar todos ({availableForImport.length})
                          </span>
                        </div>
                        {importedWooIds.size > 0 && (
                          <button
                            onClick={() => setHideImported(h => !h)}
                            className="text-xs px-2 py-1 rounded-full border border-gray-300 hover:bg-gray-100 text-gray-600"
                          >
                            {hideImported ? `👁️ Mostrar todos (${products.length})` : `🙈 Ocultar importados (${importedWooIds.size})`}
                          </button>
                        )}
                      </div>

                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {displayProducts.map((product) => {
                          const alreadyImported = importedWooIds.has(product.id.toString());
                          return (
                          <div
                            key={product.id}
                            className={`flex items-center gap-4 p-3 border rounded-lg ${
                              alreadyImported ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={!alreadyImported && selectedProducts.has(product.id)}
                              onChange={() => !alreadyImported && toggleProductSelection(product.id)}
                              disabled={alreadyImported}
                              className="w-4 h-4 disabled:cursor-not-allowed"
                            />
                            
                            {product.images?.[0]?.src && (
                              <img
                                src={product.images[0].src}
                                alt={product.name}
                                className="w-16 h-16 object-cover rounded"
                              />
                            )}
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{product.name}</h4>
                                {alreadyImported && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ Ya importado</span>
                                )}
                              </div>
                              <div className="flex gap-4 text-sm text-muted-foreground">
                                <span>Precio: ${Math.round(Number(product.price) || 0).toLocaleString('es-CL')}</span>
                                <span>Stock: {product.stock_quantity || 0}</span>
                                <span>SKU: {product.sku || 'N/A'}</span>
                              </div>
                            </div>

                            {product.categories?.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {product.categories.map((cat: any) => cat.name).join(', ')}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pagination controls — hidden when perPage=0 (all) */}
                    {wooPerPage !== 0 && wooTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-1 pt-2">
                        <button
                          onClick={() => loadProducts(selectedCategory, 1, wooPerPage)}
                          disabled={wooCurrentPage === 1}
                          className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
                          title="Primera página"
                        >«</button>
                        <button
                          onClick={() => loadProducts(selectedCategory, wooCurrentPage - 1, wooPerPage)}
                          disabled={wooCurrentPage === 1}
                          className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
                        >‹</button>
                        {/* Page number pills */}
                        {Array.from({ length: wooTotalPages }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === wooTotalPages || Math.abs(p - wooCurrentPage) <= 2)
                          .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                            if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                            acc.push(p);
                            return acc;
                          }, [])
                          .map((item, idx) =>
                            item === '...' ? (
                              <span key={`ellipsis-${idx}`} className="px-1 text-sm text-gray-400">…</span>
                            ) : (
                              <button
                                key={item}
                                onClick={() => loadProducts(selectedCategory, item as number, wooPerPage)}
                                className={`px-3 py-1 text-sm border rounded hover:bg-gray-100 ${
                                  item === wooCurrentPage ? 'bg-blue-600 text-white border-blue-600 font-semibold' : ''
                                }`}
                              >{item}</button>
                            )
                          )}
                        <button
                          onClick={() => loadProducts(selectedCategory, wooCurrentPage + 1, wooPerPage)}
                          disabled={wooCurrentPage === wooTotalPages}
                          className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
                        >›</button>
                        <button
                          onClick={() => loadProducts(selectedCategory, wooTotalPages, wooPerPage)}
                          disabled={wooCurrentPage === wooTotalPages}
                          className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
                          title="Última página"
                        >»</button>
                        <span className="text-xs text-muted-foreground ml-2">
                          Pág. {wooCurrentPage}/{wooTotalPages} · {wooTotal} productos
                        </span>
                      </div>
                    )}
                    {wooPerPage === 0 && (
                      <p className="text-xs text-center text-muted-foreground pt-1">
                        Mostrando todos los {wooTotal} productos
                      </p>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t">
                      <span className="text-sm text-muted-foreground">
                        {selectedProducts.size} productos seleccionados
                      </span>
                      <Button
                        onClick={importSelectedProducts}
                        disabled={importing || selectedProducts.size === 0}
                      >
                        {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Importar Seleccionados ({selectedProducts.size})
                      </Button>
                    </div>
                  </>
                );
                })()}
              </div>
            )}

            {/* Configuration Modal */}
            {showConfigModal && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                  {/* Header */}
                  <div className="flex items-center justify-between p-5 border-b">
                    <div>
                      <h3 className="text-lg font-semibold">Condición de los productos</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Se aplicará a los <strong>{selectedProducts.size}</strong> producto{selectedProducts.size !== 1 ? 's' : ''} seleccionado{selectedProducts.size !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowConfigModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </Button>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-5">
                    {/* Condición */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Condición *</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setBulkConfig({ ...bulkConfig, condition: 'new', mediaGrade: '', sleeveGrade: '' })}
                          className={`flex flex-col items-center gap-1 p-4 rounded-lg border-2 transition-all ${
                            bulkConfig.condition === 'new'
                              ? 'border-purple-500 bg-purple-50 text-purple-700'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          <span className="text-2xl">🆕</span>
                          <span className="text-sm font-semibold">Nuevo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkConfig({ ...bulkConfig, condition: 'used' })}
                          className={`flex flex-col items-center gap-1 p-4 rounded-lg border-2 transition-all ${
                            bulkConfig.condition === 'used'
                              ? 'border-amber-500 bg-amber-50 text-amber-700'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          <span className="text-2xl">💿</span>
                          <span className="text-sm font-semibold">Usado</span>
                        </button>
                      </div>
                    </div>

                    {/* Escala Goldmine - solo si es usado */}
                    {bulkConfig.condition === 'used' && (
                      <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Escala Goldmine</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="bulk-media" className="text-sm">
                              Medio <span className="text-muted-foreground">(vinilo, cd, etc)</span>
                            </Label>
                            <select
                              id="bulk-media"
                              value={bulkConfig.mediaGrade}
                              onChange={(e) => setBulkConfig({ ...bulkConfig, mediaGrade: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Seleccionar --</option>
                              <option value="M">M — Mint</option>
                              <option value="NM">NM — Near Mint</option>
                              <option value="VG+">VG+ — Very Good Plus</option>
                              <option value="VG">VG — Very Good</option>
                              <option value="G+">G+ — Good Plus</option>
                              <option value="G">G — Good</option>
                              <option value="P">P — Poor</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="bulk-sleeve" className="text-sm">
                              Portada <span className="text-muted-foreground">(funda)</span>
                            </Label>
                            <select
                              id="bulk-sleeve"
                              value={bulkConfig.sleeveGrade}
                              onChange={(e) => setBulkConfig({ ...bulkConfig, sleeveGrade: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="">-- Seleccionar --</option>
                              <option value="M">M — Mint</option>
                              <option value="NM">NM — Near Mint</option>
                              <option value="VG+">VG+ — Very Good Plus</option>
                              <option value="VG">VG — Very Good</option>
                              <option value="G+">G+ — Good Plus</option>
                              <option value="G">G — Good</option>
                              <option value="P">P — Poor</option>
                            </select>
                          </div>
                        </div>
                        {(!bulkConfig.mediaGrade || !bulkConfig.sleeveGrade) && (
                          <p className="text-xs text-amber-700 font-medium">
                            ⚠️ Debes seleccionar ambas escalas Goldmine (Medio y Portada) para productos usados
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
                    <Button
                      variant="outline"
                      onClick={() => setShowConfigModal(false)}
                      disabled={importing}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={confirmImport}
                      disabled={importing || (bulkConfig.condition === 'used' && (!bulkConfig.mediaGrade || !bulkConfig.sleeveGrade))}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {importing
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</>
                        : <>✅ Importar {selectedProducts.size} producto{selectedProducts.size !== 1 ? 's' : ''}</>
                      }
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Import Result Modal */}
            {showImportResult && importResult && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between p-5 border-b">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {importResult.errors > 0 ? '⚠️ Resultado de Importación' : '✅ Importación Completada'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {importResult.imported} producto{importResult.imported !== 1 ? 's' : ''} importado{importResult.imported !== 1 ? 's' : ''} correctamente
                        {importResult.errors > 0 && `, ${importResult.errors} con errores`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowImportResult(false);
                        setImportResult(null);
                        loadProducts();
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </Button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Success Summary */}
                    {importResult.imported > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-2">
                          ✅ Productos Importados ({importResult.imported})
                        </h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {importResult.details.imported.map((item, idx) => (
                            <div key={idx} className="text-sm text-green-700 flex items-start gap-2">
                              <span className="text-green-500 mt-0.5">•</span>
                              <span className="flex-1">
                                <strong>{item.name}</strong>
                                <span className="text-green-600 ml-2">(WooCommerce ID: {item.woocommerceId})</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error Summary */}
                    {importResult.errors > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="font-semibold text-red-900 mb-2">
                          ❌ Errores de Importación ({importResult.errors})
                        </h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {importResult.details.errors.map((error, idx) => {
                            const productInfo = products.find(p => p.id === error.productId);
                            return (
                              <div key={idx} className="bg-white border border-red-300 rounded p-3">
                                <div className="flex items-start gap-2">
                                  <span className="text-red-500 text-lg mt-0.5">⚠️</span>
                                  <div className="flex-1">
                                    <p className="font-medium text-red-900">
                                      {productInfo?.name || `Producto ID: ${error.productId}`}
                                    </p>
                                    {productInfo && (
                                      <p className="text-xs text-gray-600 mt-0.5">
                                        WooCommerce ID: {error.productId}
                                        {productInfo.sku && ` • SKU: ${productInfo.sku}`}
                                      </p>
                                    )}
                                    <p className="text-sm text-red-700 mt-1.5 bg-red-100 rounded px-2 py-1">
                                      <strong>Error:</strong> {error.error}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end gap-3 p-5 border-t bg-gray-50">
                    <Button
                      onClick={() => {
                        setShowImportResult(false);
                        setImportResult(null);
                        loadProducts();
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Cerrar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
function LogoSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState("");

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      const data = await api.getVendorSettings(vendorId);
      setLogo(data.headerConfig?.logo || data.logo || "");
    } catch (error) {
      console.error("Error loading logo:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Cargar config actual primero
      const currentSettings = await api.getVendorSettings(vendorId);
      const headerConfig = currentSettings.headerConfig || {};
      
      // Actualizar solo el logo
      await api.updateVendorSettings(vendorId, { 
        headerConfig: { ...headerConfig, logo } 
      });
      alert("Logo guardado correctamente");
    } catch (error: any) {
      console.error("Error saving logo:", error);
      alert(error.message || "Error al guardar el logo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold mb-6">Logo de la Tienda</h2>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
            <h3 className="font-semibold text-lg mb-2">📷 Configuración del Logo</h3>
            <p className="text-sm text-gray-600 mb-4">
              El logo aparecerá en el header de tu tienda. Se recomienda usar imágenes PNG con fondo transparente.
            </p>
            
            {/* Preview del logo */}
            {logo && (
              <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-2 font-medium">Vista previa:</p>
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded">
                  <img 
                    src={logo} 
                    alt="Logo preview" 
                    className="h-16 object-contain"
                  />
                </div>
              </div>
            )}

            {/* Botón para cargar archivo */}
            <div className="flex gap-2 mb-4">
              <input
                type="file"
                accept="image/*"
                id="logo-upload"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  try {
                    const formData = new FormData();
                    formData.append("files", file);

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
                      throw new Error('Error al subir el logo');
                    }

                    const data = await response.json();
                    const logoUrl = data.urls[0];

                    setLogo(logoUrl);
                    alert('Logo subido exitosamente');
                  } catch (error) {
                    console.error('Error:', error);
                    alert('Error al subir el logo');
                  }
                }}
              />
              <label 
                htmlFor="logo-upload"
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer text-center font-medium transition-colors flex items-center justify-center gap-2"
              >
                📤 Subir Logo
              </label>
              
              {logo && (
                <button
                  type="button"
                  onClick={() => setLogo('')}
                  className="px-4 py-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors font-medium"
                >
                  🗑️ Eliminar
                </button>
              )}
            </div>

            {/* Input manual de URL (opcional) */}
            <details className="mt-3">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 font-medium">
                O ingresar URL manualmente
              </summary>
              <input
                type="text"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="https://ejemplo.com/logo.png"
              />
            </details>

            {/* Recomendaciones */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-800 mb-1">💡 Recomendaciones:</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Formato recomendado: PNG con fondo transparente</li>
                <li>Tamaño sugerido: 200-400px de ancho</li>
                <li>Peso máximo: 2MB</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 font-medium"
            >
              {loading ? "Guardando..." : "💾 Guardar Logo"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

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

          {/* Nota sobre logo */}
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-800">
              📷 <strong>Logo:</strong> Para configurar el logo de tu tienda, 
              ve a <span className="font-semibold">Diseño → Logo</span>
            </p>
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
    loadVendorInfo();
  }, [vendorId]);

  useEffect(() => {
    if (initialSliderAppliedRef.current) return;
    if (!initialSliderId) {
      initialSliderAppliedRef.current = true;
      return;
    }
    if (!slides.length) return;

    const found = slides.find((s) => Number(s.id) === Number(initialSliderId));
    if (found) {
      setSelectedSlideId(found.id);
      setViewMode("edit");
    }
    initialSliderAppliedRef.current = true;
  }, [initialSliderId, slides]);

  const loadVendorInfo = async () => {
    try {
      const vendor = await api.getMyVendor();
      if (vendor && vendor.slug) {
        setVendorSlug(vendor.slug);
      }
    } catch (error) {
      console.error("Error loading vendor info:", error);
    }
  };

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
            scrollEffect: slide.scrollEffect || "normal",
          };
        }
        // Si es estructura antigua (sin items), convertir a nuevo formato
        return {
          id: slide.id || Date.now(),
          name: slide.name || "Carrusel de portada",
          showInHomepage: slide.showInHomepage || false,
          position: slide.position || "top",
          scrollEffect: slide.scrollEffect || "normal",
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
      const response = await fetch(`http://localhost:3001/products?search=${encodeURIComponent(query)}&isActive=true&limit=10`, {
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
        const response = await fetch(`http://localhost:3001/api/products?search=${encodeURIComponent(query)}&isActive=true&limit=10`, {
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
      scrollEffect: "normal",
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

      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">Efecto al desplazar la página</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Efecto al desplazar la página">
          {[
            { value: "normal", label: "Normal", description: "Se desplaza junto con la página." },
            { value: "fixed-overlay", label: "Fijo con superposición", description: "El contenido siguiente sube sobre el carrusel." },
            { value: "fixed-zoom", label: "Fijo con zoom", description: "Añade un aumento sutil durante el desplazamiento." },
          ].map((option) => {
            const selected = (slider.scrollEffect || "normal") === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onUpdate({ scrollEffect: option.value })}
                aria-pressed={selected}
                className={`min-h-[88px] rounded-md border px-3 py-3 text-left transition-colors ${
                  selected
                    ? "border-sky-500 bg-sky-50 text-sky-950 ring-1 ring-sky-500"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-4 text-gray-500">{option.description}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">Los efectos fijos se aplican al carrusel superior en pantallas de escritorio. En móviles se usa el desplazamiento normal.</p>
      </div>

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
                        {gradients.map((grad: any) => (
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

function PromotionsSection({ vendorId, initialMode = "overview", initialSliderId }: { vendorId: string; initialMode?: "overview" | "carousels" | "banners"; initialSliderId?: number | null }) {
  const [mode, setMode] = useState(initialMode);
  const [selectedCarouselId, setSelectedCarouselId] = useState<number | null>(initialSliderId || null);
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
      const [vendorCategoriesData, genresData, settingsData] = await Promise.all([
        api.getVendorCategories(vendorId),
        api.getGenres(),
        api.getVendorSettings(vendorId),
      ]);
      
      // Filtrar solo categorías activas del vendor
      const activeCategories = vendorCategoriesData.filter((cat: any) => cat.isActive);
      setCategories(activeCategories);
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
    showIcons: boolean; // Toggle global para mostrar iconos
  }>({
    enabled: true,
    leftFields: ['format', 'label', 'year'],
    rightFields: ['goldmine'],
    showIcons: true // Por defecto mostrar iconos
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
          showIcons: response.productInfoBar.showIcons ?? true, // Por defecto true si no está definido
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

  useEffect(() => {
    loadCategories();
  }, [vendorId]);

  const loadCategories = async () => {
    try {
      // Cargar categorías globales del marketplace
      const allCats = await api.getAvailableVendorCategories(vendorId);
      setGlobalCategories(allCats);
      
      // Cargar categorías activas del vendor
      const vendorCats = await api.getVendorCategories(vendorId);
      setVendorCategories(vendorCats);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const isCategoryEnabled = (categoryId: string) => {
    return vendorCategories.some(cat => cat.id === categoryId && !cat.parentId && !cat.parent);
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

  const rootCategories = globalCategories.filter(cat => !cat.parentId && !cat.parent);
  const activeRootCount = vendorCategories.filter(cat => !cat.parentId && !cat.parent).length;
  const filteredCategories = rootCategories
    .filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorías de Productos</CardTitle>
        <CardDescription>
          Activa las categorías principales que utilizarás. Sus subcategorías estarán disponibles automáticamente.
        </CardDescription>
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
                <strong>{activeRootCount}</strong> categorías principales activas de <strong>{rootCategories.length}</strong> disponibles
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
              console.log('🎨 Category icon:', category.name, category.icon);
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
                    {category.icon && (category.icon.startsWith('/icons/') || category.icon.startsWith('http') || category.icon.includes('digitaloceanspaces.com')) ? (
                      <img src={getImageUrl(category.icon)} alt="icon" className="w-8 h-8 object-contain" />
                    ) : (
                      <span>{category.icon || "📦"}</span>
                    )}
                  </div>

                  {/* Nombre y descripción */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900">{category.name}</h4>
                    {category.description && (
                      <p className="text-xs text-gray-500 truncate">{category.description}</p>
                    )}
                    {category.format && (
                      <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1">
                        {category.format}
                      </span>
                    )}
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEnabled && (
                      <span className="text-xs font-medium text-purple-700">Activa</span>
                    )}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isEnabled}
                        onChange={(e) => handleToggleCategory(category.id, e.target.checked)}
                        disabled={loading}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-disabled:opacity-50"></div>
                    </label>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Las subcategorías no requieren configuración: se habilitan junto con su categoría principal.
          </p>
        </div>
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

        // Asegurar que lateral tenga la estructura completa con valores por defecto
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
      await api.updateVendorSettings(vendorId, buildSettingsPayload(menus));
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

        {/* Botones de acción */}
        <div className="flex items-center gap-3 pt-4 border-t">
          {getCurrentMenuItems().length > 0 && (
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
                      condition: undefined,
                      customUrl: ""
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="category">Enlace a Categoría</option>
                    <option value="genre">Enlace a Género</option>
                    <option value="page">Enlace a Página</option>
                    <option value="condition">Enlace a Condición</option>
                    <option value="custom">Enlace Personalizado</option>
                  </select>
                </div>

                {editingItem?.linkType === "category" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Categoría *</label>
                    <select
                      value={editingItem?.categoryId || ""}
                      onChange={(e) => {
                        const selectedCat = categories.find(c => c.id === e.target.value);
                        setEditingItem({ 
                          ...editingItem, 
                          categoryId: e.target.value,
                          categorySlug: selectedCat?.slug || e.target.value
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

                {editingItem?.linkType === "condition" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Condición *</label>
                    <select
                      value={editingItem?.condition || ""}
                      onChange={(e) => setEditingItem({ 
                        ...editingItem, 
                        condition: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Selecciona una condición</option>
                      <option value="new">Nuevo</option>
                      <option value="used">Usado</option>
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

function ImagenesSection({ vendorId }: { vendorId: string }) {
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
      alert('✅ Configuración de imágenes guardada exitosamente');
    } catch (error) {
      console.error('Error saving image settings:', error);
      alert('❌ Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Imágenes</CardTitle>
        <CardDescription>
          Configura cómo se muestran las imágenes de productos en tu tienda
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
                Perfecto para mostrar vistas alternativas del producto.
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
            {(() => {
              const currentTheme = (colorThemes.find((t: any) => t.id === selectedTheme) as any) || {};
              return (
                <>
                  <div 
                    className="h-32 rounded-lg shadow-lg flex items-center justify-center"
                    style={{ 
                      background: currentTheme.preview || '#667eea'
                    }}
                  >
                    <span className="text-white text-xl font-bold">
                      {currentTheme.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div 
                        className="h-16 rounded-lg shadow mb-2"
                        style={{ backgroundColor: currentTheme.primary }}
                      ></div>
                      <span className="text-xs text-gray-600">Principal</span>
                    </div>
                    <div className="text-center">
                      <div 
                        className="h-16 rounded-lg shadow mb-2"
                        style={{ backgroundColor: currentTheme.secondary }}
                      ></div>
                      <span className="text-xs text-gray-600">Secundario</span>
                    </div>
                    <div className="text-center">
                      <div 
                        className="h-16 rounded-lg shadow mb-2"
                        style={{ backgroundColor: currentTheme.accent }}
                      ></div>
                      <span className="text-xs text-gray-600">Acento</span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Selector de temas */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Temas Disponibles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {colorThemes.map((theme: any) => (
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
              <p className="text-xs text-gray-500 mt-1">Formato: ícono de categoría | País: bandera | Artista: micrófono | Título: disco</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.showIcons}
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
// GRID CATEGORY DISPLAY CONFIGURATION MODAL
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
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-gradient-to-r from-green-500 to-emerald-500"
            onClick={async () => {
              if (onApply) await onApply();
              onClose();
            }}
          >
            ✓ Guardar
          </Button>
        </CardFooter>
      </Card>
    </div>,
    document.body
  );
}

// ========================================
// SHIPPING METHODS SECTION
// ========================================

function ShippingMethodsSection({ vendorId }: { vendorId: string }) {
  const [shippingPolicy, setShippingPolicy] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getVendorSettings(vendorId, false).then((s: any) => {
      if (s?.shippingPolicy) setShippingPolicy(s.shippingPolicy);
    });
  }, [vendorId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateVendorSettings(vendorId, { shippingPolicy });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <FreeShippingConfigSection vendorId={vendorId} />
      <EnviaOriginConfigSection vendorId={vendorId} />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Configuración de Envíos
          </CardTitle>
          <CardDescription>
            Gestiona los métodos de envío de tu tienda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">📦 Envia.com</h3>
              <p className="text-green-800 text-sm">
                Envia.com está habilitado y funcionando como proveedor principal de envíos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Texto de Envíos y devoluciones
          </CardTitle>
          <CardDescription>
            Este texto se muestra en la pestaña "Envíos y devoluciones" en la página de cada producto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={shippingPolicy}
            onChange={(e) => setShippingPolicy(e.target.value)}
            placeholder="Ej: Despachamos en 1-3 días hábiles. Devoluciones aceptadas dentro de los 15 días de recibido el producto..."
            rows={8}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

function EnviaOriginConfigSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<any[]>([]);
  const [communes, setCommunes] = useState<any[]>([]);
  const [availableCarriers, setAvailableCarriers] = useState<any[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);

  const [originName, setOriginName] = useState("");
  const [originPhone, setOriginPhone] = useState("");
  const [originStreet, setOriginStreet] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [originState, setOriginState] = useState("");
  const [originPostalCode, setOriginPostalCode] = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [communeId, setCommuneId] = useState<number | null>(null);

  useEffect(() => {
    const loadEnviaOrigin = async () => {
      try {
        setLoading(true);

        const [enviaConfig, shippingRegions, myVendor, carriers] = await Promise.all([
          api.getEnviaVendorConfig(vendorId),
          api.getShippingRegions(),
          api.getMyVendor(),
          api.getEnviaCarriers(),
        ]);

        const configOrigin = enviaConfig?.origin;

        setOriginName(configOrigin?.name || myVendor?.storeName || "");
        setOriginPhone(configOrigin?.phone || myVendor?.phone || "");
        setOriginStreet(configOrigin?.street || "");
        setOriginCity(configOrigin?.city || "");
        setOriginState(configOrigin?.state || "");
        setOriginPostalCode(configOrigin?.postalCode || "");

        const normalizedRegions = Array.isArray(shippingRegions) ? shippingRegions : [];
        setRegions(normalizedRegions);

        const normalizedCarriers = Array.isArray(carriers) ? carriers : [];
        setAvailableCarriers(normalizedCarriers);
        const savedCarriers = Array.isArray(enviaConfig?.enabledCarriers) ? enviaConfig.enabledCarriers : [];
        setSelectedCarriers(savedCarriers.length > 0 ? savedCarriers : normalizedCarriers.map((c: any) => c.code));

        if (configOrigin?.regionId) {
          setRegionId(configOrigin.regionId);
          const loadedCommunes = await api.getCommunesByRegion(configOrigin.regionId);
          const normalizedCommunes = Array.isArray(loadedCommunes) ? loadedCommunes : [];
          setCommunes(normalizedCommunes);
          if (configOrigin?.communeId) {
            setCommuneId(configOrigin.communeId);
          }
        }
      } catch (error) {
        console.error('Error loading Envia origin config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEnviaOrigin();
  }, [vendorId]);

  const handleRegionChange = async (value: string) => {
    const nextRegionId = value ? Number(value) : null;
    setRegionId(nextRegionId);
    setCommuneId(null);
    setOriginCity("");
    setOriginPostalCode("");

    const selectedRegion = regions.find((region) => region.id === nextRegionId);
    setOriginState(selectedRegion?.code || "");

    if (!nextRegionId) {
      setCommunes([]);
      return;
    }

    try {
      const loadedCommunes = await api.getCommunesByRegion(nextRegionId);
      setCommunes(Array.isArray(loadedCommunes) ? loadedCommunes : []);
    } catch {
      setCommunes([]);
    }
  };

  const handleCommuneChange = (value: string) => {
    const nextCommuneId = value ? Number(value) : null;
    setCommuneId(nextCommuneId);

    const selectedCommune = communes.find((commune) => commune.id === nextCommuneId);
    setOriginCity(selectedCommune?.name || "");
    setOriginPostalCode(selectedCommune?.enviaPostalCode || "");
  };

  const handleSave = async () => {
    if (!regionId || !communeId) {
      alert('Selecciona región y comuna para definir la ciudad de origen.');
      return;
    }

    if (!selectedCarriers.length) {
      alert('Selecciona al menos un courier para continuar.');
      return;
    }

    try {
      setSaving(true);
      await api.updateEnviaVendorConfig(vendorId, {
        enabled: true,
        enabledCarriers: selectedCarriers,
        origin: {
          name: originName,
          phone: originPhone,
          street: originStreet,
          city: originCity,
          state: originState,
          country: 'CL',
          postalCode: originPostalCode,
          regionId,
          communeId,
        } as any,
      });

      alert('✅ Ciudad de origen Envia.com guardada correctamente');
    } catch (error: any) {
      console.error('Error saving Envia origin config:', error);
      alert(error.message || 'No se pudo guardar la ciudad de origen');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Origen de Envíos (Envia.com)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Cargando configuración de origen...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Origen de Envíos (Envia.com)
        </CardTitle>
        <CardDescription>
          Define la ciudad de origen de tus envíos para cotizaciones y etiquetas de Envia.com.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="envia-origin-name">Nombre remitente</Label>
            <Input
              id="envia-origin-name"
              value={originName}
              onChange={(e) => setOriginName(e.target.value)}
              placeholder="Nombre de quien despacha"
            />
          </div>
          <div>
            <Label htmlFor="envia-origin-phone">Teléfono remitente</Label>
            <Input
              id="envia-origin-phone"
              value={originPhone}
              onChange={(e) => setOriginPhone(e.target.value)}
              placeholder="+56 9 xxxx xxxx"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="envia-origin-street">Dirección de origen</Label>
          <Input
            id="envia-origin-street"
            value={originStreet}
            onChange={(e) => setOriginStreet(e.target.value)}
            placeholder="Calle y número"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="envia-origin-region">Región</Label>
            <select
              id="envia-origin-region"
              className="w-full h-10 px-3 border border-input rounded-md bg-background"
              value={regionId || ''}
              onChange={(e) => handleRegionChange(e.target.value)}
            >
              <option value="">Seleccionar región...</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="envia-origin-commune">Comuna (Ciudad de origen)</Label>
            <select
              id="envia-origin-commune"
              className="w-full h-10 px-3 border border-input rounded-md bg-background"
              value={communeId || ''}
              onChange={(e) => handleCommuneChange(e.target.value)}
              disabled={!regionId}
            >
              <option value="">Seleccionar comuna...</option>
              {communes.map((commune) => (
                <option key={commune.id} value={commune.id}>
                  {commune.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="envia-origin-city">Ciudad asignada</Label>
            <Input id="envia-origin-city" value={originCity} readOnly />
          </div>
          <div>
            <Label htmlFor="envia-origin-postal-code">Código postal Envia</Label>
            <Input id="envia-origin-postal-code" value={originPostalCode} readOnly />
          </div>
        </div>

        <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
          <div>
            <Label className="text-base font-semibold">Couriers habilitados para tu tienda</Label>
            <p className="text-xs text-gray-500 mt-1">
              Selecciona con qué couriers quieres trabajar en tu checkout.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableCarriers.map((carrier) => {
              const checked = selectedCarriers.includes(carrier.code);
              return (
                <label
                  key={carrier.code}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCarriers((prev) => [...prev, carrier.code]);
                      } else {
                        setSelectedCarriers((prev) => prev.filter((code) => code !== carrier.code));
                      }
                    }}
                  />
                  <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                    {carrier.logo ? (
                      <img src={carrier.logo} alt={carrier.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <Truck className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{carrier.name}</p>
                    <p className="text-xs text-gray-500">{carrier.code}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar ciudad de origen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================
// FREE SHIPPING CONFIGURATION
// ========================================

function FreeShippingConfigSection({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(0);
  const [halfPriceShippingEnabled, setHalfPriceShippingEnabled] = useState(false);
  const [halfPriceShippingThreshold, setHalfPriceShippingThreshold] = useState(0);

  useEffect(() => {
    loadShippingSettings();
  }, [vendorId]);

  const loadShippingSettings = async () => {
    try {
      setLoading(true);
      const response = await api.getMyVendorSettings();
      
      if (response.shippingSettings) {
        setFreeShippingEnabled(response.shippingSettings.freeShippingEnabled || false);
        setFreeShippingThreshold(response.shippingSettings.freeShippingThreshold || 0);
        setHalfPriceShippingEnabled(response.shippingSettings.halfPriceShippingEnabled || false);
        setHalfPriceShippingThreshold(response.shippingSettings.halfPriceShippingThreshold || 0);
      }
    } catch (error: any) {
      console.error('Error loading shipping settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Obtener configuración actual completa
      const currentSettings = await api.getMyVendorSettings();
      
      // Actualizar solo shippingSettings
      await api.updateMyVendorSettings({
        shippingSettings: {
          freeShippingEnabled,
          freeShippingThreshold,
          halfPriceShippingEnabled,
          halfPriceShippingThreshold,
        },
      });
      
      alert('✅ Configuración de envío guardada correctamente');
    } catch (error: any) {
      console.error('Error saving shipping settings:', error);
      alert(`❌ Error: ${error.message || 'No se pudo guardar la configuración'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Envío Gratis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Envío Gratis
        </CardTitle>
        <CardDescription>
          Configura el envío gratis por monto mínimo de compra
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="freeShippingEnabled" className="text-base font-medium">
                Habilitar Envío Gratis
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                Ofrece envío gratis cuando el pedido supera un monto mínimo
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="freeShippingEnabled"
                checked={freeShippingEnabled}
                onChange={(e) => setFreeShippingEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {freeShippingEnabled && (
            <div>
              <Label htmlFor="freeShippingThreshold">
                Monto Mínimo para Envío Gratis (100% descuento)
              </Label>
              <Input
                id="freeShippingThreshold"
                type="number"
                min="0"
                value={freeShippingThreshold}
                onChange={(e) => setFreeShippingThreshold(parseInt(e.target.value) || 0)}
                placeholder="Ej: 50000"
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Los clientes obtendrán envío gratis en compras superiores a ${freeShippingThreshold.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CLP
              </p>
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="halfPriceShippingEnabled" className="text-base font-medium">
                  Habilitar Descuento 50% en Envío
                </Label>
                <p className="text-sm text-gray-500 mt-1">
                  Ofrece 50% de descuento en el envío cuando el pedido supera un monto mínimo
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="halfPriceShippingEnabled"
                  checked={halfPriceShippingEnabled}
                  onChange={(e) => setHalfPriceShippingEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {halfPriceShippingEnabled && (
              <div className="mt-4">
                <Label htmlFor="halfPriceShippingThreshold">
                  Monto Mínimo para 50% Descuento
                </Label>
                <Input
                  id="halfPriceShippingThreshold"
                  type="number"
                  min="0"
                  value={halfPriceShippingThreshold}
                  onChange={(e) => setHalfPriceShippingThreshold(parseInt(e.target.value) || 0)}
                  placeholder="Ej: 30000"
                  className="mt-2"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Los clientes obtendrán 50% de descuento en el envío en compras superiores a ${halfPriceShippingThreshold.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} CLP
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </CardFooter>
    </Card>
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
