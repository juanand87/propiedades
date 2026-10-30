"use client";

import { useState, useEffect, useRef } from "react";
import { api, API_URL } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileSpreadsheet, RefreshCw, Search, Mail } from "lucide-react";
import { getBackendAssetUrl } from "@/lib/utils";

type Tab = "importar" | "liquidaciones" | "depositos" | "conciliaciones";

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });

const estadoBadge: Record<string, string> = {
  pagado:     "bg-green-100 text-green-800",
  pending:    "bg-yellow-100 text-yellow-800",
  pendiente:  "bg-yellow-100 text-yellow-800",
  rejected:   "bg-red-100 text-red-800",
  rechazado:  "bg-red-100 text-red-800",
  anulado:    "bg-gray-100 text-gray-700",
};

function estadoClass(estado: string | null) {
  if (!estado) return "bg-gray-100 text-gray-500";
  return estadoBadge[estado.toLowerCase()] ?? "bg-blue-100 text-blue-800";
}

function localDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateOnlyTime(value: string | Date) {
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
}

function formatDateOnly(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : parseDateOnly(value);
  return date.toLocaleDateString("es-CL");
}

function canPayAfterPaykuDeposit(order: any, fechaPago: string) {
  if (!order.fechaDepositoPayku) return false;
  return dateOnlyTime(fechaPago) >= dateOnlyTime(String(order.fechaDepositoPayku));
}

export default function LiquidacionesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("importar");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "importar",        label: "Importar Reporte",   icon: "📤" },
    { id: "liquidaciones",   label: "Liquidaciones",      icon: "💰" },
    { id: "depositos",       label: "Depósitos Tiendas",  icon: "🏪" },
    { id: "conciliaciones",  label: "Conciliaciones",     icon: "🔍" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">💰 Liquidaciones</h1>
        <p className="text-gray-600 mt-1">Gestión de pagos y liquidaciones Payku</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === t.id
                ? "bg-purple-600 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:border-purple-300 hover:text-purple-600"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "importar"      && <TabImportar />}
      {activeTab === "liquidaciones" && <TabLiquidaciones />}
      {activeTab === "depositos"     && <TabDepositos />}
      {activeTab === "conciliaciones"&& <TabConciliaciones />}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TAB 1 — Importar Reporte
───────────────────────────────────────────── */
function TabImportar() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setError("Solo se permiten archivos Excel (.xlsx o .xls)");
      return;
    }
    setFile(f);
    setResult(null);
    setError("");
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/liquidaciones/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${api.getToken()}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al importar");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Drop zone */}
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          dragging ? "border-purple-400 bg-purple-50" : "border-gray-300 hover:border-purple-300"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
          <FileSpreadsheet size={48} className="text-purple-400" />
          <div>
            <p className="font-semibold text-gray-700">
              {file ? file.name : "Arrastra el Excel aquí o haz clic para seleccionar"}
            </p>
            <p className="text-sm text-gray-500 mt-1">Reporte Payku (.xlsx / .xls) · máx. 20 MB</p>
          </div>
          {file && (
            <p className="text-xs text-purple-600 font-medium">
              ✅ Archivo listo: {(file.size / 1024).toFixed(0)} KB
            </p>
          )}
        </CardContent>
      </Card>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <Button
        onClick={handleImport}
        disabled={!file || loading}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {loading ? "Importando..." : "Importar Reporte"}
      </Button>

      {/* Result */}
      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-green-800 text-lg">✅ Importación completada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{result.total}</p>
                <p className="text-gray-500">Total filas</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{result.inserted}</p>
                <p className="text-gray-500">Nuevos registros</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-gray-500">Actualizados</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-400">{result.skipped}</p>
                <p className="text-gray-500">Omitidos</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center col-span-2">
                <p className="text-2xl font-bold text-emerald-600">{result.depositosAsociados ?? 0}</p>
                <p className="text-gray-500">Con Fecha Depósito Payku</p>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-semibold text-yellow-800 mb-1">⚠️ Advertencias ({result.errors.length}):</p>
                <ul className="text-xs text-yellow-700 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TAB 2 — Liquidaciones
