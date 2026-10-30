"use client";
import AssistedCommissionFields from "@/components/admin/AssistedCommissionFields";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

type Tab = "general" | "envia" | "comisiones";

type Region = { id: number; name: string; code: string };
type Commune = { id: number; name: string; enviaPostalCode?: string };

export default function ConfigurarVendedorPage() {
  const params = useParams<{ vendorId: string }>();
  const router = useRouter();
  const vendorId = params.vendorId;

  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [vendorName, setVendorName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [publishInMarketplace, setPublishInMarketplace] = useState(true);

  const [originName, setOriginName] = useState("");
  const [originPhone, setOriginPhone] = useState("");
  const [originStreet, setOriginStreet] = useState("");
  const [originState, setOriginState] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [originPostalCode, setOriginPostalCode] = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [communeId, setCommuneId] = useState<number | null>(null);

  const [commissionPercentage, setCommissionPercentage] = useState(10);
  const [wholesaleCommissionPercentage, setWholesaleCommissionPercentage] = useState(5);
  const [assistedCommissionPercentage, setAssistedCommissionPercentage] = useState(10);
  const [assistedCommissionType, setAssistedCommissionType] = useState('percentage');
  const [assistedCommissionFixedAmount, setAssistedCommissionFixedAmount] = useState(0);
  const [isWholesaleEnabledByAdmin, setIsWholesaleEnabledByAdmin] = useState(true);

  const [regions, setRegions] = useState<Region[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);

  const tabs = useMemo(
    () => [
      { id: "general" as const, label: "General" },
      { id: "envia" as const, label: "Envia" },
      { id: "comisiones" as const, label: "Comisiones" },
    ],
    [],
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const [vendor, settings, envConfig, loadedRegions] = await Promise.all([
          api.getVendor(vendorId),
          api.getVendorSettings(vendorId, true),
          api.getEnviaVendorConfig(vendorId),
          api.getShippingRegions(),
        ]);

        setVendorName(vendor.storeName || "");
        setSlug(vendor.slug || "");
        setEmail(vendor.email || "");
        setIsActive(Boolean(vendor.isActive));
        setPublishInMarketplace(settings.publishInMarketplace !== false);

        setCommissionPercentage(Number(settings?.commissionPercentage ?? 10));
        setWholesaleCommissionPercentage(Number(settings?.wholesaleCommissionPercentage ?? 5));
        setAssistedCommissionPercentage(Number(settings?.assistedCommissionPercentage ?? 10));
        setAssistedCommissionType(settings?.assistedCommissionType ?? 'percentage');
        setAssistedCommissionFixedAmount(Number(settings?.assistedCommissionFixedAmount ?? 0));
        setIsWholesaleEnabledByAdmin(Boolean(settings?.isWholesaleEnabledByAdmin ?? true));

        setOriginName(envConfig?.origin?.name || "");
        setOriginPhone(envConfig?.origin?.phone || "");
        setOriginStreet(envConfig?.origin?.street || "");
        setOriginState(envConfig?.origin?.state || "");
        setOriginCity(envConfig?.origin?.city || "");
        setOriginPostalCode(envConfig?.origin?.postalCode || "");

        const regionsData = Array.isArray(loadedRegions) ? loadedRegions : [];
        setRegions(regionsData);

        if (envConfig?.origin?.regionId) {
          setRegionId(envConfig.origin.regionId);
          const communesData = await api.getCommunesByRegion(envConfig.origin.regionId);
          const normalized = Array.isArray(communesData) ? communesData : [];
          setCommunes(normalized);

          if (envConfig?.origin?.communeId) {
            setCommuneId(envConfig.origin.communeId);
          }
        }
      } catch (error: any) {
        alert(error.message || "No se pudo cargar la configuración del vendedor");
      } finally {
        setLoading(false);
      }
    };

    if (vendorId) {
      load();
    }
  }, [vendorId]);

  const handleRegionChange = async (value: string) => {
    const nextRegionId = value ? Number(value) : null;
    setRegionId(nextRegionId);
    setCommuneId(null);
    setOriginCity("");
    setOriginPostalCode("");

    const selectedRegion = regions.find((item) => item.id === nextRegionId);
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

    const selectedCommune = communes.find((item) => item.id === nextCommuneId);
    setOriginCity(selectedCommune?.name || "");
    setOriginPostalCode(selectedCommune?.enviaPostalCode || "");
  };

  const saveGeneral = async () => {
    try {
      setSaving(true);
      await api.updateVendor(vendorId, {
        storeName: vendorName,
        slug,
        email,
        isActive,
      });

      await api.updateVendorSettings(vendorId, { publishInMarketplace }, true);
      alert("Configuración general actualizada");
    } catch (error: any) {
      alert(error.message || "No se pudo guardar la configuración general");
    } finally {
      setSaving(false);
    }
  };

  const saveEnvia = async () => {
    if (!regionId || !communeId) {
      alert("Selecciona región y comuna.");
      return;
    }

    try {
      setSaving(true);
      await api.updateEnviaVendorConfig(vendorId, {
        enabled: true,
        origin: {
          name: originName,
          phone: originPhone,
          street: originStreet,
          city: originCity,
          state: originState,
          country: "CL",
          postalCode: originPostalCode,
          regionId,
          communeId,
        } as any,
      });
      alert("Configuración Envia actualizada");
    } catch (error: any) {
      alert(error.message || "No se pudo guardar Envia");
    } finally {
      setSaving(false);
    }
  };

  const saveCommissions = async () => {
    try {
      setSaving(true);
      await api.updateVendorSettings(vendorId, {
        commissionPercentage: Number(commissionPercentage),
        wholesaleCommissionPercentage: Number(wholesaleCommissionPercentage),
        assistedCommissionPercentage: Number(assistedCommissionPercentage),
        assistedCommissionType,
        assistedCommissionFixedAmount,
        isWholesaleEnabledByAdmin,
      }, true);
      alert("Comisiones actualizadas");
    } catch (error: any) {
      alert(error.message || "No se pudieron guardar las comisiones");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-10 text-sm text-gray-500">Cargando configuración...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configurar vendedor</h1>
          <p className="text-gray-600 mt-1">Edición en página completa de tienda, Envia y comisiones.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/panel/vendedores/listar")}>Volver al listado</Button>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Button key={tab.id} variant={activeTab === tab.id ? "default" : "outline"} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "general" && (
        <Card>
          <CardHeader>
            <CardTitle>Configuración general</CardTitle>
            <CardDescription>Datos base de la tienda y visibilidad en marketplace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nombre tienda</Label>
              <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="mr-2" />Tienda activa</label>
              <label className="text-sm"><input type="checkbox" checked={publishInMarketplace} onChange={(e) => setPublishInMarketplace(e.target.checked)} className="mr-2" />Publicar en marketplace</label>
            </div>
            <Button onClick={saveGeneral} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "envia" && (
        <Card>
          <CardHeader>
            <CardTitle>Configuración Envia</CardTitle>
            <CardDescription>Dirección de origen de despacho del vendedor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nombre de origen</Label>
              <Input value={originName} onChange={(e) => setOriginName(e.target.value)} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={originPhone} onChange={(e) => setOriginPhone(e.target.value)} />
            </div>
            <div>
              <Label>Calle y número</Label>
              <Input value={originStreet} onChange={(e) => setOriginStreet(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Región</Label>
                <select className="w-full h-10 px-3 border rounded-md" value={regionId || ""} onChange={(e) => handleRegionChange(e.target.value)}>
                  <option value="">Seleccionar región...</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>{region.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Comuna</Label>
                <select className="w-full h-10 px-3 border rounded-md" value={communeId || ""} onChange={(e) => handleCommuneChange(e.target.value)} disabled={!regionId}>
                  <option value="">Seleccionar comuna...</option>
                  {communes.map((commune) => (
                    <option key={commune.id} value={commune.id}>{commune.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Código postal</Label>
              <Input value={originPostalCode} readOnly className="bg-gray-50" />
            </div>
            <Button onClick={saveEnvia} disabled={saving}>{saving ? "Guardando..." : "Guardar Envia"}</Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "comisiones" && (
        <Card>
          <CardHeader>
            <CardTitle>Comisiones</CardTitle>
            <CardDescription>Porcentajes de comisión por tipo de venta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Comisión normal (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" value={commissionPercentage} onChange={(e) => setCommissionPercentage(Number(e.target.value))} />
            </div>
            <div>
              <Label>Comisión mayorista (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" value={wholesaleCommissionPercentage} onChange={(e) => setWholesaleCommissionPercentage(Number(e.target.value))} />
            </div>
            <div>
              <AssistedCommissionFields value={{ assistedCommissionType, assistedCommissionPercentage, assistedCommissionFixedAmount }} onChange={values => { setAssistedCommissionType(values.assistedCommissionType); setAssistedCommissionPercentage(values.assistedCommissionPercentage); setAssistedCommissionFixedAmount(values.assistedCommissionFixedAmount); }} />
              <p className="mt-1 text-xs text-gray-500">Se cobra junto con el envío cuando la tienda registra una venta recibida por transferencia.</p>
            </div>
            <label className="text-sm"><input type="checkbox" checked={isWholesaleEnabledByAdmin} onChange={(e) => setIsWholesaleEnabledByAdmin(e.target.checked)} className="mr-2" />Habilitar mayorista para este vendedor</label>
            <Button onClick={saveCommissions} disabled={saving}>{saving ? "Guardando..." : "Guardar comisiones"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
