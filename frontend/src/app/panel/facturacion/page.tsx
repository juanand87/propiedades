"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, FilePlus2, Loader2, ReceiptText, RefreshCw, XCircle } from "lucide-react";
import { api, API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });

type Invoice = {
  id: string;
  invoiceNumber: string | null;
  status: "draft" | "issued" | "voided";
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  commissionTotal: number;
  totalAmount: number;
  billingSnapshot: Record<string, string | null> | null;
  orderDetails: { id: string; orderNumber: string; createdAt: string; commission: number }[];
  issuedAt: string | null;
  voidReason: string | null;
};

type BillingRow = {
  vendorId: string;
  storeName: string;
  billingEmail: string | null;
  billingProfileComplete: boolean;
  orderCount: number;
  commissionTotal: number;
  orders: Invoice["orderDetails"];
  invoice: Invoice | null;
};

const statusStyle = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  issued: "bg-emerald-50 text-emerald-700 border-emerald-200",
  voided: "bg-slate-100 text-slate-600 border-slate-200",
};

const statusLabel = { draft: "Borrador", issued: "Emitida", voided: "Anulada" };

export default function FacturacionPage() {
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [periodRange, setPeriodRange] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState<{ row: BillingRow; invoice: Invoice } | null>(null);

  const request = async (url: string, options?: RequestInit) => {
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api.getToken()}`,
        ...(options?.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(", ") : body.message || "No fue posible completar la acción");
    return body;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await request(`/billing/admin/preview?period=${period}`);
      setRows(data.rows || []);
      setPeriodRange({ start: data.periodStart, end: data.periodEnd });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => ({
    commission: rows.reduce((sum, row) => sum + Number(row.commissionTotal || 0), 0),
    stores: rows.filter((row) => row.commissionTotal > 0).length,
    drafts: rows.filter((row) => row.invoice?.status === "draft").length,
    issued: rows.filter((row) => row.invoice?.status === "issued").length,
  }), [rows]);

  const mutate = async (
    key: string,
    action: () => Promise<any>,
    success: string | ((result: any) => { type: "ok" | "error"; text: string }),
  ) => {
    setBusy(key);
    setMessage(null);
    try {
      const result = await action();
      setMessage(typeof success === "function" ? success(result) : { type: "ok", text: success });
      await load();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(null);
    }
  };

  const createDraft = (row: BillingRow) => mutate(
    row.vendorId,
    () => request("/billing/admin/drafts", { method: "POST", body: JSON.stringify({ vendorId: row.vendorId, period }) }),
    `Borrador creado para ${row.storeName}.`,
  );

  const issue = (row: BillingRow) => row.invoice && mutate(
    row.invoice.id,
    () => request(`/billing/admin/invoices/${row.invoice!.id}/issue`, { method: "POST" }),
    (result) => result.emailNotification?.sent
      ? { type: "ok", text: `Factura emitida y correo enviado a ${result.emailNotification.recipient}.` }
      : { type: "error", text: `Factura emitida, pero el correo no pudo enviarse: ${result.emailNotification?.reason || "revisa la configuración SMTP"}` },
  );

  const voidInvoice = (row: BillingRow) => {
    if (!row.invoice) return;
    const reason = row.invoice.status === "issued" ? window.prompt("Indica el motivo de anulación:") : "Borrador descartado";
    if (!reason) return;
    mutate(
      row.invoice.id,
      () => request(`/billing/admin/invoices/${row.invoice!.id}/void`, { method: "POST", body: JSON.stringify({ reason }) }),
      `Documento anulado para ${row.storeName}.`,
    );
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Facturación</h1>
          <p className="mt-1 text-sm text-slate-600">Emite el documento mensual por las comisiones ya descontadas a cada tienda.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm font-medium text-slate-700">
            Período
            <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2" />
          </label>
          <Button variant="outline" onClick={load} disabled={loading} title="Actualizar período">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </header>

      {message && (
        <div className={`flex items-center gap-2 rounded-md border px-4 py-3 text-sm ${message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {message.type === "ok" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}{message.text}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Comisiones del período", CLP.format(totals.commission)],
          ["Tiendas a facturar", String(totals.stores)],
          ["Borradores", String(totals.drafts)],
          ["Facturas emitidas", String(totals.issued)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Cierre mensual</h2>
          <p className="text-xs text-slate-500">{periodRange.start && `${new Date(`${periodRange.start}T12:00:00`).toLocaleDateString("es-CL")} al ${new Date(`${periodRange.end}T12:00:00`).toLocaleDateString("es-CL")}`}</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-sky-600" /></div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">No hay comisiones facturables en este período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Tienda</th><th className="px-4 py-3">Datos tributarios</th><th className="px-4 py-3 text-right">Ventas</th><th className="px-4 py-3 text-right">Comisión</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.vendorId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4"><strong className="block text-slate-900">{row.storeName}</strong><span className="text-xs text-slate-500">{row.billingEmail || "Sin correo de facturación"}</span></td>
                    <td className="px-4 py-4">{row.billingProfileComplete ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={15} /> Completos</span> : <span className="inline-flex items-center gap-1 text-amber-700"><AlertCircle size={15} /> Incompletos</span>}</td>
                    <td className="px-4 py-4 text-right text-slate-700">{row.orderCount}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-950">{CLP.format(row.commissionTotal)}</td>
                    <td className="px-4 py-4">{row.invoice ? <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusStyle[row.invoice.status]}`}>{statusLabel[row.invoice.status]}</span> : <span className="text-slate-400">Sin generar</span>}</td>
                    <td className="px-4 py-4"><div className="flex justify-end gap-2">
                      {!row.invoice && <Button size="sm" onClick={() => createDraft(row)} disabled={busy === row.vendorId}><FilePlus2 size={15} /> Crear borrador</Button>}
                      {row.invoice && <Button size="sm" variant="outline" onClick={() => setSelected({ row, invoice: row.invoice! })}><Eye size={15} /> Ver</Button>}
                      {row.invoice?.status === "draft" && <Button size="sm" onClick={() => issue(row)} disabled={!row.billingProfileComplete || busy === row.invoice.id} title={!row.billingProfileComplete ? "La tienda debe completar sus datos tributarios" : "Emitir factura"}><ReceiptText size={15} /> Emitir</Button>}
                      {row.invoice && row.invoice.status !== "voided" && <Button size="sm" variant="outline" onClick={() => voidInvoice(row)} disabled={busy === row.invoice.id} title="Anular documento"><XCircle size={15} /></Button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <InvoiceDialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} row={selected?.row} invoice={selected?.invoice} />
    </div>
  );
}

function InvoiceDialog({ open, onOpenChange, row, invoice }: { open: boolean; onOpenChange: (open: boolean) => void; row?: BillingRow; invoice?: Invoice }) {
  if (!row || !invoice) return null;
  const billing = invoice.billingSnapshot || {};
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{invoice.invoiceNumber || "Borrador de factura"}</DialogTitle></DialogHeader>
        <div className="space-y-5 text-sm">
          <div className="flex items-start justify-between gap-4 border-b pb-4"><div><p className="font-semibold text-slate-950">MundoBeat</p><p className="text-slate-500">Documento interno de comisión del marketplace</p></div><span className={`rounded-full border px-2 py-1 text-xs ${statusStyle[invoice.status]}`}>{statusLabel[invoice.status]}</span></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase text-slate-500">Facturado a</p><p className="mt-1 font-semibold">{billing.legalName || row.storeName}</p><p>{billing.rut || "RUT pendiente"}</p><p>{billing.businessActivity}</p><p>{[billing.address, billing.commune, billing.region].filter(Boolean).join(", ")}</p><p>{billing.email}</p></div><div><p><span className="text-slate-500">Período:</span> {invoice.periodStart} al {invoice.periodEnd}</p><p><span className="text-slate-500">Ventas incluidas:</span> {invoice.orderCount}</p><p><span className="text-slate-500">Forma de pago:</span> Compensada con liquidaciones</p>{invoice.issuedAt && <p><span className="text-slate-500">Emitida:</span> {new Date(invoice.issuedAt).toLocaleString("es-CL")}</p>}</div></div>
          <div className="overflow-hidden rounded-md border"><table className="w-full"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 text-left">Orden</th><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-right">Comisión</th></tr></thead><tbody className="divide-y">{(invoice.orderDetails || []).map((order) => <tr key={order.id}><td className="px-3 py-2">{order.orderNumber}</td><td className="px-3 py-2">{new Date(order.createdAt).toLocaleDateString("es-CL")}</td><td className="px-3 py-2 text-right">{CLP.format(order.commission)}</td></tr>)}</tbody></table></div>
          <div className="ml-auto max-w-xs border-t pt-3"><div className="flex justify-between gap-12"><span>Comisión total</span><strong>{CLP.format(invoice.totalAmount)}</strong></div><p className="mt-2 text-xs text-slate-500">Monto ya descontado de las liquidaciones del período. Este documento no genera un pago adicional.</p></div>
          {invoice.voidReason && <div className="rounded-md bg-slate-100 p-3 text-slate-700"><strong>Motivo de anulación:</strong> {invoice.voidReason}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
