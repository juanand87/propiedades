"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Store, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { applyThemeToDocument } from "@/lib/colorThemes";

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

export default function SolicitudVendedorPage() {
  const [formData, setFormData] = useState({
    nombreTienda: "",
    nombreContacto: "",
    email: "",
    telefono: "",
    tipoProductos: "",
    experiencia: "",
    redesSociales: "",
    motivacion: "",
    paginaWeb: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    loadMarketplaceSettings();
  }, []);

  const loadMarketplaceSettings = async () => {
    try {
      console.log('🚀 SOLICITUD PAGE: Loading marketplace settings...');
      
      // Cargar configuración del marketplace
      const marketplaceSettings = await api.getVendorSettings(MARKETPLACE_VENDOR_ID, false);
      setSettings(marketplaceSettings);

      console.log('📊 Marketplace settings loaded:', marketplaceSettings);
      console.log('🎨 colorTheme:', marketplaceSettings?.colorTheme);
      console.log('🎨 customColors:', marketplaceSettings?.customColors);

      // Aplicar tema de colores - SIEMPRE aplicar, incluso si no hay colorTheme explícito
      const themeToApply = marketplaceSettings?.colorTheme || 'default';
      applyThemeToDocument(themeToApply, marketplaceSettings?.customColors);
      console.log('✅ Applied theme:', themeToApply);
    } catch (error) {
      console.error("❌ Error loading marketplace settings:", error);
      // Incluso con error, aplicar tema por defecto
      applyThemeToDocument('default');
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simular envío (aquí implementarás la integración con el backend)
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1500);
  };

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen theme-gradient-bg flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Solicitud enviada con éxito!
            </h2>
            <p className="text-gray-600 mb-6">
              Hemos recibido tu solicitud para vender en {settings?.storeName || "Mundobeat.cl"}. Nuestro equipo la revisará y
              te contactaremos en los próximos días a tu correo electrónico.
            </p>
            <Button asChild className="w-full theme-bg">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al inicio
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-gradient-bg py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-8">
          <Link href="/" className="theme-text hover:opacity-80 flex items-center gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Store className="w-10 h-10 theme-text" />
            <h1 className="text-4xl font-bold text-gray-900">
              Vende en {settings?.storeName || "Mundobeat.cl"}
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            Únete a nuestra comunidad de vendedores y alcanza miles de coleccionistas y amantes de la música
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Solicitud de Registro como Vendedor</CardTitle>
            <CardDescription>
              Complete el siguiente formulario y nos pondremos en contacto contigo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Información de la Tienda */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Información de tu Tienda</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="nombreTienda">
                    Nombre de la tienda <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nombreTienda"
                    name="nombreTienda"
                    placeholder="Ej: CD Manía, Vinilo Store"
                    value={formData.nombreTienda}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipoProductos">
                    ¿Qué tipo de productos vendes? <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="tipoProductos"
                    name="tipoProductos"
                    placeholder="Ej: Vinilos, CDs, Cassettes, DVDs, Blu-ray"
                    value={formData.tipoProductos}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experiencia">
                    Experiencia en el rubro <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="experiencia"
                    name="experiencia"
                    placeholder="Cuéntanos sobre tu experiencia vendiendo música física..."
                    rows={4}
                    value={formData.experiencia}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Información de Contacto */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Información de Contacto</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="nombreContacto">
                    Nombre completo <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nombreContacto"
                    name="nombreContacto"
                    placeholder="Tu nombre completo"
                    value={formData.nombreContacto}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Correo electrónico <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefono">
                      Teléfono <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      placeholder="+56 9 1234 5678"
                      value={formData.telefono}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Información Adicional */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Información Adicional</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="paginaWeb">
                    Página web o tienda online (si tienes)
                  </Label>
                  <Input
                    id="paginaWeb"
                    name="paginaWeb"
                    type="url"
                    placeholder="https://tutienda.com"
                    value={formData.paginaWeb}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="redesSociales">
                    Redes sociales
                  </Label>
                  <Input
                    id="redesSociales"
                    name="redesSociales"
                    placeholder="Instagram, Facebook, etc."
                    value={formData.redesSociales}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="motivacion">
                    ¿Por qué quieres vender en Mundobeat.cl? <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="motivacion"
                    name="motivacion"
                    placeholder="Cuéntanos qué te motiva a unirte a nuestra plataforma..."
                    rows={4}
                    value={formData.motivacion}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Beneficios */}
              <div className="theme-gradient-bg/30 border border-purple-200 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Beneficios de vender en {settings?.storeName || "Mundobeat.cl"}
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Acceso a miles de coleccionistas y amantes de la música</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Panel de administración completo para gestionar tus productos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Integración con métodos de pago y envíos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Tu propia tienda personalizable con tu marca</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Soporte dedicado para vendedores</span>
                  </li>
                </ul>
              </div>

              <Button type="submit" className="w-full theme-bg text-white" size="lg" disabled={loading}>
                {loading ? "Enviando..." : "Enviar Solicitud"}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                Al enviar esta solicitud, aceptas nuestros términos y condiciones para vendedores
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