───────────────────────────────────────────── */
function TabLiquidaciones() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");
  const LIMIT = 50;

  useEffect(() => { load(1); loadStats(); }, []);

  const load = async (p: number, s = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p), limit: String(LIMIT), ...(s && { search: s }),
      });
      const res = await fetch(`${API_URL}/liquidaciones?${params}`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      console.log('🔍 [Liquidaciones] Response status:', res.status);
      const data = await res.json();
      console.log('🔍 [Liquidaciones] Response data:', data);
      
      if (!res.ok) {
        console.error('❌ [Liquidaciones] Error response:', data);
        setError(data.message || 'Error al cargar liquidaciones');
        return;
      }
      
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch (err) {
      console.error('❌ [Liquidaciones] Fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error de conexión';
      setError(errorMessage);
    }
    finally { setLoading(false); }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_URL}/liquidaciones/stats`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      setStats(await res.json());
    } catch {}
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(1);
  };

  return (
    <div className="space-y-4">
      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-red-700 text-sm">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card><CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-gray-500">Total transacciones</p>
          </CardContent></Card>
          <Card><CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-green-600">{CLP.format(Number(stats.montoTotal) || 0)}</p>
            <p className="text-xs text-gray-500">Monto total</p>
          </CardContent></Card>
          <Card><CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.montoPorLiquidacion?.length || 0}</p>
            <p className="text-xs text-gray-500">Liquidaciones</p>
          </CardContent></Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="py-3">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Buscar por identificador, orden, email, concepto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              <Search size={14} className="mr-1"/> Buscar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setSearch(""); load(1, ""); }}>
              <RefreshCw size={14} />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex justify-between">
            <span>Transacciones ({total})</span>
            {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Identificador</th>
                  <th className="px-3 py-2 text-left">Concepto</th>
                  <th className="px-3 py-2 text-left">Orden</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-right">Venta productos</th>
                  <th className="px-3 py-2 text-right">Envío</th>
                  <th className="px-3 py-2 text-right">Comisión</th>
                  <th className="px-3 py-2 text-right">Neto Payku</th>
                  <th className="px-3 py-2 text-left">Liquidación</th>
                  <th className="px-3 py-2 text-left">Medio Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 && !loading ? (
                  <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">
                    No hay registros. Importa un reporte en la pestaña "Importar Reporte".
                  </td></tr>
                ) : items.map((item) => {
                  const ventaSinEnvio = item.productSaleAmount ?? (item.monto != null && item.shippingCost != null
                    ? Number(item.monto) - Number(item.shippingCost)
                    : item.monto);
                  return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {item.fecha ? new Date(item.fecha).toLocaleString("es-CL") : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{item.identificador}</td>
                    <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={item.concepto}>{item.concepto || "—"}</td>
                    <td className="px-3 py-2 text-xs">{item.orden || "—"}
                      {item.orderSource === "assisted_sale" && <div className="mt-1 text-slate-500">Venta asistida · cobro directo{item.orderStatus === "cancelled" ? " · Cancelada" : ""}<br />
                        {item.transferStatus === "not_applicable" ? "Transferencia a tienda: no aplica ($0)" : `Reintegro a tienda: ${CLP.format(Number(item.marketplaceAmount) || 0)} · ${item.transferStatus === "transferred" ? "Transferido" : item.transferStatus === "pending_shipping_cancellation" ? "Por confirmar cancelación del envío" : "Pendiente"}`}
                      </div>}
                    </td>
                    <td className="px-3 py-2 text-xs">{item.email || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{ventaSinEnvio != null ? CLP.format(Number(ventaSinEnvio)) : "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{item.shippingCost != null ? CLP.format(Number(item.shippingCost)) : "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{item.comision != null ? CLP.format(Number(item.comision)) : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">{item.montoFinal != null ? CLP.format(Number(item.montoFinal)) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{item.liquidacion || "—"}</td>
                    <td className="px-3 py-2 text-xs">{item.medioDePago || "—"}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 p-3 border-t">
              <button onClick={() => load(1)} disabled={page === 1} className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100">«</button>
              <button onClick={() => load(page - 1)} disabled={page === 1} className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100">‹</button>
              <span className="px-3 text-sm text-gray-600">Pág. {page} / {totalPages}</span>
              <button onClick={() => load(page + 1)} disabled={page === totalPages} className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100">›</button>
              <button onClick={() => load(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100">»</button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TAB 3 — Depósitos Tiendas
───────────────────────────────────────────── */
function TabDepositos() {
  // ── Estado principal ──────────────────────────────────────────
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState<string>("");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"pendientes" | "historial">("pendientes");
  const [historial, setHistorial] = useState<any[]>([]);

  // ── Modal de pago ─────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    numeroTransferencia: "",
    comprobanteNota: "",
    valorDepositado: "",
    fechaPago: localDateInputValue(),
  });
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notifyingOrderId, setNotifyingOrderId] = useState<string | null>(null);
  const [notificationResult, setNotificationResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => { loadVendors(); }, []);
  useEffect(() => { if (vendorId) loadOrders(); }, [vendorId]);
  useEffect(() => { if (view === "historial") loadHistorial(); }, [view, vendorId]);

  const authHeader = () => ({ Authorization: `Bearer ${api.getToken()}` });

  const loadVendors = async () => {
    try {
      const res = await fetch(`${API_URL}/liquidaciones/vendors-list`, { headers: authHeader() });
      const data = await res.json();
      setVendors(data);
      if (data.length > 0 && !vendorId) setVendorId(data[0].vendorId);
    } catch (e) { console.error(e); }
  };

  const loadOrders = async () => {
    if (!vendorId) return;
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await fetch(`${API_URL}/liquidaciones/depositos-pendientes?vendorId=${vendorId}`, { headers: authHeader() });
      setOrders(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadHistorial = async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/liquidaciones/vendor-payments${vendorId ? `?vendorId=${vendorId}` : ""}`;
      const res = await fetch(url, { headers: authHeader() });
      setHistorial(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Selección
  const requiresCustomerRefund = (order: any) =>
    order.orderSource !== "assisted_sale"
    &&
    order.status === "cancelled"
    && order.paymentStatus === "approved"
    && order.vendorCustomerRefundStatus !== "completed";
  const selectableOrders = orders.filter((order: any) => !requiresCustomerRefund(order));
  const pendingRefundOrders = orders.filter(requiresCustomerRefund);

  const toggleAll = () => {
    const allSelectableSelected = selectableOrders.length > 0
      && selectableOrders.every((order: any) => selected.has(order.id));
    if (allSelectableSelected) setSelected(new Set());
    else setSelected(new Set(selectableOrders.map((o: any) => o.id)));
  };
  const toggleOne = (id: string) => {
    const order = orders.find((item: any) => item.id === id);
    if (!order || requiresCustomerRefund(order)) return;
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const selectedOrders = orders.filter((o: any) => selected.has(o.id));
  const getDepositAmount = (order: any) => Number(order.depositAmount ?? order.vendorAmount) || 0;
  const totalEsperado = selectedOrders.reduce((acc: number, o: any) => acc + getDepositAmount(o), 0);
  const deposito = Number(form.valorDepositado) || 0;
  const diff = Math.abs(deposito - totalEsperado);
  const depositoOk = deposito > 0 && diff < 1; // tolerancia $1
  const selectedBlockedOrders = selectedOrders.filter((o: any) => !canPayAfterPaykuDeposit(o, form.fechaPago));

  const openModal = () => {
    if (!selected.size) return;
    const fechaPago = localDateInputValue();
    const blocked = selectedOrders.filter((o: any) => !canPayAfterPaykuDeposit(o, fechaPago));
    if (blocked.length > 0) {
      setSaveError("Hay órdenes seleccionadas sin Fecha Depósito Payku disponible o con depósito Payku futuro.");
    }
    setForm({ numeroTransferencia: "", comprobanteNota: "", valorDepositado: String(totalEsperado), fechaPago });
    setComprobanteFile(null);
    setSaveError(blocked.length > 0 ? "Hay órdenes seleccionadas sin Fecha Depósito Payku disponible o con depósito Payku futuro." : "");
    setShowModal(true);
  };

  const handlePago = async () => {
    if (!form.numeroTransferencia.trim()) { setSaveError("Ingresa el N° de transferencia"); return; }
    if (!form.fechaPago) { setSaveError("Ingresa la fecha de pago a tienda"); return; }
    if (selectedBlockedOrders.length > 0) {
      setSaveError("No puedes registrar el pago: una o más órdenes aún no tienen depósito Payku confirmado para esa fecha.");
      return;
    }
    if (!depositoOk) { setSaveError(`El valor depositado (${CLP.format(deposito)}) no coincide con la suma esperada (${CLP.format(totalEsperado)})`); return; }
    setSaving(true);
    setSaveError("");
    try {
      const fd = new FormData();
      fd.append("vendorId", vendorId);
      fd.append("orderIds", JSON.stringify([...selected]));
      fd.append("numeroTransferencia", form.numeroTransferencia);
      fd.append("comprobanteNota", form.comprobanteNota);
      fd.append("valorDepositado", String(deposito));
      fd.append("fechaPago", form.fechaPago);
      if (comprobanteFile) fd.append("comprobante", comprobanteFile);
      const vInfo = vendors.find((v) => v.vendorId === vendorId);
      if (vInfo) {
        fd.append("vendorEmail", vInfo.vendorEmail ?? "");
        fd.append("vendorStoreName", vInfo.storeName ?? vInfo.vendorEmail ?? "");
      }
      const res = await fetch(`${API_URL}/liquidaciones/pagar-vendor`, {
        method: "POST",
        headers: { Authorization: `Bearer ${api.getToken()}` },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      setShowModal(false);
      loadOrders();
      setView("historial");
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const notifyVendorPendingRefund = async (order: any) => {
    setNotifyingOrderId(order.id);
    setNotificationResult(null);
    try {
      const res = await fetch(`${API_URL}/liquidaciones/devoluciones/${order.id}/notificar-vendedor`, {
        method: "POST",
        headers: authHeader(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "No se pudo enviar la notificación");
      setNotificationResult({ type: "success", message: `Recordatorio enviado por el pedido ${order.orderNumber}.` });
    } catch (error: any) {
      setNotificationResult({ type: "error", message: error.message || "No se pudo enviar la notificación" });
    } finally {
      setNotifyingOrderId(null);
    }
  };

  const currentVendor = vendors.find((v) => v.vendorId === vendorId);

  return (
    <div className="space-y-4">
      {/* Header + controles */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Depósitos a Tiendas</h2>
        <div className="flex gap-2">
          <button onClick={() => setView("pendientes")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === "pendientes" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            📋 Pendientes
          </button>
          <button onClick={() => setView("historial")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === "historial" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            📜 Historial
          </button>
          <Button size="sm" variant="outline" onClick={view === "pendientes" ? loadOrders : loadHistorial} disabled={loading}>
            <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>
      </div>

      {/* Selector de tienda */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-gray-600">Tienda:</label>
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">— Todas —</option>
          {vendors.map((v: any) => (
            <option key={v.vendorId} value={v.vendorId}>
              {v.storeName ?? v.vendorEmail ?? v.vendorId}
            </option>
          ))}
        </select>
        {vendors.length === 0 && (
          <span className="text-xs text-gray-400">No hay tiendas con órdenes processing pendientes</span>
        )}
      </div>

      {/* ── VISTA PENDIENTES ── */}
      {view === "pendientes" && (
        <>
          {pendingRefundOrders.length > 0 && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="mt-0.5 text-base" aria-hidden="true">!</span>
              <div>
                <p className="font-semibold">Hay devoluciones pendientes al comprador</p>
                <p className="mt-0.5 text-xs">
                  {pendingRefundOrders.length} orden(es) no pueden incluirse en un pago a la tienda hasta que esta registre la devolución y adjunte el comprobante.
                </p>
              </div>
            </div>
          )}
          {notificationResult && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${notificationResult.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {notificationResult.message}
            </div>
          )}
          {selected.size > 0 && (
            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
              <div className="text-sm">
                <span className="font-semibold text-purple-700">{selected.size} órdenes seleccionadas</span>
                <span className="ml-2 text-gray-600">— Total a depositar: <strong className="text-green-700">{CLP.format(totalEsperado)}</strong></span>
                {selectedBlockedOrders.length > 0 && (
                  <span className="block mt-1 text-xs text-amber-700">
                    {selectedBlockedOrders.length} orden(es) aún no tienen depósito Payku disponible para pago.
                  </span>
                )}
              </div>
              <Button size="sm" onClick={openModal} className="bg-green-600 hover:bg-green-700 text-white">
                💸 Registrar Pago
              </Button>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                    <tr>
                      <th className="px-3 py-2">
                        <input type="checkbox"
                          checked={selectableOrders.length > 0 && selectableOrders.every((order: any) => selected.has(order.id))}
                          disabled={selectableOrders.length === 0}
                          onChange={toggleAll} className="rounded" />
                      </th>
                      <th className="px-3 py-2 text-left">N° Orden</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Tienda</th>
                      <th className="px-3 py-2 text-center">Estado</th>
                      <th className="px-3 py-2 text-right">Venta productos</th>
                      <th className="px-3 py-2 text-right">Comisión / gasto</th>
                      <th className="px-3 py-2 text-right">Envío cobrado</th>
                      <th className="px-3 py-2 text-right">A Depositar</th>
                      <th className="px-3 py-2 text-left">Liquidación Payku</th>
                      <th className="px-3 py-2 text-left">Fecha Depósito</th>
                      <th className="px-3 py-2 text-center">Pago Payku</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={12} className="px-3 py-8 text-center">
                        <Loader2 className="animate-spin inline-block text-gray-400" />
                      </td></tr>
                    ) : orders.length === 0 ? (
                      <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-400">
                        {vendorId ? "No hay pedidos pendientes para esta tienda." : "Selecciona una tienda."}
                      </td></tr>
                    ) : orders.map((o: any) => {
                      const refundPending = requiresCustomerRefund(o);
                      const isAssistedReimbursement = o.depositType === "assisted_reimbursement";
                      const aDepositar = getDepositAmount(o);
                      const comision = Number(o.commissionAmount ?? o.marketplaceCommission) || 0;
                      const ventaProductos = o.status === "cancelled"
                        ? Math.max(0, Number(o.total || 0) - Number(o.shippingCost || 0))
                        : aDepositar + comision;
                      return (
                      <tr key={o.id} className={`${refundPending ? "bg-red-50/60" : "hover:bg-gray-50"} ${selected.has(o.id) ? "bg-purple-50" : ""}`}>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={selected.has(o.id)}
                            disabled={refundPending}
                            title={refundPending ? "La devolución al comprador debe registrarse con comprobante antes de pagar a la tienda" : undefined}
                            onChange={() => toggleOne(o.id)} className="rounded disabled:cursor-not-allowed disabled:opacity-50" />
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className="font-mono font-semibold">{o.orderNumber}</span>
                          {isAssistedReimbursement && (
                            <span className="mt-1 block w-fit rounded-full bg-sky-100 px-2 py-0.5 font-sans text-[11px] font-semibold text-sky-800">
                              Reintegro venta asistida
                            </span>
                          )}
                          {refundPending && (
                            <>
                              <span className="mt-1 block w-fit rounded-full bg-red-100 px-2 py-0.5 font-sans text-[11px] font-semibold text-red-700">
                                Devolución al comprador pendiente
                              </span>
                              <button
                                type="button"
                                onClick={() => notifyVendorPendingRefund(o)}
                                disabled={notifyingOrderId === o.id}
                                className="mt-1.5 inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 font-sans text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                                title="Enviar a la tienda un recordatorio con enlace al pedido"
                              >
                                {notifyingOrderId === o.id ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                                {notifyingOrderId === o.id ? "Enviando" : "Notificar tienda"}
                              </button>
                            </>
                          )}
                          {o.status === "cancelled" && o.vendorCustomerRefundStatus === "completed" && (
                            <span className="mt-1 block w-fit rounded-full bg-emerald-100 px-2 py-0.5 font-sans text-[11px] font-semibold text-emerald-700">
                              Devolución acreditada
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(o.createdAt).toLocaleDateString("es-CL")}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">{o.vendorEmail ?? "—"}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoClass(o.status)}`}>
                            {o.status ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">
                          {CLP.format(ventaProductos)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-rose-600">
                          {isAssistedReimbursement
                            ? <span className="text-emerald-700" title="Comisión devuelta a la tienda">+{CLP.format(Number(o.assistedCommissionRefundAmount) || 0)}</span>
                            : comision > 0 ? <span title={o.status === "cancelled" ? "Gasto operacional por cancelación (3%)" : "Comisión"}>{CLP.format(comision)}</span> : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500">
                          {isAssistedReimbursement
                            ? <span className="text-emerald-700" title="Envío devuelto a la tienda">+{CLP.format(Number(o.assistedShippingRefundAmount) || 0)}</span>
                            : Number(o.shippingCost) > 0 ? CLP.format(Number(o.shippingCost)) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-blue-700">
                          {CLP.format(aDepositar)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {o.liquidacionNumero
                            ? <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-mono">{o.liquidacionNumero}</span>
                            : <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pendiente</span>}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          {o.fechaDepositoPayku
                            ? <span className={canPayAfterPaykuDeposit(o, localDateInputValue()) ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>
                                {formatDateOnly(o.fechaDepositoPayku)}
                              </span>
                            : <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Sin fecha</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoClass(o.paymentStatus)}`}>
                            {o.paymentStatus ?? "—"}
                          </span>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                  {orders.length > 0 && (
                    <tfoot className="bg-gray-50 font-semibold text-sm">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-right text-gray-600">Total ({orders.length} órdenes):</td>
                        <td className="px-3 py-2 text-right text-green-700">
                          {CLP.format(orders.reduce((acc: number, o: any) => acc + (o.status === "cancelled" ? 0 : (Number(o.vendorAmount) || 0) + (Number(o.commissionAmount ?? o.marketplaceCommission) || 0)), 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-rose-600">
                          {CLP.format(orders.reduce((acc: number, o: any) => acc + (o.depositType === "assisted_reimbursement" ? Number(o.assistedCommissionRefundAmount) || 0 : Number(o.commissionAmount ?? o.marketplaceCommission) || 0), 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500">
                          {CLP.format(orders.reduce((acc: number, o: any) => acc + (o.depositType === "assisted_reimbursement" ? Number(o.assistedShippingRefundAmount) || 0 : Number(o.shippingCost) || 0), 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-blue-700">
                          {CLP.format(orders.reduce((acc: number, o: any) => acc + getDepositAmount(o), 0))}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── VISTA HISTORIAL ── */}
      {view === "historial" && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="animate-spin inline-block text-gray-400" /></div>
          ) : historial.length === 0 ? (
            <div className="py-8 text-center text-gray-400">No hay pagos registrados aún.</div>
          ) : historial.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="py-4">
                <div className="flex flex-wrap justify-between gap-2 mb-3">
                  <div>
                    <span className="text-xs text-gray-500">Fecha pago a tienda </span>
                    <span className="text-xs font-medium">{formatDateOnly(p.fechaPago ?? p.createdAt)}</span>
                    <span className="ml-3 text-xs text-gray-500">Transferencia:</span>
                    <span className="ml-1 text-xs font-mono font-semibold text-purple-700">{p.numeroTransferencia}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-green-700">{CLP.format(Number(p.valorDepositado))}</span>
                    <span className="text-xs text-gray-400 ml-1">depositado</span>
                    {Math.abs(Number(p.valorDepositado) - Number(p.valorEsperado)) > 1 && (
                      <span className="ml-2 text-xs text-red-500">(esperado: {CLP.format(Number(p.valorEsperado))})</span>
                    )}
                  </div>
                </div>
                {p.comprobanteNota && (
                  <p className="text-xs text-gray-500 mb-2">Nota: {p.comprobanteNota}</p>
                )}
                {p.comprobante && (
                  <a href={getBackendAssetUrl(p.comprobante)} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 underline mb-2 inline-block">📎 Ver comprobante</a>
                )}
                {p.orders?.length > 0 && (
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-xs bg-gray-50 rounded">
                      <thead><tr className="text-gray-500">
                        <th className="px-2 py-1 text-left">Orden</th>
                        <th className="px-2 py-1 text-right">Venta neta</th>
                        <th className="px-2 py-1 text-left">Fecha</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-200">
                        {p.orders.map((o: any) => (
                          <tr key={o.id}>
                            <td className="px-2 py-1 font-mono">{o.orderNumber}</td>
                            <td className="px-2 py-1 text-right text-green-700">{CLP.format(Number(o.orderSource === "assisted_sale" ? o.assistedReimbursementAmount : o.vendorAmount))}</td>
                            <td className="px-2 py-1 text-gray-500">{new Date(o.createdAt).toLocaleDateString("es-CL")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── MODAL DE PAGO ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md space-y-4 p-6">
            <h3 className="text-lg font-bold">Registrar Depósito</h3>

            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Tienda:</span> <strong>{currentVendor?.storeName ?? currentVendor?.vendorEmail ?? vendorId}</strong></p>
              <p><span className="text-gray-500">Órdenes:</span> <strong>{selected.size}</strong></p>
              <p><span className="text-gray-500">Total a depositar:</span> <strong className="text-green-700">{CLP.format(totalEsperado)}</strong></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fecha pago a tienda *</label>
                <input type="date" value={form.fechaPago}
                  onChange={(e) => setForm({ ...form, fechaPago: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <p className="text-xs text-gray-500 mt-1">
                  Debe ser igual o posterior a la Fecha Depósito informada por Payku.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">N° Transferencia / Transacción *</label>
                <input type="text" value={form.numeroTransferencia}
                  onChange={(e) => setForm({ ...form, numeroTransferencia: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Ej: 123456789" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Valor depositado (CLP) *</label>
                <input type="number" value={form.valorDepositado}
                  onChange={(e) => setForm({ ...form, valorDepositado: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${
                    form.valorDepositado && !depositoOk ? "border-red-400 bg-red-50" : "border-gray-300"
                  }`} />
                {form.valorDepositado && !depositoOk && (
                  <p className="text-xs text-red-500 mt-1">
                    Diferencia de {CLP.format(diff)} con el total esperado ({CLP.format(totalEsperado)})
                  </p>
                )}
                {depositoOk && (
                  <p className="text-xs text-green-600 mt-1">✓ Coincide con el total esperado</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Comprobante (imagen/PDF)</label>
                <input type="file" accept=".jpg,.jpeg,.png,.pdf,.webp"
                  onChange={(e) => setComprobanteFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
                {selectedOrders.every((order: any) => order.depositType === "assisted_reimbursement") && (
                  <p className="mt-1 text-xs text-gray-500">Opcional para reintegros de ventas asistidas.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nota / referencia (opcional)</label>
                <textarea value={form.comprobanteNota}
                  onChange={(e) => setForm({ ...form, comprobanteNota: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Banco de origen, comentarios, etc." />
              </div>
            </div>

            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{saveError}</div>
            )}

            {selectedBlockedOrders.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                No se puede confirmar todavía. Revisa estas órdenes:{" "}
                <strong>{selectedBlockedOrders.map((o: any) => o.orderNumber).join(", ")}</strong>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handlePago} disabled={saving || !depositoOk || !form.numeroTransferencia.trim() || selectedBlockedOrders.length > 0 || !form.fechaPago}
                className="bg-green-600 hover:bg-green-700 text-white">
                {saving ? <Loader2 size={14} className="animate-spin mr-1 inline" /> : ""}
                Confirmar Pago
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TAB 4 — Conciliaciones
───────────────────────────────────────────── */
function TabConciliaciones() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  const load = async (s = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200", ...(s && { search: s }) });
      const res = await fetch(`${API_URL}/liquidaciones?${params}`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  // Registros con ordenExterna (posible match con órdenes del sistema)
  const conOrdenExterna = items.filter(i => i.ordenExterna);
  const sinOrdenExterna = items.filter(i => !i.ordenExterna);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg">
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">{items.length}</p>
          <p className="text-xs text-gray-500">Total registros</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-green-600">{conOrdenExterna.length}</p>
          <p className="text-xs text-gray-500">Con orden externa</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{sinOrdenExterna.length}</p>
          <p className="text-xs text-gray-500">Sin orden externa</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="py-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Buscar por identificador, orden, orden externa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" size="sm" variant="outline"><Search size={14} className="mr-1"/>Buscar</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setSearch(""); load(""); }}>
              <RefreshCw size={14} />
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalle de conciliación</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Identificador</th>
                  <th className="px-3 py-2 text-left">Orden interna</th>
                  <th className="px-3 py-2 text-left">Orden externa</th>
                  <th className="px-3 py-2 text-center">Estado</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-left">Asunto</th>
                  <th className="px-3 py-2 text-left">Pagador</th>
                  <th className="px-3 py-2 text-left">Banco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center">
                    <Loader2 className="animate-spin inline-block text-gray-400" />
                  </td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    Sin datos. Importa un reporte primero.
                  </td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.ordenExterna ? "" : "opacity-60"}`}>
                    <td className="px-3 py-2 font-mono text-xs">{item.identificador}</td>
                    <td className="px-3 py-2 text-xs">{item.orden || "—"}
                      {item.orderSource === "assisted_sale" && <div className="mt-1 text-slate-500">Venta asistida · cobro directo{item.orderStatus === "cancelled" ? " · Cancelada" : ""}<br />
                        {item.transferStatus === "not_applicable" ? "Transferencia a tienda: no aplica ($0)" : `Reintegro a tienda: ${CLP.format(Number(item.marketplaceAmount) || 0)} · ${item.transferStatus === "transferred" ? "Transferido" : item.transferStatus === "pending_shipping_cancellation" ? "Por confirmar cancelación del envío" : "Pendiente"}`}
                      </div>}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium">
                      {item.ordenExterna
                        ? <span className="text-green-700 font-semibold">{item.ordenExterna}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoClass(item.estado)}`}>
                        {item.estado || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{item.monto != null ? CLP.format(Number(item.monto)) : "—"}</td>
                    <td className="px-3 py-2 text-xs max-w-[150px] truncate">{item.asunto || "—"}</td>
                    <td className="px-3 py-2 text-xs">{item.payerName || item.emailPagador || "—"}</td>
                    <td className="px-3 py-2 text-xs">{item.payerBank || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
