"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { applyThemeToDocument } from "@/lib/colorThemes";
import HeaderType2 from "@/components/headers/HeaderType2";
import { getImageUrl } from "@/lib/utils";

const FORMATS = [
  "Vinilos",
  "CDs",
  "Cassettes",
  "Blu-ray",
  "Ropa y coleccionables",
  "Equipos de Audio",
  "Videojuegos",
  "Accesorios y Cuidado",
  "Otros",
];
const BANKS = [
  "Banco Estado",
  "Banco de Chile",
  "BancoFalabella",
  "Santander",
  "Scotiabank",
  "Itaú",
  "BICE",
  "Banco Security",
  "Mercado Pago",
  "Otro",
];
type Region = { id: number; name: string; code: string };
type Commune = { id: number; name: string; code?: string; enviaPostalCode?: string };
const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

type Step = 1 | 2 | 3;

export default function RegistroVendedorPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [marketplaceVendor, setMarketplaceVendor] = useState<any>({
    id: MARKETPLACE_VENDOR_ID,
    slug: "marketplace",
    storeName: "Mundo Beat",
    phone: "",
    email: "",
  });
  const [marketplaceSettings, setMarketplaceSettings] = useState<any>({
    headerType: "type2",
    storeName: "Mundo Beat",
    searchEnabled: true,
    menus: {},
    customMenus: {},
    headerConfig: {
      stickyHeader: true,
    },
  });

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    taxpayerType: "natural",
    legalName: "",
    rut: "",
    storeName: "",
    logoUrl: "",
    city: "",
    cityId: "",
    cityCode: "",
    region: "",
    regionId: "",
    regionCode: "",
    postalCode: "",
    catalogDescription: "",
    estimatedProducts: "",
    bankName: "",
    bankAccountType: "",
    bankAccountNumber: "",
    message: "",
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    const loadRegions = async () => {
      try {
        setLoadingLocations(true);
        const loadedRegions = await api.getShippingRegions();
        setRegions(Array.isArray(loadedRegions) ? loadedRegions : []);
      } catch (err) {
        console.error("Error loading regions:", err);
      } finally {
        setLoadingLocations(false);
      }
    };

    loadRegions();
  }, []);

  useEffect(() => {
    const loadMarketplaceHeaderData = async () => {
      try {
        const [vendor, settings] = await Promise.all([
          api.getVendor(MARKETPLACE_VENDOR_ID),
          api.getVendorSettings(MARKETPLACE_VENDOR_ID, false),
        ]);

        if (vendor) {
          setMarketplaceVendor({
            id: vendor.id || MARKETPLACE_VENDOR_ID,
            slug: "marketplace",
            storeName: vendor.storeName || "Mundo Beat",
            phone: vendor.phone || "",
            email: vendor.email || "",
          });
        }

        if (settings) {
          setMarketplaceSettings(settings);
          console.log('🚀 REGISTRO VENDEDOR: Settings loaded', settings);
          console.log('🎨 colorTheme:', settings?.colorTheme);
          console.log('🎨 customColors:', settings?.customColors);
          
          // Aplicar tema de colores del marketplace
          const themeToApply = settings?.colorTheme || 'default';
          applyThemeToDocument(themeToApply, settings?.customColors);
          console.log('✅ Applied theme:', themeToApply);
        }
      } catch (error) {
        console.error("❌ Error loading marketplace header settings:", error);
        // Aplicar tema por defecto si hay error
        applyThemeToDocument('default');
      }
    };

    loadMarketplaceHeaderData();
  }, []);

  const renderMarketplaceHeader = () => {
    return (
      <HeaderType2
        vendor={marketplaceVendor}
        config={marketplaceSettings}
        slug="marketplace"
      />
    );
  };

  const handleRegionChange = async (regionIdRaw: string) => {
    set("regionId", regionIdRaw);
    set("city", "");
    set("cityId", "");
    set("cityCode", "");
    setCommunes([]);

    const selectedRegion = regions.find((region) => String(region.id) === regionIdRaw);
    set("region", selectedRegion?.name || "");
    set("regionCode", selectedRegion?.code || "");

    if (!regionIdRaw) return;

    try {
      const loadedCommunes = await api.getCommunesByRegion(Number(regionIdRaw));
      setCommunes(Array.isArray(loadedCommunes) ? loadedCommunes : []);
    } catch (err) {
      console.error("Error loading communes:", err);
      setError("No se pudieron cargar las comunas. Intenta nuevamente.");
    }
  };

  const handleCommuneChange = (communeIdRaw: string) => {
    set("cityId", communeIdRaw);
    const selectedCommune = communes.find((commune) => String(commune.id) === communeIdRaw);
    set("city", selectedCommune?.name || "");
    set("cityCode", selectedCommune?.code || "");
    set("postalCode", selectedCommune?.enviaPostalCode || "");
  };

  const handleLogoChange = async (file?: File) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("El logo no puede superar los 3 MB.");
      return;
    }
    try {
      setUploadingLogo(true);
      setError("");
      const uploaded = await api.uploadVendorApplicationLogo(file);
      set("logoUrl", uploaded.url || "");
    } catch (err: any) {
      setError(err?.message || "No se pudo subir el logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const toggleFormat = (f: string) =>
    setSelectedFormats((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      await api.submitVendorApplication({
        ...form,
        cityId: form.cityId ? Number(form.cityId) : null,
        regionId: form.regionId ? Number(form.regionId) : null,
        mainFormats: selectedFormats.join(", "),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Hubo un problema al enviar tu solicitud. Por favor intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100">
        {renderMarketplaceHeader()}
        <div className="flex items-center justify-center px-4 py-10">
          <div className="bg-white rounded-3xl shadow-xl p-10 max-w-lg w-full text-center">
            <div className="text-7xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              ¡Solicitud enviada con éxito!
            </h1>
            <p className="text-gray-500 mb-2">
              Hemos recibido tu solicitud para unirte a Mundo Beat.
            </p>
            <p className="text-gray-500 mb-8">
              Nuestro equipo revisará tu información y te contactará en{" "}
              <strong>1–3 días hábiles</strong> al correo{" "}
              <span className="text-sky-700 font-medium">{form.email}</span>.
            </p>
            <Link
              href="/"
              className="inline-block theme-gradient-bg text-white font-bold px-8 py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-100 py-10 px-4">
      {renderMarketplaceHeader()}
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-sky-700 text-sm hover:underline mb-4 inline-block">
            ← Volver al inicio
          </Link>
          <div className="text-4xl mb-2">🎵</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Registro de Vendedor
          </h1>
          <p className="text-gray-500 text-sm">
            Completa el formulario y nuestro equipo revisará tu solicitud.
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step === s
                    ? "theme-gradient-bg text-white"
                    : step > s
                    ? "bg-sky-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > s ? "✓" : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-0.5 ${
                    step > s ? "bg-sky-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          {/* Step 1: Personal info */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                1. Datos personales
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Información básica de contacto.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre completo *
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Juan Pérez"
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="correo@ejemplo.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="+56 9 1234 5678"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de contribuyente *
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    value={form.taxpayerType}
                    onChange={(e) => set("taxpayerType", e.target.value)}
                  >
                    <option value="natural">Persona natural</option>
                    <option value="company">Empresa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    RUT *
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="12.345.678-9"
                    value={form.rut}
                    onChange={(e) => set("rut", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.taxpayerType === "company" ? "Razón social" : "Nombre legal"} *
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder={form.taxpayerType === "company" ? "Empresa SpA" : "Nombre completo para facturación"}
                    value={form.legalName}
                    onChange={(e) => set("legalName", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">Se utilizará para preparar los documentos de facturación de la tienda.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la tienda *
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Mi Tienda de Vinilos"
                    value={form.storeName}
                    onChange={(e) => set("storeName", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Logo de la tienda *
                  </label>
                  <div className="flex items-center gap-4 rounded-xl border border-dashed border-gray-300 p-4">
                    <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                      {form.logoUrl ? (
                        <img src={getImageUrl(form.logoUrl)} alt="Logo de la tienda" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-gray-400">Sin logo</span>
                      )}
                    </div>
                    <div>
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        {uploadingLogo ? "Subiendo..." : form.logoUrl ? "Cambiar logo" : "Seleccionar logo"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={uploadingLogo}
                          onChange={(event) => handleLogoChange(event.target.files?.[0])}
                        />
                      </label>
                      <p className="mt-2 text-xs text-gray-500">PNG, JPG o WebP. Máximo 3 MB.</p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Región *
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    value={form.regionId}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    disabled={loadingLocations}
                  >
                    <option value="">Seleccionar región...</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comuna *
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    value={form.cityId}
                    onChange={(e) => handleCommuneChange(e.target.value)}
                    disabled={!form.regionId}
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
              <div className="flex justify-end mt-8">
                <button
                  onClick={() => {
                      if (!form.fullName || !form.email || !form.taxpayerType || !form.rut || !form.legalName || !form.storeName || !form.logoUrl || !form.regionId || !form.cityId) {
                      setError("Por favor completa los campos obligatorios (*) antes de continuar.");
                      return;
                    }
                    setError("");
                    setStep(2);
                  }}
                  className="theme-gradient-bg text-white font-bold px-8 py-3 rounded-full hover:opacity-90 transition-opacity"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Catalog info */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                2. Tu catálogo
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Cuéntanos qué tipo de productos quieres vender.
              </p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formatos que venderás *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FORMATS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleFormat(f)}
                        className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                          selectedFormats.includes(f)
                            ? "theme-gradient-bg text-white border-transparent"
                            : "bg-white text-gray-600 border-gray-300 hover:border-sky-500"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción del catálogo
                  </label>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                    placeholder="Ej: Especializado en rock clásico de los 70s y 80s, jazz, soul y funk. Más de 10 años coleccionando..."
                    value={form.catalogDescription}
                    onChange={(e) => set("catalogDescription", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad estimada de productos
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    value={form.estimatedProducts}
                    onChange={(e) => set("estimatedProducts", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <option>Menos de 50</option>
                    <option>50 – 200</option>
                    <option>200 – 500</option>
                    <option>500 – 1.000</option>
                    <option>Más de 1.000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Algo más que quieras contarnos
                  </label>
                  <textarea
                    rows={2}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                    placeholder="Opcional..."
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-between mt-8">
                <button
                  onClick={() => { setError(""); setStep(1); }}
                  className="text-gray-500 font-medium px-6 py-3 rounded-full hover:bg-gray-100 transition-colors"
                >
                  ← Volver
                </button>
                <button
                  onClick={() => {
                    if (selectedFormats.length === 0) {
                      setError("Selecciona al menos un formato o categoría para tu tienda.");
                      return;
                    }
                    setError("");
                    setStep(3);
                  }}
                  className="theme-gradient-bg text-white font-bold px-8 py-3 rounded-full hover:opacity-90 transition-opacity"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Bank info */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                3. Datos bancarios
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Para recibir tus pagos. Esta información está protegida.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Banco
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    value={form.bankName}
                    onChange={(e) => set("bankName", e.target.value)}
                  >
                    <option value="">Seleccionar banco...</option>
                    {BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de cuenta
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    value={form.bankAccountType}
                    onChange={(e) => set("bankAccountType", e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    <option>Cuenta corriente</option>
                    <option>Cuenta vista</option>
                    <option>Cuenta de ahorro</option>
                    <option>Cuenta RUT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de cuenta
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="000-00000-00"
                    value={form.bankAccountNumber}
                    onChange={(e) => set("bankAccountNumber", e.target.value)}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="mt-6 bg-sky-50 border border-sky-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-sky-700 mb-2 uppercase tracking-wide">
                  Resumen de tu solicitud
                </p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Nombre:</span> {form.fullName}</p>
                  <p><span className="font-medium">Email:</span> {form.email}</p>
                  <p><span className="font-medium">Tienda:</span> {form.storeName || "—"}</p>
                  <p><span className="font-medium">Formatos:</span> {selectedFormats.join(", ") || "—"}</p>
                  <p><span className="font-medium">Productos estimados:</span> {form.estimatedProducts || "—"}</p>
                </div>
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => { setError(""); setStep(2); }}
                  className="text-gray-500 font-medium px-6 py-3 rounded-full hover:bg-gray-100 transition-colors"
                >
                  ← Volver
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="theme-gradient-bg text-white font-bold px-8 py-3 rounded-full hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Enviando..." : "Enviar solicitud ✓"}
                </button>
              </div>
            </div>
          )}

          {/* Inline error for step 1 */}
          {error && step !== 3 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Al enviar este formulario aceptas los{" "}
          <Link href="/terminos" className="underline hover:text-sky-700">
            términos y condiciones
          </Link>{" "}
          de Mundo Beat.
        </p>
      </div>
    </div>
  );
}
