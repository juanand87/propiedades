"use client";

import { useState, useEffect, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Package, Phone, Mail, Trash2, Plus, Minus, Send, Star, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getBackendAssetUrl, getImageUrl } from "@/lib/utils";
import { RefundStatusPanel } from "@/components/orders/RefundStatusPanel";

const statusOptions = [
  { value: "pending", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "processing", label: "Procesando" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
];

const cancellationReasons = ['Quiebre de stock', 'Cliente solicitó cancelación', 'Error en publicación', 'No puedo despachar', 'Otro'];

const externalShippingReasonLabels: Record<string, string> = {
  no_coverage: 'Envia.com no tiene cobertura',
  platform_error: 'Error en la plataforma',
  buyer_agreement: 'Acuerdo especial con el comprador',
  other: 'Otro motivo',
};

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Pagado", className: "bg-green-100 text-green-800" },
  processing: { label: "Procesando", className: "bg-blue-100 text-blue-800" },
  shipped: { label: "Enviado", className: "bg-violet-100 text-violet-800" },
  delivered: { label: "Completado", className: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelado", className: "bg-rose-100 text-rose-800" },
  refunded: { label: "Reembolsado", className: "bg-indigo-100 text-indigo-800" },
};

const paymentStatusBadge: Record<string, { label: string; className: string }> = {
  payment_error: { label: "Error de pago", className: "bg-rose-50 text-rose-700" },
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

export default function VendorOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("pending");
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationNote, setCancellationNote] = useState('');
  const [tracking, setTracking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Envia.com Manual Sync
  const [syncingTracking, setSyncingTracking] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const isAdmin = true;

  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  const loadOrder = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api.getOrder(orderId);
      setOrder(data);
      setStatus(data.status);
      setTracking(data.enviaTrackingNumber || data.trackingNumber || "");
      if (isAdmin) await loadReviewStatus();
    } catch (err: any) {
      console.error("Error cargando el pedido:", err);
      setError(err.message || "No se pudo cargar el pedido");
    } finally {
      setLoading(false);
    }
  };

  const loadReviewStatus = async () => {
    if (!isAdmin || !orderId) return;
    setReviewLoading(true);
    setReviewError("");
    try {
      setReviewStatus(await api.get(`/reviews/admin/order/${orderId}`));
    } catch (err: any) {
      setReviewError(err.message || "No se pudo consultar la calificación");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSendReviewRequest = async () => {
    setReviewSending(true);
    setReviewError("");
    try {
      const result = await api.post(`/reviews/admin/order/${orderId}/send`, {});
      setReviewStatus(result);
      setMessage(result.emailCount > 1
        ? "Correo de calificación reenviado correctamente."
        : "Solicitud de calificación enviada correctamente.");
    } catch (err: any) {
      setReviewError(err.message || "No se pudo enviar el correo de calificación");
    } finally {
      setReviewSending(false);
    }
  };

  const getStatusBadge = () => {
    if (order?.paymentStatus && paymentStatusBadge[order.paymentStatus]) {
      return paymentStatusBadge[order.paymentStatus];
    }
    return statusBadge[order?.status] || { label: order?.status || "Desconocido", className: "bg-gray-100 text-gray-800" };
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (status !== order.status) {
        if (status === 'cancelled') {
          if (!cancellationReason || (cancellationReason === 'Otro' && !cancellationNote.trim())) {
            throw new Error('Indica el motivo de cancelación');
          }
          await api.cancelOrder(order.id, cancellationReason, cancellationNote);
        } else {
          await api.updateOrderStatus(order.id, status);
        }
      }
      const savedTracking = order.enviaTrackingNumber || order.trackingNumber || "";
      if (!savedTracking && tracking !== savedTracking) {
        await api.updateOrderTracking(order.id, tracking);
      }

      const refreshed = await api.getOrder(orderId);
      setOrder(refreshed);
      setStatus(refreshed.status);
      setTracking(refreshed.enviaTrackingNumber || refreshed.trackingNumber || "");
      setMessage("Cambios guardados correctamente.");
      if (isAdmin) await loadReviewStatus();
    } catch (err: any) {
      console.error("Error guardando cambios:", err);
      setError(err.message || "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!order || !confirm("¿Estás seguro de eliminar este producto del pedido?")) return;
    
    setUpdatingItem(itemId);
    setError("");
    
    try {
      await api.removeOrderItem(order.id, itemId);
      const refreshed = await api.getOrder(orderId);
      setOrder(refreshed);
      setMessage("Producto eliminado correctamente.");
    } catch (err: any) {
      console.error("Error eliminando producto:", err);
      setError(err.message || "No se pudo eliminar el producto");
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (!order || newQuantity < 1) return;
    
    setUpdatingItem(itemId);
    setError("");
    
    try {
      await api.updateOrderItem(order.id, itemId, newQuantity);
      const refreshed = await api.getOrder(orderId);
      setOrder(refreshed);
      setMessage("Cantidad actualizada correctamente.");
    } catch (err: any) {
      console.error("Error actualizando cantidad:", err);
      setError(err.message || "No se pudo actualizar la cantidad");
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleSyncTracking = async () => {
    if (!order?.id) return;

    setSyncingTracking(true);
    setMessage("");
    setError("");

    try {
      const response = await api.post(`/shipping/envia/sync-order/${order.id}`, {});
      setSyncResult(response);
      setShowSyncModal(true);

      // Si el estado cambió, recargar la orden
      if (response.statusChanged) {
        const refreshed = await api.getOrder(orderId);
        setOrder(refreshed);
        setStatus(refreshed.status);
      }
    } catch (err: any) {
      console.error("Error sincronizando tracking:", err);
      setSyncResult({
        success: false,
        message: err.message || "Error al sincronizar el tracking",
        statusChanged: false,
      });
      setShowSyncModal(true);
    } finally {
      setSyncingTracking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-3 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-lg font-semibold">No se pudo cargar el pedido</p>
          <p className="text-sm text-gray-600">{error}</p>
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => router.back()}>
              Volver
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const badgeMeta = getStatusBadge();
  const savedTrackingNumber = String(order.enviaTrackingNumber || order.trackingNumber || "").trim();
  const contactEmail = String(
    order.shippingEmail
      || order.customerEmail
      || order.guestData?.email
      || order.customer?.email
      || "",
  ).trim();
  const orderDate = new Date(order.createdAt).toLocaleString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pedido #{order.orderNumber}</h1>
          <p className="text-gray-600 mt-1">{orderDate}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={badgeMeta.className}>{badgeMeta.label}</Badge>
          <Link href="/panel/orders" className="text-sm text-gray-500 hover:text-gray-900">
            Volver a pedidos
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 space-y-4">
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p className="text-xs text-gray-400">Total</p>
                <p className="text-lg font-semibold text-gray-900">
                  {currencyFormatter.format(order.total)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Pago</p>
                <p className="font-medium text-gray-800 capitalize">
                  {order.paymentMethod || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Método de envío</p>
                <p className="font-medium text-gray-800">{order.shippingMethod || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Cliente</p>
                <p className="font-medium text-gray-800">{order.shippingName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="space-y-4">
          <CardHeader>
            <CardTitle>Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>{order.shippingAddress}</p>
            <p>
              {order.shippingCity}, {order.shippingCountry}
            </p>
            <p className="flex items-center gap-1">
              <Phone className="w-4 h-4" /> {order.shippingPhone}
            </p>
            <p className="flex items-center gap-1">
              <Mail className="w-4 h-4 shrink-0" />
              {contactEmail ? (
                <a href={`mailto:${contactEmail}`} className="break-all hover:text-blue-700 hover:underline">
                  {contactEmail}
                </a>
              ) : (
                <span>Sin correo registrado</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" /> Calificación de la venta
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviewLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Consultando calificación...</div>
            ) : reviewStatus?.state === "submitted" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex" aria-label={`${reviewStatus.rating} de 5 estrellas`}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star key={value} className={`h-5 w-5 ${value <= reviewStatus.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                    ))}
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800">Calificada</Badge>
                  {reviewStatus.submittedAt && <span className="text-xs text-gray-500">{new Date(reviewStatus.submittedAt).toLocaleString("es-CL")}</span>}
                </div>
                <p className="text-sm text-gray-700">{reviewStatus.comment || "El comprador no agregó un comentario."}</p>
                <p className="text-xs text-gray-500">El comentario es privado para la tienda y la administración.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={reviewStatus?.eligible ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}>
                      {reviewStatus?.emailCount ? "Esperando calificación" : reviewStatus?.eligible ? "Lista para enviar" : "No disponible"}
                    </Badge>
                    {reviewStatus?.emailCount > 0 && <span className="text-xs text-gray-500">{reviewStatus.emailCount} de 2 correos enviados</span>}
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{reviewStatus?.message || "Consultando disponibilidad."}</p>
                  {reviewStatus?.lastEmailSentAt && <p className="mt-1 text-xs text-gray-500">Último envío: {new Date(reviewStatus.lastEmailSentAt).toLocaleString("es-CL")}</p>}
                </div>
                {reviewStatus?.canSend && (
                  <Button type="button" onClick={handleSendReviewRequest} disabled={reviewSending} className="shrink-0">
                    {reviewSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {reviewStatus.emailCount ? "Reenviar correo" : "Enviar solicitud"}
                  </Button>
                )}
              </div>
            )}
            {reviewError && <p className="mt-3 text-sm font-medium text-red-600">{reviewError}</p>}
          </CardContent>
        </Card>
      )}

      {order.shippingHandledBy === 'vendor' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-amber-600" /> Envío gestionado por la tienda</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div><p className="text-gray-500">Courier</p><p className="font-semibold">{order.externalShippingCarrier || '—'}</p></div>
            <div><p className="text-gray-500">Número de seguimiento</p><p className="font-mono font-semibold">{order.trackingNumber || '—'}</p></div>
            <div><p className="text-gray-500">Motivo</p><p className="font-semibold">{externalShippingReasonLabels[order.externalShippingReason] || order.externalShippingReason || '—'}</p></div>
            <div><p className="text-gray-500">Monto de envío</p><p className="font-semibold">{currencyFormatter.format(Number(order.externalShippingPayoutAmount) || 0)}</p></div>
            {order.externalShippingReasonDetail && <div className="sm:col-span-2"><p className="text-gray-500">Detalle</p><p className="whitespace-pre-wrap">{order.externalShippingReasonDetail}</p></div>}
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              {order.externalShippingEvidenceUrl && <Button type="button" variant="outline" size="sm" onClick={() => window.open(getBackendAssetUrl(order.externalShippingEvidenceUrl), '_blank', 'noopener,noreferrer')}>Ver captura</Button>}
              {order.externalShippingTrackingUrl && <Button type="button" variant="outline" size="sm" onClick={() => window.open(order.externalShippingTrackingUrl, '_blank', 'noopener,noreferrer')}>Rastrear envío</Button>}
              <Badge className={['eligible', 'paid'].includes(order.externalShippingPayoutStatus) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                {order.externalShippingPayoutStatus === 'paid' ? 'Envío incluido en liquidación pagada' : order.externalShippingPayoutStatus === 'eligible' ? 'Envío habilitado para liquidación' : 'Envío retenido hasta confirmar entrega'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Productos ({order.items?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.items?.map((item: any) => (
            <div key={item.id} className="flex items-center gap-4 border-b pb-3 last:border-0">
              <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                {item.productImage ? (
                  <img
                    src={getImageUrl(item.productImage)}
                    alt={item.productTitle}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-gray-400">🎵</div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{item.productTitle}</p>
                <p className="text-sm text-gray-600">
                  {currencyFormatter.format(item.price)} c/u
                </p>
              </div>
              {(status === "pending" || status === "paid") ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={updatingItem === item.id || item.quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">{item.quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                    disabled={updatingItem === item.id}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={updatingItem === item.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Cantidad: {item.quantity}
                </p>
              )}
              <p className="font-semibold text-gray-900 w-24 text-right">
                {currencyFormatter.format(item.subtotal)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <form onSubmit={handleSave} className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 space-y-4">
          <CardHeader>
            <CardTitle>Modificar pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value || status)}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {status === 'cancelled' && order.status !== 'cancelled' && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cancellation-reason">Motivo de cancelación</Label>
                  <select id="cancellation-reason" value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm" required>
                    <option value="">Selecciona un motivo</option>
                    {cancellationReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="cancellation-note">Nota</Label>
                  <Input id="cancellation-note" value={cancellationNote} onChange={(event) => setCancellationNote(event.target.value)} placeholder="Detalle de la cancelación" required={cancellationReason === 'Otro'} />
                </div>
                {(order.enviaLabelUrl || order.enviaTrackingNumber || order.enviaShipmentId) && <p className="text-sm text-amber-700">Hay una etiqueta generada. La cancelación del pedido no anula automáticamente la etiqueta ni sus cargos en Envia.com.</p>}
              </div>
            )}
            {order.status === 'cancelled' && order.refund && <RefundStatusPanel refund={order.refund} />}
            {order.status === 'cancelled' && order.orderSource === 'assisted_sale' && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                <p className="font-semibold">Reintegro de venta asistida</p>
                <p className="mt-1 text-sm">La devolución al comprador se resuelve directamente con la tienda y no requiere comprobante en MundoBeat.</p>
                <p className="mt-2 text-sm">Comisión: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(order.assistedCommissionRefundAmount || 0))}</p>
                <p className="text-sm">Envío: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(order.assistedShippingRefundAmount || 0))}</p>
                <p className="text-sm font-semibold">Total: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(order.assistedReimbursementAmount || 0))}</p>
              </div>
            )}
            {order.status === 'cancelled' && order.orderSource !== 'assisted_sale' && !order.refund && order.paymentStatus === 'approved' && (
              <div className={`rounded-lg border p-4 ${order.vendorCustomerRefundStatus === 'completed' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <p className="font-semibold">Devolución gestionada por la tienda</p>
                <p className="mt-1 text-sm">Monto: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(order.vendorCustomerRefundAmount ?? order.total ?? 0))}</p>
                <p className="text-sm">Estado: {order.vendorCustomerRefundStatus === 'completed' ? 'Devuelto al comprador' : order.vendorPaymentId ? 'Pendiente de devolución' : 'Pendiente de liquidación a la tienda'}</p>
                {order.vendorCustomerRefundReference && <p className="text-sm">Referencia: {order.vendorCustomerRefundReference}</p>}
                {order.vendorCustomerRefundProof && <a href={getBackendAssetUrl(order.vendorCustomerRefundProof)} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 underline">Ver comprobante</a>}
              </div>
            )}
            <div>
              <Label>Tracking / Número de guía</Label>
              <Input
                className={savedTrackingNumber ? "mt-2 bg-gray-50 font-medium text-gray-700" : "mt-2"}
                value={tracking}
                onChange={(event) => setTracking(event.target.value)}
                placeholder="Ej: R123456789"
                readOnly={Boolean(savedTrackingNumber)}
              />
              {savedTrackingNumber && (
                <p className="mt-1 text-xs text-gray-500">La guía fue generada y no se puede editar.</p>
              )}
            </div>
            {message && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </CardContent>
        </Card>

        <Card className="space-y-4">
          <CardHeader>
            <CardTitle>Resumen financiero</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{currencyFormatter.format(order.subtotal ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Envío</span>
              <span>{order.shippingCost && order.shippingCost > 0 ? currencyFormatter.format(order.shippingCost) : "Gratis"}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-gray-900">
              <span>Total</span>
              <span>{currencyFormatter.format(order.total)}</span>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
