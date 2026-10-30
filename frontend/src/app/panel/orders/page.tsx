"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarDays, ExternalLink, Loader2, Mail, MapPin, Package, Send, Star, Store, UserRound } from "lucide-react";
import { getBackendAssetUrl } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const statusMap: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pendiente", badge: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Pagado", badge: "bg-green-100 text-green-800" },
  processing: { label: "Procesando", badge: "bg-blue-100 text-blue-800" },
  shipped: { label: "Enviado", badge: "bg-purple-100 text-purple-800" },
  delivered: { label: "Completado", badge: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", badge: "bg-red-100 text-red-800" },
  refunded: { label: "Reembolsado", badge: "bg-indigo-100 text-indigo-800" },
};

const paymentStatusMap: Record<string, { label: string; badge: string }> = {
  payment_error: { label: "Error de pago", badge: "bg-rose-100 text-rose-800" },
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

type TabType = "marketplace" | "stores" | "cancellations";

const mundoBeatSources = new Set(["marketplace", "direct_store", "custom_domain", "assisted_sale", ""]);

const channelLabels: Record<string, string> = {
  mundobeat: "MundoBeat",
  mercadolibre: "Mercado Libre",
  woocommerce: "WooCommerce",
  falabella: "Falabella",
  paris: "Paris",
  pos: "Punto de venta",
};

const getChannelKey = (order: any) => {
  const source = String(order.orderSource || "").toLowerCase();
  return mundoBeatSources.has(source) ? "mundobeat" : source || "mundobeat";
};

const getChannelLabel = (order: any) => channelLabels[getChannelKey(order)] || order.orderSource || "Otro canal";

export default function AdminOrdersPage() {
  const [activeTab, setActiveTab] = useState<TabType>("marketplace");
  const [marketplaceOrders, setMarketplaceOrders] = useState<any[]>([]);
  const [storesOrders, setStoresOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewFiles, setReviewFiles] = useState<Record<string, File | null>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [syncingRefundId, setSyncingRefundId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState("all");
  const [reviewDialogOrder, setReviewDialogOrder] = useState<any | null>(null);
  const [reviewSending, setReviewSending] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    setError("");

    try {
      const [marketplaceData, storesData] = await Promise.all([
        api.getMarketplaceOrders(),
        api.getVendorStoresOrders(),
      ]);
      setMarketplaceOrders(marketplaceData);
      setStoresOrders(storesData);
    } catch (err: any) {
      console.error("Error cargando pedidos:", err);
      setError(err.message || "No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  };

  const getBadgeMeta = (order: any) => {
    if (order.paymentStatus && paymentStatusMap[order.paymentStatus]) {
      return paymentStatusMap[order.paymentStatus];
    }
    return statusMap[order.status] || { label: order.status, badge: "bg-gray-100 text-gray-800" };
  };

  const visibleOrders = activeTab === "marketplace" ? marketplaceOrders : storesOrders;
  const availableChannels = useMemo(() => {
    return [...new Set(visibleOrders.map(getChannelKey))].sort((a, b) =>
      (channelLabels[a] || a).localeCompare(channelLabels[b] || b, "es"),
    );
  }, [visibleOrders]);
  const filteredOrders = channelFilter === "all"
    ? visibleOrders
    : visibleOrders.filter((order) => getChannelKey(order) === channelFilter);

  const sendReviewRequest = async () => {
    if (!reviewDialogOrder) return;
    setReviewSending(true);
    setError("");
    try {
      await api.post(`/reviews/admin/order/${reviewDialogOrder.id}/send`, {});
      setReviewDialogOrder(null);
      await loadOrders();
    } catch (err: any) {
      setError(err.message || "No se pudo enviar el correo de calificación");
    } finally {
      setReviewSending(false);
    }
  };

  const cancellations = marketplaceOrders
    .filter((order) => order.status === 'cancelled')
    .sort((a, b) => Number(b.cancellationReviewStatus === 'pending') - Number(a.cancellationReviewStatus === 'pending') || new Date(b.cancelledAt || b.createdAt).getTime() - new Date(a.cancelledAt || a.createdAt).getTime());
  const recentVendorCounts = new Map<string, number>();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const order of cancellations) {
    if (order.orderSource !== 'assisted_sale' && new Date(order.cancelledAt || order.createdAt).getTime() >= thirtyDaysAgo && order.cancellationReviewStatus !== 'justified') {
      recentVendorCounts.set(order.vendorId, (recentVendorCounts.get(order.vendorId) || 0) + 1);
    }
  }
  const pendingCancellations = cancellations.filter((order) => order.cancellationReviewStatus === 'pending');
  const vendorRefundsPending = cancellations.filter((order) => order.orderSource !== 'assisted_sale' && order.paymentStatus === 'approved' && order.vendorCustomerRefundStatus !== 'completed' && !order.refund);

  const formatDateTime = (value?: string) => value
    ? new Date(value).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
    : 'No registrada';

  const getOrderSourceLabel = (order: any) => {
    if (order.orderSource === 'marketplace' || order.isMarketplaceSale) return 'Marketplace';
    if (order.orderSource === 'pos') return 'Punto de venta';
    if (order.orderSource === 'assisted_sale') return 'Venta asistida';
    if (order.orderSource === 'custom_domain') return 'Dominio propio';
    return 'Tienda online';
  };

  const reviewCancellation = async (orderId: string, status: 'justified' | 'vendor_responsible') => {
    if (status === 'justified' && !reviewFiles[orderId]) {
      setError('Debes adjuntar un respaldo para marcar la cancelación como justificada');
      return;
    }
    setReviewingId(orderId);
    setError('');
    try {
      await api.reviewOrderCancellation(orderId, status, reviewNotes[orderId] || '', reviewFiles[orderId] || undefined);
      await loadOrders();
    } catch (err: any) {
      setError(err.message || 'No se pudo revisar la cancelación');
    } finally {
      setReviewingId(null);
    }
  };

  const sendWarning = async (orderId: string) => {
    if (!window.confirm('¿Enviar una advertencia por correo a esta tienda?')) return;
    setReviewingId(orderId);
    setError('');
    try {
      await api.sendOrderCancellationWarning(orderId);
      await loadOrders();
    } catch (err: any) {
      setError(err.message || 'No se pudo enviar la advertencia');
    } finally {
      setReviewingId(null);
    }
  };

  const updateRefund = async (orderId: string, action: 'sync' | 'retry') => {
    setSyncingRefundId(orderId);
    setError('');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/refund/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'No se pudo actualizar el reembolso');
      await loadOrders();
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar el reembolso');
    } finally {
      setSyncingRefundId(null);
    }
  };

  const confirmAssistedShippingCancellation = async (orderId: string) => {
    if (!window.confirm('¿Confirmas que la etiqueta fue anulada o acreditada por el transportista?')) return;
    setReviewingId(orderId);
    setError('');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/assisted-reimbursement/confirm-shipping-cancellation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'No se pudo confirmar la anulación de la etiqueta');
      await loadOrders();
    } catch (err: any) {
      setError(err.message || 'No se pudo confirmar la anulación de la etiqueta');
    } finally {
      setReviewingId(null);
    }
  };

  const refundStatusLabel: Record<string, string> = {
    pending_submission: 'Pendiente de enviar',
    submitted: 'Solicitud registrada',
    processing: 'Procesando en Payku',
    awaiting_funds: 'Esperando fondos',
    waiting_bank_details: 'Payku espera datos del cliente',
    refunded: 'Reembolsado',
    failed: 'Requiere atención',
    manual_review: 'Revisión manual',
    not_required: 'No requiere reembolso',
  };

  const renderCancellations = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{pendingCancellations.length} cancelaciones pendientes de revisión · {vendorRefundsPending.length} devoluciones pendientes por tiendas. Tres o más cancelaciones atribuibles en 30 días requieren atención prioritaria; no generan sanciones automáticas.</p>
      {cancellations.length === 0 && <p className="py-8 text-center text-gray-500">No hay cancelaciones de tiendas para revisar.</p>}
      {cancellations.map((order) => {
        const vendor = order.items?.[0]?.product?.vendor;
        const vendorName = vendor?.storeName || vendor?.name || order.vendorSlug || order.vendorId || 'Tienda no identificada';
        const recentCount = recentVendorCounts.get(order.vendorId) || 0;
        const itemCount = order.items?.reduce((total: number, item: any) => total + Number(item.quantity || 0), 0) || 0;
        const productNames = order.items?.map((item: any) => item.product?.name || item.productName).filter(Boolean) || [];
        const customerName = order.shippingName || order.guestData?.name || 'Cliente no identificado';
        const customerEmail = order.customerEmail || order.guestData?.email;
        const location = [order.shippingCommune || order.shippingCity, order.shippingRegion].filter(Boolean).join(', ');
        const refund = order.refund;
        return (
          <div key={order.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/panel/orders/${order.id}`} className="font-semibold text-blue-700 hover:underline">Orden {order.orderNumber}</Link>
                  <span className="text-sm font-medium text-gray-900">{currencyFormatter.format(Number(order.total || 0))}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">Venta realizada: {formatDateTime(order.createdAt)} · {getOrderSourceLabel(order)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {recentCount >= 3 && <Badge className="bg-amber-100 text-amber-900">Revisar: {recentCount} en 30 días</Badge>}
                <Badge className={order.cancellationReviewStatus === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}>
                  {order.orderSource === 'assisted_sale' ? 'Venta asistida' : order.cancellationReviewStatus === 'pending' ? 'Pendiente' : order.cancellationReviewStatus === 'justified' ? 'Justificada' : order.cancellationReviewStatus === 'vendor_responsible' ? 'Responsabilidad de la tienda' : 'Sin revisión requerida'}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex min-w-0 gap-2">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-gray-500">Tienda</p>
                  <p className="truncate text-sm font-semibold text-gray-900">{vendorName}</p>
                  {order.vendorSlug && <p className="truncate text-xs text-gray-500">{order.vendorSlug}</p>}
                </div>
              </div>
              <div className="flex min-w-0 gap-2">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-gray-500">Cliente</p>
                  <p className="truncate text-sm font-medium text-gray-900">{customerName}</p>
                  {customerEmail && <p className="truncate text-xs text-gray-500">{customerEmail}</p>}
                </div>
              </div>
              <div className="flex min-w-0 gap-2">
                <Package className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-gray-500">Productos</p>
                  <p className="text-sm font-medium text-gray-900">{itemCount} {itemCount === 1 ? 'unidad' : 'unidades'}</p>
                  {productNames.length > 0 && <p className="line-clamp-2 text-xs text-gray-500">{productNames.join(', ')}</p>}
                </div>
              </div>
              <div className="flex min-w-0 gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-gray-500">Cancelación</p>
                  <p className="text-sm font-medium text-gray-900">{formatDateTime(order.cancelledAt)}</p>
                  {location && <p className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3 w-3" />{location}</p>}
                </div>
              </div>
            </div>

            <div className="mx-4 mb-4 border-l-4 border-amber-400 bg-amber-50 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <p className="text-xs font-medium uppercase text-amber-800">Motivo informado</p>
                  <p className="text-sm font-semibold text-gray-900">{order.cancellationReason || 'Sin motivo registrado'}</p>
                  {order.cancellationNote && <p className="mt-1 text-sm text-gray-700">{order.cancellationNote}</p>}
                  {order.cancelledById && <p className="mt-1 text-xs text-gray-500">Usuario que canceló: {order.cancelledById}</p>}
                </div>
              </div>
            </div>

            {refund && (
              <div className="mx-4 mb-4 border-l-4 border-blue-500 bg-blue-50 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-blue-800">Historial anterior de reembolso Payku</p>
                    <p className="text-sm font-semibold text-gray-900">{refundStatusLabel[refund.status] || refund.status} · {currencyFormatter.format(Number(refund.amount || 0))}</p>
                    {refund.paykuStatus && <p className="mt-1 text-xs text-gray-600">Estado Payku: {refund.paykuStatus}</p>}
                    {refund.requestedAt && <p className="text-xs text-gray-600">Solicitado: {formatDateTime(refund.requestedAt)}</p>}
                    {refund.completedAt && <p className="text-xs text-gray-600">Completado: {formatDateTime(refund.completedAt)}</p>}
                    {refund.errorMessage && <p className="mt-1 text-sm text-red-700">{refund.errorMessage}</p>}
                  </div>
                  <div className="flex gap-2">
                    {['submitted', 'processing', 'awaiting_funds', 'waiting_bank_details'].includes(refund.status) && (
                      <Button size="sm" variant="outline" disabled={syncingRefundId === order.id} onClick={() => updateRefund(order.id, 'sync')}>Sincronizar</Button>
                    )}
                    {['failed', 'manual_review', 'pending_submission'].includes(refund.status) && (
                      <Button size="sm" disabled={syncingRefundId === order.id} onClick={() => updateRefund(order.id, 'retry')}>Reintentar</Button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {order.orderSource === 'assisted_sale' && (
              <div className="mx-4 mb-4 border-l-4 border-sky-500 bg-sky-50 px-3 py-3">
                <p className="text-xs font-medium uppercase text-sky-800">Cancelación de venta asistida</p>
                <p className="mt-1 text-sm text-gray-800">La tienda gestiona directamente la devolución al comprador. No requiere comprobante en MundoBeat y no genera puntos.</p>
                <div className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
                  <p>Comisión: <strong>{currencyFormatter.format(Number(order.assistedCommissionRefundAmount || 0))}</strong></p>
                  <p>Envío: <strong>{currencyFormatter.format(Number(order.assistedShippingRefundAmount || 0))}</strong></p>
                  <p>Total a tienda: <strong>{currencyFormatter.format(Number(order.assistedReimbursementAmount || 0))}</strong></p>
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  {order.assistedReimbursementStatus === 'pending_shipping_cancellation' && 'Pendiente de confirmar la anulación o crédito de la etiqueta.'}
                  {order.assistedReimbursementStatus === 'pending_payment' && 'Reintegro habilitado en Depósitos Tiendas.'}
                  {order.assistedReimbursementStatus === 'paid' && 'Reintegro pagado a la tienda.'}
                  {order.assistedReimbursementStatus === 'not_required' && 'No hubo cobro de plataforma; no requiere reintegro.'}
                </p>
                {order.assistedReimbursementStatus === 'pending_shipping_cancellation' && (
                  <Button className="mt-3" size="sm" disabled={reviewingId === order.id} onClick={() => confirmAssistedShippingCancellation(order.id)}>
                    Confirmar anulación de etiqueta
                  </Button>
                )}
              </div>
            )}
            {!refund && order.orderSource !== 'assisted_sale' && order.paymentStatus === 'approved' && (
              <div className={`mx-4 mb-4 border-l-4 px-3 py-3 ${order.vendorCustomerRefundStatus === 'completed' ? 'border-emerald-500 bg-emerald-50' : 'border-amber-500 bg-amber-50'}`}>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-700">Devolución a cargo de la tienda</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {order.vendorCustomerRefundStatus === 'completed' ? 'Devuelto al comprador' : order.vendorPaymentId ? 'Pendiente de devolución' : 'Pendiente de liquidación a la tienda'} · {currencyFormatter.format(Number(order.vendorCustomerRefundAmount ?? order.total ?? 0))}
                  </p>
                  {order.vendorCustomerRefundReference && <p className="text-xs text-gray-700">Referencia: {order.vendorCustomerRefundReference}</p>}
                  {order.vendorCustomerRefundedAt && <p className="text-xs text-gray-700">Fecha: {formatDateTime(order.vendorCustomerRefundedAt)}</p>}
                  {order.vendorCustomerRefundProof && <a href={getBackendAssetUrl(order.vendorCustomerRefundProof)} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-700 underline">Ver comprobante</a>}
                </div>
              </div>
            )}

            {order.cancellationReviewNote && <p className="mx-4 mb-3 text-sm text-gray-600"><span className="font-medium">Nota de revisión:</span> {order.cancellationReviewNote}</p>}
            {order.cancellationVerificationUrl && <p className="mx-4 mb-3 text-sm"><a href={getBackendAssetUrl(order.cancellationVerificationUrl)} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">Ver respaldo de la cancelación justificada</a></p>}
            {order.cancellationReviewStatus === 'pending' && (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-4 py-3">
                <input
                  value={reviewNotes[order.id] || ''}
                  onChange={(event) => setReviewNotes((notes) => ({ ...notes, [order.id]: event.target.value }))}
                  placeholder="Nota interna de revisión"
                  aria-label={`Nota interna para ${order.orderNumber}`}
                  className="min-w-48 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <label className="text-xs text-gray-600">
                  Respaldo obligatorio para justificar
                  <input type="file" accept="image/*,.pdf" onChange={(event) => setReviewFiles((files) => ({ ...files, [order.id]: event.target.files?.[0] || null }))} className="mt-1 block max-w-64 text-xs" />
                </label>
                <Button size="sm" variant="outline" disabled={reviewingId === order.id} onClick={() => reviewCancellation(order.id, 'justified')}>Justificada</Button>
                <Button size="sm" disabled={reviewingId === order.id} onClick={() => reviewCancellation(order.id, 'vendor_responsible')}>Responsabilidad de la tienda</Button>
              </div>
            )}
            {order.cancellationReviewStatus === 'vendor_responsible' && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-3">
                {order.cancellationWarningSentAt ? (
                  <p className="text-xs text-gray-500">Advertencia enviada: {new Date(order.cancellationWarningSentAt).toLocaleString('es-CL')}</p>
                ) : (
                  <Button size="sm" variant="outline" disabled={reviewingId === order.id} onClick={() => sendWarning(order.id)}>Enviar advertencia por correo</Button>
                )}
                <Link href={`/panel/orders/${order.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">Ver pedido completo <ExternalLink className="h-3.5 w-3.5" /></Link>
              </div>
            )}
            {order.cancellationReviewStatus === 'justified' && (
              <div className="flex justify-end border-t border-gray-200 px-4 py-3">
                <Link href={`/panel/orders/${order.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">Ver pedido completo <ExternalLink className="h-3.5 w-3.5" /></Link>
              </div>
            )}
            {order.orderSource === 'assisted_sale' && (
              <div className="flex justify-end border-t border-gray-200 px-4 py-3">
                <Link href={`/panel/orders/${order.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">Ver pedido completo <ExternalLink className="h-3.5 w-3.5" /></Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderOrders = (orders: any[]) => {
    if (loading) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin w-6 h-6" />
          </CardContent>
        </Card>
      );
    }

    if (orders.length === 0) {
      return (
        <Card>
          <CardContent className="text-center space-y-2 py-8">
            <p className="text-lg font-semibold">
              {activeTab === "marketplace" ? "Sin pedidos del marketplace" : "Sin pedidos de tiendas"}
            </p>
            <p className="text-sm text-gray-500">
              {activeTab === "marketplace"
                ? "No hay pedidos directos en el marketplace aún."
                : "No hay pedidos de tiendas de vendedores aún."}
            </p>
          </CardContent>
        </Card>
      );
    }

    const getReviewCell = (order: any) => {
      const review = order.reviewStatus;
      if (review?.status === "submitted" && review.rating) {
        return (
          <div className="flex items-center gap-1.5 font-semibold text-amber-700">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {Number(review.rating).toFixed(1)}
          </div>
        );
      }

      const emailCount = Number(review?.emailCount || 0);
      if (emailCount >= 2) {
        return <span className="text-sm font-medium text-gray-500">No calificada</span>;
      }

      const shippingDelivered = order.enviaShippingStatus === "delivered"
        || order.shipments?.some((shipment: any) => shipment.status === "delivered" || shipment.enviaShippingStatus === "delivered");
      const reviewable = ["marketplace", "assisted_sale"].includes(String(order.orderSource || ""))
        && order.status === "delivered"
        && shippingDelivered
        && Boolean(String(order.customerEmail || order.guestData?.email || "").trim());

      if (!reviewable) {
        return <span className="text-sm text-gray-400">No disponible</span>;
      }

      return (
        <button
          type="button"
          onClick={() => setReviewDialogOrder(order)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
        >
          <Mail className="h-4 w-4" />
          {emailCount} de 2 correos
        </button>
      );
    };

    return (
      <div className="overflow-hidden border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">Orden</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3 text-right">Valor total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Envío</th>
                <th className="px-4 py-3">Calificación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => {
                const badgeMeta = getBadgeMeta(order);
                const tracking = order.enviaTrackingNumber || order.trackingNumber;
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 align-top">
                      <Link href={`/panel/orders/${order.id}`} className="font-semibold text-blue-700 hover:underline">
                        #{order.orderNumber}
                      </Link>
                      <p className="mt-0.5 max-w-52 truncate text-xs text-gray-500">{order.shippingName || "Cliente no informado"}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-gray-700">
                      {new Date(order.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      <p className="mt-0.5 text-xs text-gray-500">{new Date(order.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</p>
                    </td>
                    <td className="px-4 py-3 align-top font-medium text-gray-700">{getChannelLabel(order)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-top font-semibold text-gray-950">{currencyFormatter.format(Number(order.total || 0))}</td>
                    <td className="px-4 py-3 align-top"><Badge className={badgeMeta.badge}>{badgeMeta.label}</Badge></td>
                    <td className="px-4 py-3 align-top">
                      <p className="max-w-56 truncate font-medium text-gray-800">{order.shippingMethod || "Sin método"}</p>
                      {tracking && <p className="mt-0.5 max-w-56 truncate font-mono text-xs text-gray-500">Guía: {tracking}</p>}
                    </td>
                    <td className="px-4 py-3 align-top">{getReviewCell(order)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Órdenes</h1>
          <p className="text-gray-600 mt-1">Administración de pedidos</p>
        </div>
        <Button variant="outline" onClick={loadOrders} disabled={loading}>
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : "Actualizar"}
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="text-red-600 pt-6">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => { setActiveTab("marketplace"); setChannelFilter("all"); }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "marketplace"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Marketplace ({marketplaceOrders.length})
        </button>
        <button
          onClick={() => { setActiveTab("stores"); setChannelFilter("all"); }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "stores"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Tiendas ({storesOrders.length})
        </button>
        <button
          onClick={() => { setActiveTab("cancellations"); setChannelFilter("all"); }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'cancellations' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
        >
          Cancelaciones y devoluciones ({pendingCancellations.length + vendorRefundsPending.length})
        </button>
      </div>

      {activeTab !== "cancellations" && (
        <div className="flex flex-wrap items-end justify-between gap-3 border border-gray-200 bg-white px-4 py-3">
          <label className="space-y-1 text-sm font-medium text-gray-700">
            <span>Canal de venta</span>
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              className="block h-10 min-w-60 border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">Todos los canales</option>
              {availableChannels.map((channel) => (
                <option key={channel} value={channel}>{channelLabels[channel] || channel}</option>
              ))}
            </select>
          </label>
          <p className="text-sm text-gray-500">{filteredOrders.length} {filteredOrders.length === 1 ? "orden" : "órdenes"}</p>
        </div>
      )}

      {/* Orders list */}
      {activeTab === 'cancellations' ? renderCancellations() : renderOrders(filteredOrders)}

      <Dialog open={Boolean(reviewDialogOrder)} onOpenChange={(open) => !open && !reviewSending && setReviewDialogOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar solicitud de calificación</DialogTitle>
            <DialogDescription>
              Se enviará un correo al comprador de la orden #{reviewDialogOrder?.orderNumber} para que califique la tienda.
            </DialogDescription>
          </DialogHeader>
          <div className="border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <p className="font-medium text-gray-900">{reviewDialogOrder?.shippingName || "Comprador"}</p>
            <p className="mt-1 text-gray-600">{reviewDialogOrder?.reviewStatus?.emailCount || 0} de 2 correos enviados</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewDialogOrder(null)} disabled={reviewSending}>Cancelar</Button>
            <Button type="button" onClick={sendReviewRequest} disabled={reviewSending}>
              {reviewSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {reviewDialogOrder?.reviewStatus?.emailCount ? "Reenviar correo" : "Enviar correo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
