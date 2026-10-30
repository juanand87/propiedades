"use client";
import { assistedCommissionLabel } from "@/lib/assisted-commission";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, MessageCircle, Search, ShoppingCart, Trash2, Truck } from "lucide-react";
import { api, API_URL } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const steps = ["Productos", "Comprador", "Envío y pago"];

export default function NewAssistedSalePage() {
  const [step, setStep] = useState(1);
  const [products, setProducts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [communes, setCommunes] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [transferReference, setTransferReference] = useState("");
  const [form, setForm] = useState({ channel: "whatsapp", customerName: "", customerEmail: "", customerPhone: "", customerRut: "", shippingAddress: "", shippingNumber: "", shippingRegionId: "", shippingRegion: "", shippingCommuneId: "", shippingCommune: "", notes: "" });

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/products/vendor/me?status=active&limit=500`, { headers: { Authorization: `Bearer ${api.getToken()}` } }).then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los productos");
        return response.json();
      }),
      api.getRegions(),
    ]).then(([productData, regionData]) => {
      setProducts((productData.products || []).filter((product: any) => Number(product.stock) > 0));
      setRegions(regionData || []);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const cart = useMemo(() => products.filter((product) => Number(selected[product.id]) > 0), [products, selected]);
  const subtotal = cart.reduce((sum, product) => sum + Number(product.price) * Number(selected[product.id]), 0);
  const units = cart.reduce((sum, product) => sum + Number(selected[product.id]), 0);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleProducts = products.filter((product) => !normalizedSearch || [product.title, product.artist, product.album, product.sku, product.barcode].some((value) => String(value || "").toLowerCase().includes(normalizedSearch)));

  const updateQuantity = (product: any, delta: number) => {
    const next = Math.max(0, Math.min(Number(product.stock || 0), Number(selected[product.id] || 0) + delta));
    setSelected((current) => ({ ...current, [product.id]: next }));
  };

  const onRegionChange = async (regionId: string) => {
    const region = regions.find((item) => String(item.id) === regionId);
    setForm((current) => ({ ...current, shippingRegionId: regionId, shippingRegion: region?.name || "", shippingCommuneId: "", shippingCommune: "" }));
    setCommunes(regionId ? await api.getCommunesByRegion(Number(regionId)) : []);
  };

  const createAndQuote = async () => {
    if (!form.customerName || !form.customerEmail || !form.customerPhone || !form.customerRut) return setError("Completa los datos del comprador");
    if (!form.shippingAddress || !form.shippingNumber || !form.shippingRegionId || !form.shippingCommuneId) return setError("Completa la dirección de entrega");
    setWorking(true);
    setError("");
    try {
      const created = await api.createAssistedOrder({ ...form, shippingRegionId: Number(form.shippingRegionId), shippingCommuneId: Number(form.shippingCommuneId), items: cart.map((product) => ({ productId: product.id, quantity: selected[product.id] })) });
      setOrder(created);
      const quoteResponse = await api.getEnviaOrderQuotes(created.id);
      setQuotes(quoteResponse.options || []);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || "No se pudo preparar la venta");
    } finally {
      setWorking(false);
    }
  };

  const chooseQuote = async (quote: any) => {
    setWorking(true);
    setError("");
    try {
      const result = await api.selectEnviaOrderShippingOption(order.id, String(quote.carrier), String(quote.service));
      setSelectedQuote(result.selected);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  const receiveBuyerTransfer = async () => {
    setWorking(true); setError('');
    try { setOrder(await api.receiveAssistedTransfer(order.id, transferReference.trim())); }
    catch (err: any) { setError(err.message); }
    finally { setWorking(false); }
  };

  const payPlatformCharge = async () => {
    if (!order.customerTransferConfirmedAt) return setError('Primero confirma la transferencia recibida');
    setWorking(true);
    setError("");
    try {
      const result = await api.confirmAssistedTransfer(order.id, transferReference.trim());
      window.location.href = result.paymentUrl;
    } catch (err: any) {
      setError(err.message);
      setWorking(false);
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const shipping = Number(selectedQuote?.totalPrice || 0);
  const commission = Number(order?.commissionAmount || 0);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><Button asChild variant="outline" size="icon" aria-label="Volver"><Link href="/dashboard/orders"><ArrowLeft className="h-4 w-4" /></Link></Button><div><h1 className="text-2xl font-bold">Nueva venta asistida</h1><p className="text-sm text-slate-600">Venta recibida por WhatsApp, correo u otro canal.</p></div></div>
        <Button asChild variant="outline"><Link href="/dashboard/orders/shipping-quote"><Truck className="mr-2 h-4 w-4" /> Cotizar por categoría</Link></Button>
      </header>

      <nav className="grid grid-cols-3 border bg-white" aria-label="Progreso">{steps.map((label, index) => { const number = index + 1; const active = step === number; const complete = step > number; return <div key={label} className={`flex items-center justify-center gap-2 border-r px-3 py-3 text-sm font-semibold last:border-r-0 ${active ? "bg-sky-50 text-sky-800" : complete ? "text-emerald-700" : "text-slate-400"}`}><span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${active ? "bg-sky-600 text-white" : complete ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>{complete ? <Check className="h-3.5 w-3.5" /> : number}</span>{label}</div>; })}</nav>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {step === 1 && <div className="grid min-h-[680px] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0"><div className="sticky top-0 z-10 mb-4 bg-slate-50 pb-2"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto, artista, SKU o código de barras..." className="h-11 bg-white pl-9" /></div></div>
          {visibleProducts.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">{visibleProducts.map((product) => { const quantity = Number(selected[product.id] || 0); return <button key={product.id} type="button" onClick={() => updateQuantity(product, 1)} className={`group relative overflow-hidden border bg-white text-left transition ${quantity ? "border-emerald-500 ring-1 ring-emerald-500" : "border-slate-200 hover:border-sky-400"}`}><div className="aspect-square overflow-hidden bg-slate-100"><img src={getImageUrl(product.images?.[0] || product.imagen)} alt={product.title} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" /></div><div className="space-y-1 p-3"><p className="truncate text-sm font-semibold">{product.title}</p><p className="truncate text-xs text-slate-500">{product.artist || product.album || "Producto"}</p><div className="flex items-center justify-between pt-2"><strong>{money.format(Number(product.price))}</strong><span className="text-xs text-slate-500">Stock: {product.stock}</span></div></div>{quantity > 0 && <span className="absolute right-2 top-2 grid h-8 min-w-8 place-items-center rounded-full bg-emerald-600 px-2 text-sm font-bold text-white shadow">{quantity}</span>}</button>; })}</div> : <div className="border border-dashed py-20 text-center text-slate-500">No encontramos productos con esa búsqueda.</div>}
        </section>
        <aside className="border bg-white xl:sticky xl:top-4 xl:h-fit"><div className="border-b px-4 py-4"><h2 className="flex items-center gap-2 font-bold"><ShoppingCart className="h-5 w-5" /> Selección actual <span className="ml-auto text-sm text-slate-500">{units} un.</span></h2></div><div className="max-h-[450px] divide-y overflow-y-auto">{cart.length ? cart.map((product) => <div key={product.id} className="flex gap-3 p-3"><img src={getImageUrl(product.images?.[0] || product.imagen)} alt="" className="h-14 w-14 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.title}</p><p className="text-xs text-slate-500">{money.format(Number(product.price))}</p><div className="mt-2 flex items-center gap-2"><button type="button" className="h-7 w-7 border" onClick={() => updateQuantity(product, -1)}>−</button><span className="w-5 text-center text-sm">{selected[product.id]}</span><button type="button" className="h-7 w-7 border" onClick={() => updateQuantity(product, 1)}>+</button><button type="button" className="ml-auto text-slate-400 hover:text-red-600" onClick={() => setSelected((current) => ({ ...current, [product.id]: 0 }))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button></div></div></div>) : <p className="px-4 py-12 text-center text-sm text-slate-500">Selecciona productos desde el catálogo.</p>}</div><div className="space-y-4 border-t p-4"><div className="flex justify-between"><span>Subtotal</span><strong className="text-xl">{money.format(subtotal)}</strong></div><Button className="w-full" size="lg" disabled={!cart.length} onClick={() => { setError(""); setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Continuar con el comprador</Button></div></aside>
      </div>}

      {step === 2 && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MessageCircle className="h-5 w-5" /> Datos del comprador</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Field label="Canal de venta"><select className="h-10 w-full border bg-white px-3" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}><option value="whatsapp">WhatsApp</option><option value="email">Correo</option><option value="instagram">Instagram</option><option value="phone">Teléfono</option><option value="other">Otro</option></select></Field><Field label="Nombre completo *"><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Juan Pérez" /></Field><Field label="Correo *"><Input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} /></Field><Field label="Teléfono *"><Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} /></Field><Field label="RUT *"><Input value={form.customerRut} onChange={(e) => setForm({ ...form, customerRut: e.target.value })} /></Field></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Truck className="h-5 w-5" /> Información de envío</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Field label="Región *"><select className="h-10 w-full border bg-white px-3" value={form.shippingRegionId} onChange={(e) => onRegionChange(e.target.value)}><option value="">Selecciona una región</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></Field><Field label="Comuna *"><select disabled={!form.shippingRegionId} className="h-10 w-full border bg-white px-3 disabled:bg-slate-100" value={form.shippingCommuneId} onChange={(e) => { const commune = communes.find((item) => String(item.id) === e.target.value); setForm({ ...form, shippingCommuneId: e.target.value, shippingCommune: commune?.name || "" }); }}><option value="">Selecciona una comuna</option>{communes.map((commune) => <option key={commune.id} value={commune.id}>{commune.name}</option>)}</select></Field><div className="md:col-span-2 grid grid-cols-[1fr_140px] gap-3"><Field label="Dirección (calle o avenida) *"><Input value={form.shippingAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })} /></Field><Field label="Número *"><Input value={form.shippingNumber} onChange={(e) => setForm({ ...form, shippingNumber: e.target.value })} placeholder="123 o S/N" /></Field></div><div className="md:col-span-2"><Field label="Notas del pedido (opcional)"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Departamento, oficina, referencias u otras indicaciones." /></Field></div></CardContent></Card></div>
        <aside className="h-fit border bg-white p-4 lg:sticky lg:top-4"><h2 className="mb-4 font-bold">Resumen</h2><div className="space-y-2 text-sm">{cart.map((product) => <div key={product.id} className="flex justify-between gap-3"><span className="truncate">{selected[product.id]} × {product.title}</span><span>{money.format(Number(product.price) * selected[product.id])}</span></div>)}</div><div className="mt-4 flex justify-between border-t pt-4"><span>Subtotal</span><strong className="text-xl">{money.format(subtotal)}</strong></div><div className="mt-5 grid gap-2"><Button size="lg" disabled={working} onClick={createAndQuote}>{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />} Cotizar envío</Button><Button variant="outline" onClick={() => setStep(1)}>Volver a productos</Button></div></aside>
      </div>}

      {step === 3 && <div className="grid gap-5 lg:grid-cols-[1fr_380px]"><Card><CardHeader><CardTitle className="text-lg">Selecciona el envío</CardTitle></CardHeader><CardContent className="divide-y border-y">{quotes.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No se encontraron opciones para esta dirección.</p>}{quotes.map((quote, index) => { const active = selectedQuote && selectedQuote.carrier === quote.carrier && selectedQuote.service === quote.service; return <button key={`${quote.carrier}-${quote.service}-${index}`} type="button" onClick={() => chooseQuote(quote)} className={`flex w-full items-center justify-between gap-4 px-3 py-4 text-left ${active ? "bg-emerald-50 outline outline-2 outline-emerald-500" : "hover:bg-slate-50"}`}><div><p className="font-semibold capitalize">{quote.carrier}</p><p className="text-sm text-slate-600">{quote.serviceDescription || quote.service}</p></div><div className="text-right"><p className="font-bold">{money.format(Number(quote.totalPrice))}</p>{active && <p className="flex items-center justify-end gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3 w-3" /> Seleccionado</p>}</div></button>; })}</CardContent></Card><Card><CardHeader><CardTitle className="text-lg">Confirmar y pagar</CardTitle></CardHeader><CardContent className="space-y-5"><div className="space-y-2 text-sm"><Row label="Productos" value={money.format(Number(order.subtotal))} /><Row label="Envío" value={selectedQuote ? money.format(shipping) : "Selecciona envío"} /><Row label="Total transferido por el comprador" value={money.format(Number(order.subtotal) + shipping)} strong /></div><div className="border-t pt-4 text-sm"><p className="mb-3 font-semibold">Pago de la tienda a MundoBeat</p><Row label="Envío" value={money.format(shipping)} /><Row label={assistedCommissionLabel(order)} value={money.format(commission)} /><Row label="Total a pagar" value={money.format(shipping + commission)} strong /><p className="mt-2 text-xs text-slate-500">Después del pago volverás al pedido en la administración. El comprador y la tienda recibirán la confirmación por correo.</p></div><Field label="Número de operación (opcional)"><Input disabled={!!order.customerTransferConfirmedAt} value={transferReference} onChange={(event) => setTransferReference(event.target.value)} placeholder="Número de operación" /></Field>{!order.customerTransferConfirmedAt ? <Button className="w-full" disabled={working} onClick={receiveBuyerTransfer}>Confirmar transferencia recibida</Button> : <p className="text-sm font-semibold text-emerald-700">Transferencia recibida · Pedido pagado</p>}<Button className="w-full" size="lg" disabled={!selectedQuote || working || !order.customerTransferConfirmedAt} onClick={payPlatformCharge}>{working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Pagar {money.format(shipping + commission)}</Button><Button asChild variant="outline" className="w-full"><Link href={`/dashboard/orders/${order.id}`}>Guardar y revisar después</Link></Button></CardContent></Card></div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`flex items-center justify-between gap-4 ${strong ? "border-t pt-2 font-bold" : ""}`}><span>{label}</span><span>{value}</span></div>; }
