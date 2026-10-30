"use client";

import { useState, useEffect, useCallback } from "react";
import { api, API_URL } from "@/lib/api";
import { Loader2, RefreshCw, TrendingUp, Clock, CheckCircle, Calendar, ChevronLeft, ChevronRight, ReceiptText, Eye, X } from "lucide-react";
import { getImageUrl } from "@/lib/utils";

type Tab = "resumen" | "pagos" | "envios" | "facturacion";
type Period = "hoy" | "semana" | "mes" | "personalizado" | "todos";

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pendiente",  color: "bg-yellow-100 text-yellow-800" },
  paid:       { label: "Pagado",     color: "bg-green-100 text-green-800"  },
  processing: { label: "Procesando", color: "bg-blue-100 text-blue-800"    },
  shipped:    { label: "Enviado",    color: "bg-indigo-100 text-indigo-800" },
  delivered:  { label: "Entregado",  color: "bg-emerald-100 text-emerald-800" },
  cancelled:  { label: "Cancelado",  color: "bg-red-100 text-red-800"      },
};

function statusBadge(status: string) {
  const s = STATUS_LABELS[status?.toLowerCase()] ?? { label: status ?? "—", color: "bg-gray-100 text-gray-600" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>;
}

function formatDateOnly(value: string | Date | null | undefined) {
  if (!value) return "—";
  const dateValue = value instanceof Date ? value.toISOString() : String(value);
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(dateValue);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("es-CL");
}

const ACCOUNT_TOOLTIPS = {
  aRecibir: "Monto a transferir por MundoBeat, incluidos los reintegros por cancelación. Las ventas asistidas cobradas directamente por la tienda no generan una transferencia por la venta.",
  transferido: "Dinero que MundoBeat ya transfirió a la cuenta de la tienda.",
  pendiente: "Monto que aún falta transferir a la tienda.",
};

export default function EstadoCuentaPage() {
  const [activeTab, setActiveTab] = useState<Tab>("resumen");
  const [period, setPeriod] = useState<Period>("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "resumen",      label: "Resumen General", icon: "📊" },
    { id: "pagos",        label: "Pagos",            icon: "💰" },
    { id: "envios",       label: "Envíos",           icon: "📦" },
    { id: "facturacion",  label: "Facturación",      icon: "🧾" },
  ];

  const load = useCallback(async (p: Period = period, desde = fechaDesde, hasta = fechaHasta) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (p !== "personalizado" && p !== "todos") params.set("period", p);
      if (p === "personalizado" && desde && hasta) {
        params.set("fechaDesde", desde);
        params.set("fechaHasta", hasta);
      }
      const res = await fetch(`${API_URL}/orders/vendor/estado-cuenta?${params}`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period, fechaDesde, fechaHasta]);

  useEffect(() => { load(); }, []);

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    if (p !== "personalizado") load(p);
  };

  const periods: { id: Period; label: string }[] = [
    { id: "hoy",          label: "Hoy" },
    { id: "semana",       label: "Esta semana" },
    { id: "mes",          label: "Este mes" },
    { id: "todos",        label: "Todos" },
    { id: "personalizado", label: "Personalizado" },
  ];

  return (
    <div className="dashboard-account-page space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Estado de Cuenta</h1>
          <p className="text-slate-600 text-sm mt-0.5">Resumen de ventas, pagos y liquidaciones</p>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 rounded-md text-sm transition-all"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {/* Selector de período */}
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePeriod(p.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              period === p.id
                ? "bg-cyan-500 text-white shadow"
                : "border border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Rango personalizado */}
      {period === "personalizado" && (
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
              className="dashboard-date-input px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
              className="dashboard-date-input px-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-md text-sm" />
          </div>
          <button
            onClick={() => load("personalizado", fechaDesde, fechaHasta)}
            disabled={!fechaDesde || !fechaHasta}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md text-sm disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100"
          >
            Aplicar
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border border-slate-200 bg-white p-1 rounded-md w-fit flex-wrap shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? "bg-cyan-500 text-white shadow"
                : "text-slate-600 hover:text-sky-700 hover:bg-sky-50"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-cyan-400" size={32} />
        </div>
      ) : (
        <>
          {activeTab === "resumen"     && <TabResumen data={data} loading={loading} />}
          {activeTab === "pagos"       && <TabPagos orders={data?.orders ?? []} loading={loading} />}
          {activeTab === "envios"      && <TabPlaceholder emoji="📦" title="Envíos" desc="Próximamente: seguimiento de estados de despacho por orden." />}
          {activeTab === "facturacion" && <TabFacturacion />}
        </>
      )}
    </div>
  );
}

/* ─── Tab Resumen ─── */
function TabResumen({ data, loading }: { data: any; loading: boolean }) {
  const r = data?.resumen;
  const orders = data?.orders ?? [];
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const visibleOrders = orders.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  if (!r) return <div className="text-slate-400 text-sm py-8 text-center">Sin datos para el período seleccionado.</div>;

  const cards = [
    { label: "A recibir de MundoBeat",   value: CLP.format(r.ventasTotales),    sub: `${r.totalOrdenes} órdenes`,  tooltip: ACCOUNT_TOOLTIPS.aRecibir,    color: "from-cyan-500 to-blue-600",     icon: <TrendingUp size={20} /> },
    { label: "Transferido", value: CLP.format(r.pagosRecibidos),   sub: "Depositado a tu cuenta",     tooltip: ACCOUNT_TOOLTIPS.transferido, color: "from-emerald-500 to-green-600", icon: <CheckCircle size={20} /> },
    { label: "Pendiente",   value: CLP.format(r.pagosPendientes),  sub: "Pendiente de depósito",      tooltip: ACCOUNT_TOOLTIPS.pendiente,   color: "from-amber-500 to-orange-600",  icon: <Clock size={20} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            title={c.tooltip}
            className={`bg-gradient-to-br ${c.color} rounded-xl p-5 text-white relative overflow-hidden cursor-help`}
          >
            <div className="opacity-20 absolute right-3 top-3">{c.icon}</div>
            <p className="text-sm font-medium opacity-90 underline decoration-white/40 decoration-dotted underline-offset-4">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
            <p className="text-xs mt-1 opacity-75">{c.sub}</p>
            {loading && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><Loader2 size={16} className="animate-spin" /></div>}
          </div>
        ))}
      </div>

      {r.desde && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Calendar size={12} />
          Período: {new Date(r.desde).toLocaleDateString("es-CL")} — {new Date(r.hasta).toLocaleDateString("es-CL")}
        </p>
      )}

      {/* Mini tabla de últimas órdenes */}
      {orders.length > 0 && (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-sky-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Órdenes del período</h3>
            <span className="text-xs text-slate-600">
              Mostrando {pageStart + 1}-{Math.min(pageStart + pageSize, orders.length)} de {orders.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Orden</th>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-right">A recibir de MundoBeat</th>
                  <th className="px-4 py-2 text-center">Estado</th>
                  <th className="px-4 py-2 text-left">Liquidación Payku</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleOrders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-sky-50/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                          {o.coverImage ? (
                            <img src={getImageUrl(o.coverImage)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-sm text-sky-600">♫</div>
                          )}
                        </div>
                        <span className="font-mono text-xs font-semibold text-sky-700">{o.orderNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{new Date(o.createdAt).toLocaleDateString("es-CL")}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{CLP.format(Number(o.marketplaceAmount) || 0)}</td>
                    <td className="px-4 py-2.5 text-center">{statusBadge(o.status)}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {o.liquidacionNumero
                        ? <span className="text-emerald-700 font-mono">{o.liquidacionNumero}</span>
                        : <span className="text-amber-700">Pendiente</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="grid h-8 w-8 place-items-center rounded border border-slate-300 bg-white text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Página anterior"
                title="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  type="button"
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 min-w-8 rounded border px-2 text-xs font-semibold transition-colors ${
                    currentPage === page
                      ? "border-cyan-500 bg-cyan-500 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                  }`}
                  aria-label={`Ir a la página ${page}`}
                  aria-current={currentPage === page ? "page" : undefined}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="grid h-8 w-8 place-items-center rounded border border-slate-300 bg-white text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Página siguiente"
                title="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Tab Pagos ─── */
function TabPagos({ orders, loading }: { orders: any[]; loading: boolean }) {
  const now = new Date();
  const [selAnio, setSelAnio] = useState<number | null>(now.getFullYear());
  const [selMes,  setSelMes]  = useState<number | null>(now.getMonth());

  // Años disponibles (desc)
  const years = Array.from(new Set(orders.map(o => new Date(o.createdAt).getFullYear()))).sort((a, b) => b - a);

  // Meses disponibles para el año seleccionado (0-based)
  const months = selAnio
    ? Array.from(new Set(
        orders
          .filter(o => new Date(o.createdAt).getFullYear() === selAnio)
          .map(o => new Date(o.createdAt).getMonth())
      )).sort((a, b) => b - a)
    : [];

  const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const handleAnio = (v: string) => {
    setSelAnio(v ? Number(v) : null);
    setSelMes(null);
  };

  // Órdenes filtradas
  const filtered = orders.filter(o => {
    if (o.orderSource === "mercadolibre") return false;
    const d = new Date(o.createdAt);
    if (selAnio !== null && d.getFullYear() !== selAnio) return false;
    if (selMes  !== null && d.getMonth()    !== selMes)  return false;
    return true;
  });

  // Agrupar filtradas por mes
  const groups: { label: string; items: any[] }[] = [];
  for (const o of filtered) {
    const d = new Date(o.createdAt);
    const label = d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(o);
    else groups.push({ label, items: [o] });
  }

  const totalARecibir = filtered.reduce((s, o) => s + (Number(o.marketplaceAmount) || 0), 0);
  const totalEnvio  = filtered.reduce((s, o) => s + (Number(o.shippingCost) || 0), 0);
  const totalPagado = filtered.filter(o => o.pagado != null).reduce((s, o) => s + Number(o.pagado), 0);
  const totalPendiente = totalARecibir - totalPagado;

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-white">Detalle de pagos</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro Año */}
          <select
            value={selAnio ?? ""}
            onChange={e => handleAnio(e.target.value)}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 text-slate-200 rounded-lg text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="">Todos los años</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Filtro Mes (solo si hay año elegido) */}
          <select
            value={selMes ?? ""}
            onChange={e => setSelMes(e.target.value !== "" ? Number(e.target.value) : null)}
            disabled={selAnio === null}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 text-slate-200 rounded-lg text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-40"
          >
            <option value="">Todos los meses</option>
            {months.map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
          </select>

          {(selAnio !== null || selMes !== null) && (
            <button
              onClick={() => { setSelAnio(null); setSelMes(null); }}
              className="px-2 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
            >
              Limpiar
            </button>
          )}
          {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700/50 text-xs text-slate-400 uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left">N° Orden</th>
              <th className="px-4 py-2.5 text-left">Fecha venta</th>
              <th className="px-4 py-2.5 text-right">Venta productos</th>
              <th className="px-4 py-2.5 text-right">Comisión / gasto</th>
              <th className="px-4 py-2.5 text-right">A recibir de MundoBeat</th>
              <th className="px-4 py-2.5 text-right">Envío cobrado al cliente</th>
              <th className="px-4 py-2.5 text-center">Estado pedido</th>
              <th className="px-4 py-2.5 text-left">Liquidación Payku</th>
              <th className="px-4 py-2.5 text-center">Transferencia tienda</th>
              <th className="px-4 py-2.5 text-left">Fecha transferencia</th>
              <th className="px-4 py-2.5 text-center">Devolución comprador</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                  Sin órdenes en el período seleccionado.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                  Sin órdenes para el filtro seleccionado.
                </td>
              </tr>
            ) : groups.map(({ label, items }) => {
              const gARecibir = items.reduce((s, o) => s + (Number(o.marketplaceAmount) || 0), 0);
              return (
                <>
                  {/* Separador de mes */}
                  <tr key={`hdr-${label}`} className="bg-slate-700/70">
                    <td colSpan={11} className="px-4 py-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wide capitalize">
                      {label}
                      <span className="ml-3 font-normal text-slate-400">({items.length} {items.length === 1 ? "orden" : "órdenes"} · a recibir de MundoBeat {CLP.format(gARecibir)})</span>
                    </td>
                  </tr>
                  {items.map((o: any) => {
                    const aRecibir = Number(o.marketplaceAmount) || 0;
                    const comision = Number(o.commissionAmount ?? o.marketplaceCommission) || 0;
                    const ventaProductos = Math.max(0, Number(o.total || 0) - Number(o.shippingCost || 0));
                    return (
                    <tr key={o.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{o.orderNumber}{o.orderSource === "assisted_sale" && <div className="mt-1 font-sans text-xs text-slate-500">Venta asistida · cobro directo</div>}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateOnly(o.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {CLP.format(ventaProductos)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-rose-300">
                        {comision > 0 ? <span title={o.orderSource === "assisted_sale" ? "Comisión original de la venta asistida; el reintegro se muestra por separado" : o.status === "cancelled" ? "Gasto operacional por cancelación" : "Comisión"}>{CLP.format(comision)}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-sky-400">
                        {CLP.format(aRecibir)}
                        {o.orderSource === "assisted_sale" && <div className="mt-1 text-xs font-normal text-slate-500">{o.status === "cancelled" ? `Reintegro: comisión ${CLP.format(Number(o.assistedCommissionRefundAmount) || 0)} + envío ${CLP.format(Number(o.assistedShippingRefundAmount) || 0)}` : "Cobrado directamente por la tienda"}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400">
                        {Number(o.shippingCost) > 0 ? CLP.format(Number(o.shippingCost)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">{statusBadge(o.status)}</td>
                      <td className="px-4 py-3 text-xs">
                        {o.liquidacionNumero ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
                            <CheckCircle size={12} /> {o.liquidacionNumero}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <Clock size={12} /> Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {o.transferStatus === "not_applicable"
                          ? <span className="text-xs text-slate-500">No aplica</span>
                          : o.transferStatus === "pending_shipping_cancellation"
                          ? <span className="text-xs text-amber-400">Por confirmar cancelación del envío</span>
                          : o.pagado != null
                          ? <span className="text-sm font-semibold text-emerald-400" title={`${ACCOUNT_TOOLTIPS.transferido}${o.numeroTransferencia ? ` N° ${o.numeroTransferencia}` : ""}`}>{o.settlementConcept === "assisted_reimbursement" ? "Reintegro transferido" : "Transferido"}</span>
                          : <span className="text-xs text-amber-400">{o.settlementConcept === "assisted_reimbursement" ? "Pendiente de reintegro" : "Pendiente"}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {o.fechaTransferencia
                          ? <span className="text-slate-300" title={o.numeroTransferencia ? `Transferencia ${o.numeroTransferencia}` : undefined}>{formatDateOnly(o.fechaTransferencia)}</span>
                          : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs whitespace-nowrap">
                        {o.status !== "cancelled" ? "—" : o.orderSource === "assisted_sale" ? <span className="text-slate-400">Gestionada directamente por la tienda</span> : o.vendorCustomerRefundStatus === "completed" ? (
                          <span className="font-semibold text-emerald-400" title={o.vendorCustomerRefundReference || undefined}>Devuelto</span>
                        ) : o.vendorPaymentId ? (
                          <span className="font-semibold text-amber-400">Pendiente de devolver</span>
                        ) : (
                          <span className="text-slate-400">Pendiente de liquidación</span>
                        )}
                      </td>
                    </tr>
                  );
                  })}
                </>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-slate-700 text-white font-semibold text-sm border-t-2 border-slate-500">
                <td colSpan={2} className="px-4 py-3 text-slate-300">TOTAL (ventas sin canceladas)</td>
                <td className="px-4 py-3 text-right">{CLP.format(filtered.filter(o => o.status !== "cancelled").reduce((s, o) => s + Math.max(0, Number(o.total || 0) - Number(o.shippingCost || 0)), 0))}</td>
                <td className="px-4 py-3 text-right text-rose-300">{CLP.format(filtered.reduce((s, o) => s + (Number(o.commissionAmount ?? o.marketplaceCommission) || 0), 0))}</td>
                <td className="px-4 py-3 text-right text-sky-300">{CLP.format(totalARecibir)}</td>
                <td className="px-4 py-3 text-right text-slate-400">{CLP.format(totalEnvio)}</td>
                <td />
                <td />
                <td className="px-4 py-3 text-right text-emerald-400">{CLP.format(totalPagado)} transferido<br />{CLP.format(totalPendiente)} pendiente</td>
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ─── Tab Facturación ─── */
function TabFacturacion() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    const loadInvoices = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_URL}/billing/vendor/invoices`, {
          headers: { Authorization: `Bearer ${api.getToken()}` },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "No fue posible cargar las facturas");
        setInvoices(Array.isArray(body) ? body : []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    loadInvoices();
  }, []);

  const total = invoices.filter((invoice) => invoice.status === "issued").reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-cyan-500" /></div>;
  if (error) return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Documentos emitidos</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{invoices.filter((invoice) => invoice.status === "issued").length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Comisiones documentadas</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{CLP.format(total)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="font-semibold text-slate-950">Facturas de comisión</h3>
          <p className="text-xs text-slate-500">Estos montos ya fueron descontados de tus liquidaciones y no requieren un pago adicional.</p>
        </div>
        {invoices.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ReceiptText className="mx-auto mb-3 text-slate-300" size={36} />
            <p className="font-medium text-slate-700">Aún no hay facturas emitidas</p>
            <p className="mt-1 text-sm text-slate-500">Cuando MundoBeat cierre y emita un período, el documento aparecerá aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Período</th><th className="px-4 py-3 text-right">Ventas</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{invoice.invoiceNumber || "Documento"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateOnly(invoice.periodStart)} al {formatDateOnly(invoice.periodEnd)}</td>
                    <td className="px-4 py-3 text-right">{invoice.orderCount}</td>
                    <td className="px-4 py-3 text-right font-semibold">{CLP.format(Number(invoice.totalAmount || 0))}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${invoice.status === "issued" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{invoice.status === "issued" ? "Emitida" : "Anulada"}</span></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => setSelected(invoice)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-sky-50 hover:text-sky-700"><Eye size={14} /> Ver documento</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div><h3 className="text-xl font-bold text-slate-950">{selected.invoiceNumber}</h3><p className="text-sm text-slate-500">Factura interna de comisión del marketplace</p></div>
              <button onClick={() => setSelected(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Cerrar"><X size={18} /></button>
            </div>
            <div className="grid gap-5 py-5 text-sm sm:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase text-slate-500">Datos de facturación</p><p className="mt-2 font-semibold">{selected.billingSnapshot?.legalName}</p><p>{selected.billingSnapshot?.rut}</p><p>{selected.billingSnapshot?.businessActivity}</p><p>{[selected.billingSnapshot?.address, selected.billingSnapshot?.commune, selected.billingSnapshot?.region].filter(Boolean).join(", ")}</p></div>
              <div><p><span className="text-slate-500">Período:</span> {formatDateOnly(selected.periodStart)} al {formatDateOnly(selected.periodEnd)}</p><p><span className="text-slate-500">Forma de pago:</span> Compensada con liquidaciones</p><p><span className="text-slate-500">Fecha de emisión:</span> {selected.issuedAt ? new Date(selected.issuedAt).toLocaleString("es-CL") : "—"}</p></div>
            </div>
            <div className="overflow-hidden rounded-md border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">Orden</th><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-right">Comisión</th></tr></thead><tbody className="divide-y">{(selected.orderDetails || []).map((order: any) => <tr key={order.id}><td className="px-3 py-2">{order.orderNumber}</td><td className="px-3 py-2">{formatDateOnly(order.createdAt)}</td><td className="px-3 py-2 text-right">{CLP.format(Number(order.commission || 0))}</td></tr>)}</tbody></table></div>
            <div className="ml-auto mt-5 max-w-sm border-t border-slate-200 pt-3"><div className="flex justify-between text-base"><span>Comisión total</span><strong>{CLP.format(Number(selected.totalAmount || 0))}</strong></div><p className="mt-2 text-xs text-slate-500">Este monto ya fue compensado en las liquidaciones del período.</p></div>
            {selected.voidReason && <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm"><strong>Motivo de anulación:</strong> {selected.voidReason}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tab Placeholder ─── */
function TabPlaceholder({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-12 text-center">
      <div className="text-5xl mb-4">{emoji}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-sm mx-auto">{desc}</p>
    </div>
  );
}
