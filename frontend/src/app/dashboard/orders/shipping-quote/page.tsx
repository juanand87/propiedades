"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, Loader2, Package, Truck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function ShippingQuotePage() {
  const [vendorId, setVendorId] = useState("");
  const [regions, setRegions] = useState<any[]>([]);
  const [communes, setCommunes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [regionId, setRegionId] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [declaredValue, setDeclaredValue] = useState("10000");
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getProfile(), api.getRegions(), api.getCategories()])
      .then(([profile, regionData, categoryData]) => {
        setVendorId(profile.vendorId || profile.vendor?.id || "");
        setRegions(regionData || []);
        setCategories((categoryData || []).filter((category: any) => category.isActive !== false));
      })
      .catch((err) => setError(err.message || "No se pudo cargar la herramienta"))
      .finally(() => setLoading(false));
  }, []);

  const changeRegion = async (value: string) => {
    setRegionId(value);
    setCommuneId("");
    setQuotes([]);
    setCommunes(value ? await api.getCommunesByRegion(Number(value)) : []);
  };

  const calculate = async () => {
    const category = categories.find((item) => item.id === categoryId);
    const count = Math.max(1, Number(quantity) || 1);
    if (!vendorId || !communeId || !category) return setError("Selecciona comuna, categoría y cantidad");
    setQuoting(true);
    setError("");
    setQuotes([]);
    try {
      const result = await api.calculateShipping({
        vendorId,
        communeId: Number(communeId),
        weight: Math.max(0.1, Number(category.weight || 0.5) * count),
        dimensions: {
          length: Number(category.depth || 30),
          width: Number(category.width || 20),
          height: Number(category.height || 10),
        },
        declaredValue: Math.max(0, Number(declaredValue) || 0),
      });
      setQuotes(Array.isArray(result) ? result : result.options || []);
    } catch (err: any) {
      setError(err.message || "No fue posible cotizar el envío");
    } finally {
      setQuoting(false);
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start gap-3"><Button asChild variant="outline" size="icon"><Link href="/dashboard/orders"><ArrowLeft className="h-4 w-4" /></Link></Button><div><h1 className="text-2xl font-bold">Cotizar envío por categoría</h1><p className="text-sm text-slate-600">Calcula el envío sin crear un pedido ni descontar stock.</p></div></div>
      {error && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Calculator className="h-5 w-5" /> Datos de la cotización</CardTitle></CardHeader><CardContent className="space-y-4">
          <Field label="Región"><select className="h-10 w-full border bg-white px-3" value={regionId} onChange={(event) => changeRegion(event.target.value)}><option value="">Seleccionar región</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></Field>
          <Field label="Comuna"><select disabled={!regionId} className="h-10 w-full border bg-white px-3 disabled:bg-slate-100" value={communeId} onChange={(event) => { setCommuneId(event.target.value); setQuotes([]); }}><option value="">Seleccionar comuna</option>{communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.name}</option>)}</select></Field>
          <Field label="Categoría"><select className="h-10 w-full border bg-white px-3" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setQuotes([]); }}><option value="">Seleccionar categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Cantidad"><Input type="number" min="1" max="100" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field><Field label="Valor declarado"><Input type="number" min="0" step="1000" value={declaredValue} onChange={(event) => setDeclaredValue(event.target.value)} /></Field></div>
          <Button className="w-full" size="lg" onClick={calculate} disabled={quoting}>{quoting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />} Cotizar envío</Button>
        </CardContent></Card>
        <section className="border bg-white"><div className="border-b px-5 py-4"><h2 className="font-bold">Opciones disponibles</h2></div>{quotes.length ? <div className="divide-y">{quotes.map((quote, index) => <div key={`${quote.method || quote.carrier}-${index}`} className="flex items-center justify-between gap-4 px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center bg-sky-50 text-sky-700"><Package className="h-5 w-5" /></span><div><p className="font-semibold">{quote.method || `${quote.carrier} - ${quote.serviceDescription || quote.service}`}</p><p className="text-sm text-slate-500">{quote.estimatedDays ? `${quote.estimatedDays} día(s) estimados` : "Plazo informado por el transportista"}</p></div></div><strong className="text-xl">{money.format(Number(quote.price ?? quote.totalPrice))}</strong></div>)}</div> : <div className="grid min-h-[360px] place-items-center px-8 text-center text-sm text-slate-500"><div><Truck className="mx-auto mb-3 h-10 w-10 text-slate-300" /><p>Selecciona destino, categoría y cantidad para consultar las tarifas disponibles.</p></div></div>}</section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
