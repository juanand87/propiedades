"use client";
import { assistedCommissionLabel } from "@/lib/assisted-commission";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, ChevronLeft, Package, Truck, User, MapPin, CreditCard, Calendar, Plus, Minus, Trash2, Clock, History, Mail, Phone, Search, ChevronDown, RotateCcw, CheckCircle2, Star, StickyNote } from "lucide-react";
import { getBackendAssetUrl, getImageUrl } from "@/lib/utils";
import { RefundStatusPanel } from "@/components/orders/RefundStatusPanel";
import SalesReceiptActions from "@/components/orders/SalesReceiptActions";

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Pagado", className: "bg-green-100 text-green-800" },
  processing: { label: "Procesando", className: "bg-blue-100 text-blue-800" },
  shipped: { label: "Enviado", className: "bg-violet-100 text-violet-800" },
  delivered: { label: "Completado", className: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelado", className: "bg-rose-100 text-rose-800" },
  refunded: { label: "Reembolsado", className: "bg-indigo-100 text-indigo-800" },
};

const enviaStatusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Procesando etiqueta", className: "bg-blue-100 text-blue-800" },
  generated: { label: "Etiqueta generada", className: "bg-indigo-100 text-indigo-800" },
  picked_up: { label: "Retirado por courier", className: "bg-cyan-100 text-cyan-800" },
  in_transit: { label: "En tránsito", className: "bg-sky-100 text-sky-800" },
  delivered: { label: "Entregado", className: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Error de envío", className: "bg-rose-100 text-rose-800" },
};

const TRACKING_AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

function normalizeWhatsappPhone(value?: string | null) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("56")) return digits;
  digits = digits.replace(/^0+/, "");
  return digits.length <= 9 ? `56${digits}` : digits;
}

function getEnviaStatusBadge(status?: string) {
  const normalized = String(status || "").toLowerCase().trim();
  return enviaStatusBadge[normalized] || {
    label: status || "Sin estado",
    className: "bg-gray-100 text-gray-700",
  };
}

function shouldAutoSyncTracking(order: any) {
  if (!order?.id || !order?.enviaTrackingNumber) return false;

  const currentStatus = String(order.enviaShippingStatus || "").toLowerCase().trim();
  if (currentStatus === "delivered" || currentStatus === "failed") return false;

  if (!order.enviaLastTrackingUpdate) return true;

  const lastUpdate = new Date(order.enviaLastTrackingUpdate).getTime();
  if (!Number.isFinite(lastUpdate)) return true;

  return Date.now() - lastUpdate > TRACKING_AUTO_SYNC_INTERVAL_MS;
}

function formatTrackingUpdatedAt(value?: string | Date | null) {
  if (!value) return "Sin actualización registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actualización registrada";
  return date.toLocaleString("es-CL");
}

const CANCEL_REASONS = [
  { value: "quiebre_stock", label: "Quiebre de stock" },
  { value: "cliente_solicito", label: "Cliente solicitó cancelación" },
  { value: "error_publicacion", label: "Error en publicación" },
  { value: "no_puedo_despachar", label: "No puedo despachar" },
  { value: "otro", label: "Otro" },
];

const MERCADOLIBRE_CANCEL_REASONS = [
  { value: "OUT_OF_STOCK", label: "Quiebre de stock" },
  { value: "BUYER_REGRETS", label: "El comprador se arrepintió" },
  { value: "BUYER_NOT_ENOUGH_MONEY", label: "El comprador no pudo pagar" },
  { value: "OTHER_THEIR_RESPONSIBILITY", label: "Otro motivo atribuible al comprador" },
];

const EXTERNAL_SHIPPING_REASONS = [
  { value: "no_coverage", label: "Envia.com no tiene cobertura" },
  { value: "platform_error", label: "Error en la plataforma" },
  { value: "buyer_agreement", label: "Acuerdo especial con el comprador" },
  { value: "other", label: "Otro motivo" },
];

const historyActionLabels: Record<string, string> = {
  created: "Pedido creado",
  item_added: "Producto agregado",
  item_removed: "Producto eliminado",
  item_updated: "Producto actualizado",
  status_changed: "Estado cambiado",
  note_added: "Nota agregada",
};

// Threshold: descriptions longer than this are collapsed by default
const COLLAPSE_THRESHOLD = 80;

function HistoryEntry({ entry }: { entry: any }) {
  const [expanded, setExpanded] = useState(false);
  const desc = entry.description || "";
  const isLong = desc.length > COLLAPSE_THRESHOLD;

  return (
    <div className="group relative flex gap-3 pb-5 last:pb-0">
      <div className="absolute bottom-0 left-[15px] top-8 w-px bg-slate-200 group-last:hidden" aria-hidden="true" />
      <div className="relative z-10 flex-shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-sky-100 shadow-sm">
          <Clock className="h-3.5 w-3.5 text-sky-700" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900">
            {historyActionLabels[entry.action] || entry.action}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              {expanded ? "Ocultar" : "Ver detalles"}
              <ChevronDown
                className="w-3 h-3 transition-transform"
                style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
          )}
        </div>
        {desc && (
          <div className={`text-xs text-gray-600 mt-0.5 ${isLong && !expanded ? "hidden" : ""}`}>
            <p className="whitespace-pre-wrap break-words leading-5">{desc}</p>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {new Date(entry.timestamp).toLocaleString("es-CL")}
        </p>
      </div>
    </div>
  );
}

function isManualOrderNote(entry: any) {
  if (entry?.action !== "note_added" || !entry?.newValues) return false;
  try {
    const values = typeof entry.newValues === "string" ? JSON.parse(entry.newValues) : entry.newValues;
    return values?.manualOrderNote === true;
  } catch {
    return false;
  }
}

function OrderInfoCard({
  icon: Icon,
  title,
  children,
  badge,
}: {
  icon: typeof User;
  title: string;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,35,65,0.045)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><Icon className="h-[18px] w-[18px]" /></span>
          <h2 className="truncate text-sm font-bold text-slate-950">{title}</h2>
        </div>
        {badge}
      </div>
      <div className="space-y-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

export default function DashboardOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewStatus, setReviewStatus] = useState<any>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const autoSyncedOrderRef = useRef<string | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferReference, setTransferReference] = useState('');
  const [assistedBusy, setAssistedBusy] = useState(false);
  const assistedAction = async (action: 'receive' | 'process' | 'pay') => {
    if (assistedBusy || !order) return;
    setAssistedBusy(true); setError(''); setMessage('');
    try {
      if (action === 'pay') {
        const result = await api.confirmAssistedTransfer(order.id, order.customerTransferReference || '');
        window.location.href = result.paymentUrl;
        return;
      }
      const updated = action === 'receive' ? await api.receiveAssistedTransfer(order.id, transferReference.trim()) : await api.startAssistedProcessing(order.id);
      setOrder(updated); setShowTransferDialog(false);
      setMessage(action === 'receive' ? 'Transferencia recibida. Pedido marcado como Pagado.' : 'Pedido marcado como Procesando.');
      setHistory(await api.getOrderHistory(order.id));
    } catch (err: any) { setError(err.message || 'No se pudo completar la operación'); }
    finally { setAssistedBusy(false); }
  };

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelling, setCancelling] = useState(false);
  
  // Modal de agregar producto
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productQuantity, setProductQuantity] = useState(1);
  
  // Modal de confirmación de eliminación
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  // Envia.com Label Generation
  const [generatingEnviaLabel, setGeneratingEnviaLabel] = useState(false);
  const [canRetryEnviaLabel, setCanRetryEnviaLabel] = useState(false);
  const [labelData, setLabelData] = useState<any>(null);
  const [showShippingQuotes, setShowShippingQuotes] = useState(false);
  const [loadingShippingQuotes, setLoadingShippingQuotes] = useState(false);
  const [selectingShippingQuote, setSelectingShippingQuote] = useState(false);
  const [shippingQuotes, setShippingQuotes] = useState<any[]>([]);
  const [selectedShippingQuote, setSelectedShippingQuote] = useState<any>(null);
  const [showExternalShipping, setShowExternalShipping] = useState(false);
  const [externalShippingReason, setExternalShippingReason] = useState("");
  const [externalShippingDetail, setExternalShippingDetail] = useState("");
  const [externalShippingCarrier, setExternalShippingCarrier] = useState("");
  const [externalShippingTracking, setExternalShippingTracking] = useState("");
  const [externalShippingTrackingUrl, setExternalShippingTrackingUrl] = useState("");
  const [externalShippingEvidence, setExternalShippingEvidence] = useState<File | null>(null);
  const [savingExternalShipping, setSavingExternalShipping] = useState(false);

  // Envia.com Manual Sync
  const [syncingTracking, setSyncingTracking] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Estado manual (solo para pedidos POS)
  const [posStatus, setPosStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [loadingMercadoLibreShipping, setLoadingMercadoLibreShipping] = useState(false);
  const [mercadoLibreShipping, setMercadoLibreShipping] = useState<any>(null);
  const [refundReference, setRefundReference] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [refundDate, setRefundDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refundProof, setRefundProof] = useState<File | null>(null);
  const [replacingRefundProof, setReplacingRefundProof] = useState(false);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<{ url: string; title: string } | null>(null);
  const [savingCustomerRefund, setSavingCustomerRefund] = useState(false);

  useEffect(() => {
    const loadOrder = async () => {
      setLoading(true);
      setError("");

      try {
        const token = api.getToken();
        if (!token) {
          setError("Debes iniciar sesión para ver este pedido.");
          setLoading(false);
          return;
        }

        const data = await api.getVendorOrder(orderId);
        setOrder(data);
        try {
          setReviewStatus(await api.get(`/reviews/mine/order/${orderId}`));
        } catch (reviewError) {
          console.error("Error cargando calificación:", reviewError);
        }
        if (data.orderSource === 'pos') setPosStatus(data.status);
        if (data.orderSource === 'mercadolibre') {
          try {
            const shipping = await api.getMercadoLibreShipping(orderId);
            setMercadoLibreShipping(shipping);
          } catch (shippingError) {
            console.error("Error cargando envío de Mercado Libre:", shippingError);
          }
        }

        // Cargar historial
        try {
          const historyData = await api.getOrderHistory(orderId);
          setHistory(historyData);
        } catch (err) {
          console.error("Error cargando historial:", err);
          // No mostramos error si falla el historial
        }
      } catch (err: any) {
        console.error("Error cargando el pedido:", err);
        setError(err.message || "No se pudo cargar el pedido");
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId || typeof window === "undefined" || new URLSearchParams(window.location.search).get("assistedPayment") !== "1") return;
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      try {
        const refreshed = await api.getVendorOrder(orderId);
        setOrder(refreshed);
        if (refreshed.paymentStatus === "approved") {
          setMessage("Pago confirmado. La venta asistida quedó registrada y ya puedes generar la etiqueta.");
          window.clearInterval(interval);
          window.history.replaceState({}, "", `/dashboard/orders/${orderId}`);
        } else if (attempts >= 8) {
          setMessage("El pago está siendo confirmado. Puedes actualizar el pedido en unos instantes.");
          window.clearInterval(interval);
        }
      } catch {
        if (attempts >= 8) window.clearInterval(interval);
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [orderId]);

  const handleAddNote = async () => {
    if (!order || !noteText.trim()) return;
    setSavingNote(true);
    setMessage("");
    setError("");
    try {
      await api.addOrderNote(order.id, noteText.trim());
      setHistory(await api.getOrderHistory(order.id));
      setNoteText("");
      setShowNoteDialog(false);
      setMessage("Nota agregada correctamente.");
    } catch (noteError: any) {
      setError(noteError.message || "No se pudo agregar la nota");
    } finally {
      setSavingNote(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !cancelReason) return;

    setCancelling(true);
    setMessage("");
    setError("");

    try {
      if (order.orderSource === "mercadolibre") {
        await api.cancelMercadoLibreOrder(order.id, cancelReason);
      } else {
        const reasonLabel = CANCEL_REASONS.find(r => r.value === cancelReason)?.label || cancelReason;
        await api.cancelOrder(order.id, reasonLabel, cancelReason === "otro" ? cancelNote : undefined);
      }

      const refreshed = await api.getVendorOrder(orderId);
      setOrder(refreshed);

      try {
        const historyData = await api.getOrderHistory(orderId);
        setHistory(historyData);
      } catch (err) {
        console.error("Error recargando historial:", err);
      }

      setShowCancelModal(false);
      setCancelReason("");
      setCancelNote("");
      setMessage(order.orderSource === "mercadolibre" ? "Cancelación enviada a Mercado Libre." : "Pedido cancelado correctamente.");
    } catch (err: any) {
      console.error("Error cancelando pedido:", err);
      setError(err.message || "No se pudo cancelar el pedido");
    } finally {
      setCancelling(false);
    }
  };

  const syncTracking = async (options?: { silent?: boolean }) => {
    if (!order?.id) return;

    setSyncingTracking(true);
    if (!options?.silent) {
      setMessage("");
      setError("");
    }

    try {
      const response = await api.post(`/shipping/envia/sync-order/${order.id}`, {});
      if (!options?.silent) {
        setSyncResult(response);
        setShowSyncModal(true);
      }

      if (response.success && response.enviaShippingStatus) {
        setOrder((current: any) => current ? {
          ...current,
          status: response.newStatus || current.status,
          enviaShippingStatus: response.enviaShippingStatus,
          enviaLastTrackingUpdate: response.lastTrackingUpdate || new Date().toISOString(),
        } : current);
      }

      // Recargar si cambió o si es sincronización silenciosa, para refrescar última actualización/estado.
      if (response.statusChanged || options?.silent) {
        const refreshed = await api.getVendorOrder(orderId);
        setOrder({
          ...refreshed,
          status: response.newStatus || refreshed.status,
          enviaShippingStatus: response.enviaShippingStatus || refreshed.enviaShippingStatus,
          enviaLastTrackingUpdate: response.lastTrackingUpdate || refreshed.enviaLastTrackingUpdate,
        });

        try {
          const historyData = await api.getOrderHistory(orderId);
          setHistory(historyData);
        } catch (err) {
          console.error("Error recargando historial:", err);
        }
      }
    } catch (err: any) {
      console.error("Error sincronizando tracking:", err);
      if (!options?.silent) {
        setSyncResult({
          success: false,
          message: err.message || "Error al sincronizar el tracking",
          statusChanged: false,
        });
        setShowSyncModal(true);
      }
    } finally {
      setSyncingTracking(false);
    }
  };

  const handleRefreshMercadoLibreShipping = async () => {
    if (!order?.id) return;
    setLoadingMercadoLibreShipping(true);
    setError("");
    try {
      const shipping = await api.getMercadoLibreShipping(order.id);
      setMercadoLibreShipping(shipping);
      setOrder(await api.getVendorOrder(orderId));
      setMessage("Estado del envío actualizado desde Mercado Libre.");
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar el envío de Mercado Libre");
    } finally {
      setLoadingMercadoLibreShipping(false);
    }
  };

  const handleOpenMercadoLibreLabel = async () => {
    setLoadingMercadoLibreShipping(true);
    setError("");
    try {
      await api.openMercadoLibreLabel(order.id);
    } catch (err: any) {
      setError(err.message || "La etiqueta aún no está disponible");
    } finally {
      setLoadingMercadoLibreShipping(false);
    }
  };

  const handleOpenFalabellaLabel = async () => {
    setError("");
    try {
      await api.openFalabellaLabel(order.id);
    } catch (err: any) {
      setError(err.message || "La etiqueta de Falabella aún no está disponible");
    }
  };

  const handleRegisterCustomerRefund = async () => {
    if (!order?.id || !refundReference.trim() || !refundProof) return;
    setSavingCustomerRefund(true);
    setError("");
    setMessage("");
    try {
      await api.registerCustomerRefund(order.id, {
        reference: refundReference.trim(), note: refundNote.trim() || undefined,
        refundedAt: refundDate, proof: refundProof,
      });
      setOrder(await api.getVendorOrder(orderId));
      setReplacingRefundProof(false);
      setRefundProof(null);
      setMessage("Devolución al comprador registrada correctamente.");
    } catch (err: any) {
      setError(err.message || "No se pudo registrar la devolución");
    } finally {
      setSavingCustomerRefund(false);
    }
  };

  const handleSyncTracking = async () => {
    await syncTracking();
  };

  useEffect(() => {
    if (!shouldAutoSyncTracking(order)) return;

    const syncKey = `${order.id}:${order.enviaTrackingNumber}:${order.enviaLastTrackingUpdate || "never"}`;
    if (autoSyncedOrderRef.current === syncKey) return;

    autoSyncedOrderRef.current = syncKey;
    syncTracking({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.enviaTrackingNumber, order?.enviaShippingStatus, order?.enviaLastTrackingUpdate]);

  const handleSavePosStatus = async (newStatus: string) => {
    if (!order?.id || newStatus === order.status) return;
    setSavingStatus(true);
    setMessage("");
    setError("");
    try {
      await api.updateOrderStatus(order.id, newStatus);
      const refreshed = await api.getVendorOrder(orderId);
      setOrder(refreshed);
      setPosStatus(refreshed.status);
      try {
        const historyData = await api.getOrderHistory(orderId);
        setHistory(historyData);
      } catch {}
      setMessage("Estado actualizado correctamente.");
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar el estado");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleCompleteVendorManagedShipping = async () => {
    if (!order?.id) return;
    if (!window.confirm('¿Confirmas que el comprador recibió este pedido?')) return;

    setSavingStatus(true);
    setMessage('');
    setError('');
    try {
      const updated = await api.completeVendorManagedShipping(order.id);
      setOrder(updated);
      try {
        setHistory(await api.getOrderHistory(order.id));
      } catch {}
      try {
        setReviewStatus(await api.get(`/reviews/mine/order/${order.id}`));
      } catch {}
      setMessage('Pedido marcado como completado. El envío quedó habilitado para liquidación.');
    } catch (err: any) {
      setError(err.message || 'No se pudo completar el pedido');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setItemToDelete(itemId);
    setShowDeleteConfirm(true);
  };

  const confirmRemoveItem = async () => {
    if (!order || !itemToDelete) return;
    
    setShowDeleteConfirm(false);
    setUpdatingItem(itemToDelete);
    setError("");
    
    try {
      // Guardar referencia al item antes de eliminarlo
      const item = order.items.find((i: any) => i.id === itemToDelete);
      
      // Eliminar del pedido
      await api.removeOrderItem(order.id, itemToDelete);
      
      // Restaurar el stock si tenemos el productId
      if (item?.productId) {
        try {
          const product = await api.getProduct(item.productId);
          await api.updateProduct(item.productId, {
            ...product,
            stock: product.stock + item.quantity
          });
        } catch (err) {
          console.error("Error restaurando stock:", err);
        }
      }
      
      // Recargar pedido
      const refreshed = await api.getVendorOrder(orderId);
      setOrder(refreshed);
      
      // Recargar historial
      try {
        const historyData = await api.getOrderHistory(orderId);
        setHistory(historyData);
      } catch (err) {
        console.error("Error recargando historial:", err);
      }

      setMessage("Producto eliminado y stock restaurado correctamente.");
      setTimeout(() => setMessage(""), 3000);
      
    } catch (err: any) {
      console.error("Error eliminando producto:", err);
      setError(err.message || "No se pudo eliminar el producto");
      setTimeout(() => setError(""), 5000);
    } finally {
      setUpdatingItem(null);
      setItemToDelete(null);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (!order || newQuantity < 1) return;
    
    setUpdatingItem(itemId);
    setError("");
    
    try {
      // Obtener el item actual
      const item = order.items.find((i: any) => i.id === itemId);
      if (!item) {
        setError("Producto no encontrado");
        setUpdatingItem(null);
        return;
      }

      // Si está aumentando la cantidad, verificar el stock
      if (newQuantity > item.quantity && item.productId) {
        try {
          const product = await api.getProduct(item.productId);
          const stockDisponible = product.stock + item.quantity; // Stock actual + cantidad en el pedido
          
          if (newQuantity > stockDisponible) {
            setError(`Stock insuficiente. Disponible: ${stockDisponible} unidades`);
            setUpdatingItem(null);
            setTimeout(() => setError(""), 5000);
            return;
          }
        } catch (err) {
          console.error("Error verificando stock:", err);
          // Continuar si falla la verificación
        }
      }

      await api.updateOrderItem(order.id, itemId, newQuantity);
      const refreshed = await api.getVendorOrder(orderId);
      setOrder(refreshed);
      
      // Recargar historial
      try {
        const historyData = await api.getOrderHistory(orderId);
        setHistory(historyData);
      } catch (err) {
        console.error("Error recargando historial:", err);
      }

      setMessage("Cantidad actualizada correctamente.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      console.error("Error actualizando cantidad:", err);
      setError(err.message || "No se pudo actualizar la cantidad");
      setTimeout(() => setError(""), 5000);
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleSearchProducts = async () => {
    if (!searchQuery.trim() || !order?.vendorId) return;
    
    setSearching(true);
    try {
      const results = await api.searchVendorProducts(order.vendorId, searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error("Error buscando productos:", err);
      setError("No se pudieron buscar productos");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setProductQuantity(1);
  };

  const handleAddProduct = async () => {
    if (!selectedProduct || !order) return;
    
    // Verificar stock
    if (productQuantity > selectedProduct.stock) {
      setError(`Stock insuficiente. Disponible: ${selectedProduct.stock}`);
      return;
    }

    setUpdatingItem("adding");
    setError("");
    
    try {
      await api.addOrderItem(order.id, selectedProduct.id, productQuantity, selectedProduct.price);
      const refreshed = await api.getVendorOrder(orderId);
      setOrder(refreshed);
      
      // Recargar historial
      try {
        const historyData = await api.getOrderHistory(orderId);
        setHistory(historyData);
      } catch (err) {
        console.error("Error recargando historial:", err);
      }

      setMessage("Producto agregado correctamente.");
      setShowAddProduct(false);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedProduct(null);
      setProductQuantity(1);
    } catch (err: any) {
      console.error("Error agregando producto:", err);
      setError(err.message || "No se pudo agregar el producto");
    } finally {
      setUpdatingItem(null);
    }
  };



  // TEST: Simular generación para diagnosticar duplicados
  const [testingEnvia, setTestingEnvia] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleTestEnviaLabel = async () => {
    if (!order) return;
    
    setTestingEnvia(true);
    setError("");
    setMessage("");
    setTestResult(null);
    
    try {
      console.log("🧪 Iniciando TEST de generación...");
      const result = await api.testGenerateEnviaLabel(order.id);
      console.log("🧪 TEST resultado:", result);
      setTestResult(result);
      setMessage(`TEST completado. Request #${result.totalRequests}. Ver consola para detalles.`);
    } catch (err: any) {
      console.error("Error en TEST:", err);
      setError(err.message || "Error en TEST");
    } finally {
      setTestingEnvia(false);
    }
  };

  // Reintentar generación (limpiar registros fallidos)
  const [retrying, setRetrying] = useState(false);

  const handleRetryEnviaLabel = async () => {
    if (!order) return;
    
    setRetrying(true);
    setError("");
    setMessage("");
    
    try {
      // Primero limpiar registros fallidos
      await api.retryEnviaLabel(order.id);
      setMessage("Registros anteriores eliminados. Generando etiqueta...");
      
      // Luego generar la etiqueta
      const result = await api.generateEnviaLabel(order.id);

      if (!result?.labelUrl && !result?.trackingNumber) {
        throw new Error("Envia.com no devolvió una etiqueta válida.");
      }
      
      // Recargar la orden
      const refreshed = await api.getVendorOrder(orderId);
      setOrder(refreshed);
      
      setMessage("Etiqueta Envia.com generada exitosamente.");
      
      if (result.labelUrl) {
        window.open(result.labelUrl, '_blank');
      }
    } catch (err: any) {
      console.error("Error en reintento:", err);
      setError(err.message || "Error al reintentar");
      setCanRetryEnviaLabel(true);
    } finally {
      setRetrying(false);
    }
  };

  const handleQuoteOtherCourier = async () => {
    if (!order?.id) return;
    setShowShippingQuotes(true);
    setLoadingShippingQuotes(true);
    setSelectedShippingQuote(null);
    setShippingQuotes([]);
    setError("");

    try {
      const result = await api.getEnviaOrderQuotes(order.id);
      const options = Array.isArray(result?.options) ? result.options : [];
      setShippingQuotes(options);
      if (!options.length) {
        setError("No se encontraron otras opciones de envío para este pedido.");
      }
    } catch (err: any) {
      setError(err.message || "No se pudieron cotizar otras empresas de transporte");
    } finally {
      setLoadingShippingQuotes(false);
    }
  };

  const handleSelectShippingQuote = async () => {
    if (!order?.id || !selectedShippingQuote) return;
    setSelectingShippingQuote(true);
    setError("");
    setMessage("");

    try {
      const result = await api.selectEnviaOrderShippingOption(
        order.id,
        selectedShippingQuote.carrier,
        selectedShippingQuote.service,
      );
      const refreshed = await api.getVendorOrder(orderId);
      setOrder(refreshed);
      setShowShippingQuotes(false);
      setMessage(result.message || "Empresa de transporte actualizada. La etiqueta aún no ha sido generada.");
    } catch (err: any) {
      setError(err.message || "No se pudo cambiar la empresa de transporte");
    } finally {
      setSelectingShippingQuote(false);
    }
  };

  const handleGenerateEnviaLabel = async () => {
    if (!order) return;
    
    setGeneratingEnviaLabel(true);
    setError("");
    setMessage("");
    
    try {
      const result = await api.generateEnviaLabel(order.id);

      if (!result?.labelUrl && !result?.trackingNumber) {
        throw new Error("Envia.com no devolvió una etiqueta válida.");
      }
      
      // Recargar la orden para actualizar los campos de Envia
      const refreshed = await api.getVendorOrder(orderId);
      setOrder(refreshed);
      setCanRetryEnviaLabel(false);
      
      setMessage("Etiqueta Envia.com generada exitosamente.");
      
      // Si hay URL de etiqueta, abrirla automáticamente
      if (result.labelUrl) {
        window.open(result.labelUrl, '_blank');
      }
    } catch (err: any) {
      console.error("Error generando etiqueta Envia.com:", err);
      setError(err.message || "No se pudo generar la etiqueta Envia.com");
      setCanRetryEnviaLabel(true);
    } finally {
      setGeneratingEnviaLabel(false);
    }
  };

  const handleUseExternalShipping = async () => {
    if (!order?.id) return;
    setSavingExternalShipping(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.useExternalOrderShipping(order.id, {
        reason: externalShippingReason,
        reasonDetail: externalShippingDetail.trim() || undefined,
        carrier: externalShippingCarrier.trim(),
        trackingNumber: externalShippingTracking.trim(),
        trackingUrl: externalShippingTrackingUrl.trim() || undefined,
        evidence: externalShippingEvidence,
      });
      setOrder(updated);
      setHistory(await api.getOrderHistory(order.id));
      setShowExternalShipping(false);
      setExternalShippingReason("");
      setExternalShippingDetail("");
      setExternalShippingCarrier("");
      setExternalShippingTracking("");
      setExternalShippingTrackingUrl("");
      setExternalShippingEvidence(null);
      setMessage("Envío externo registrado. El monto del envío se agregará a tu liquidación cuando el pedido sea entregado.");
    } catch (err: any) {
      setError(err.message || "No se pudo registrar el envío externo");
    } finally {
      setSavingExternalShipping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <Card>
        <CardContent className="space-y-3 text-center pt-6">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-lg font-semibold">No se pudo cargar el pedido</p>
          <p className="text-sm text-gray-600">{error}</p>
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => router.back()}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!order) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-600">Pedido no encontrado</p>
        </CardContent>
      </Card>
    );
  }

  const badgeMeta = statusBadge[order.status] || { label: order.status, className: "bg-gray-100 text-gray-800" };
  const orderDate = new Date(order.createdAt).toLocaleString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isMercadoLibreOrder = order.orderSource === "mercadolibre";
  const isFalabellaOrder = order.orderSource === "falabella";
  const isExternalMarketplaceOrder = isMercadoLibreOrder || isFalabellaOrder;
  const canEdit = !isExternalMarketplaceOrder && (order.status === "pending" || order.status === "paid");
  const mercadoLibreShippingStatus = String(mercadoLibreShipping?.status || order.externalShippingStatus || "").toLowerCase();
  const mercadoLibreShippingSubstatus = String(mercadoLibreShipping?.substatus || "").toLowerCase();
  const mercadoLibreCancellationLocked = ['shipped', 'in_transit', 'delivered'].includes(mercadoLibreShippingStatus)
    || mercadoLibreShippingSubstatus.includes('printed')
    || (mercadoLibreShippingStatus === 'ready_to_ship' && Boolean(mercadoLibreShippingSubstatus) && mercadoLibreShippingSubstatus !== 'ready_to_print');
  const hasGeneratedShippingLabel = Boolean(
    order.enviaLabelUrl || order.enviaTrackingNumber || order.enviaShipmentId,
  );
  const savedTrackingNumber = String(order.enviaTrackingNumber || order.trackingNumber || "").trim();
  const cancellableStatuses = ["pending", "paid", "processing"];
  const hasShippingCommitment = Boolean(
    hasGeneratedShippingLabel
    || savedTrackingNumber
    || order.externalShippingCarrier
    || order.shippingHandledBy === "vendor"
  );
  const canCancelOrder = !isFalabellaOrder
    && cancellableStatuses.includes(order.status)
    && (isMercadoLibreOrder ? !mercadoLibreCancellationLocked : !hasShippingCommitment);
  const customerEmail = order.shippingEmail || order.customerEmail || order.customer?.email || "";
  const whatsappPhone = normalizeWhatsappPhone(order.shippingPhone);
  const canSendPendingReminder = order.status === "pending" && order.orderSource !== "assisted_sale" && Boolean(customerEmail);
  const shippingCost = Number(order.shippingCost) || 0;
  const subtotalForPayout = Number(order.subtotal) || Math.max(0, (Number(order.total) || 0) - shippingCost);
  const savedCommissionAmount = Number(order.commissionAmount);
  const calculatedCommissionAmount = Math.round(subtotalForPayout * ((Number(order.commissionPercentage) || 0) / 100));
  const commissionAmount = Number.isFinite(savedCommissionAmount) ? savedCommissionAmount : calculatedCommissionAmount;
  const sellerFundedShipping = shippingCost === 0
    && String(order.shippingMethod || "").toLowerCase().includes("gratis")
    ? Number(order.enviaQuotedPrice) || 0
    : 0;
  const externalShippingPayout = Math.max(0, Number(order.externalShippingPayoutAmount) || 0);
  const externalShippingNotice = order.externalShippingPayoutStatus === 'paid'
    ? `Como enviaste por un transportista externo, el valor del envío pagado por el cliente (${currencyFormatter.format(externalShippingPayout)}) fue reembolsado en la liquidación pagada.`
    : `Como enviaste por un transportista externo, se te reembolsará el valor del envío pagado por el cliente (${currencyFormatter.format(externalShippingPayout)}) al pagar la liquidación de este pedido.`;
  const vendorReceivable = Math.max(0, subtotalForPayout - commissionAmount - sellerFundedShipping)
    + (order.shippingHandledBy === "vendor" && ["eligible", "paid"].includes(order.externalShippingPayoutStatus) ? externalShippingPayout : 0);
  const progressSteps = [
    { status: "pending", label: statusBadge.pending.label, icon: Clock },
    { status: "paid", label: statusBadge.paid.label, icon: CreditCard },
    { status: "processing", label: statusBadge.processing.label, icon: Package },
    { status: "shipped", label: statusBadge.shipped.label, icon: Truck },
    { status: "delivered", label: statusBadge.delivered.label, icon: CheckCircle2 },
  ];
  const progressIndex = progressSteps.findIndex((step) => step.status === order.status);
  const showReviewStatus = reviewStatus?.state === "submitted"
    || (reviewStatus?.eligible && order.status === "delivered");
  const canCompleteVendorManagedShipping = order.shippingHandledBy === "vendor"
    && order.status === "shipped"
    && Boolean(String(order.externalShippingCarrier || "").trim())
    && Boolean(String(order.trackingNumber || "").trim());
  const manualOrderNotes = history.filter(isManualOrderNote);
  const operationalHistory = history.filter((entry) => !isManualOrderNote(entry));

  const handleSendPendingReminder = async () => {
    if (!order?.id) return;
    setSendingReminder(true);
    setMessage("");
    setError("");
    try {
      const result = await api.sendPendingOrderReminder(order.id);
      const remindedAt = result?.remindedAt ? new Date(result.remindedAt).toLocaleString("es-CL") : null;
      setMessage(
        remindedAt
          ? `Recordatorio de compra enviado correctamente (${remindedAt}).`
          : "Recordatorio de compra enviado correctamente.",
      );

      const refreshed = await api.getVendorOrder(orderId);
      setOrder(refreshed);
      try {
        const historyData = await api.getOrderHistory(orderId);
        setHistory(historyData);
      } catch {}
    } catch (err: any) {
      setError(err.message || "No se pudo enviar el recordatorio");
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div className="order-detail-page space-y-6 pb-10">
      {/* Header */}
      <div className="grid items-start gap-4 border-b border-slate-200 pb-5 md:grid-cols-[1fr_auto_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard/orders" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-sky-300 hover:text-sky-700" aria-label="Volver a pedidos">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Pedido #{order.orderNumber}</h1>
            <Badge className={`${badgeMeta.className} rounded-full px-3 py-1 text-xs font-semibold shadow-none`}>{badgeMeta.label}</Badge>
          </div>
          <p className="ml-12 mt-1 text-sm text-slate-500">{orderDate}</p>
        </div>
        <div className="flex min-h-9 items-center justify-start md:justify-center">
          {showReviewStatus && reviewStatus?.state === "submitted" && (
            <button
              type="button"
              onClick={() => setShowReviewDialog(true)}
              className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-amber-300 hover:bg-amber-100"
              aria-label={`Ver calificación de ${reviewStatus.rating} estrellas`}
            >
              <span className="flex" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star key={value} className={`h-4 w-4 ${value <= reviewStatus.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                ))}
              </span>
              <span>{Number(reviewStatus.rating).toFixed(1)} · Ver calificación</span>
            </button>
          )}
          {showReviewStatus && reviewStatus?.state !== "submitted" && (
            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600">
              <Star className="h-4 w-4 text-slate-400" /> Esperando calificación
            </span>
          )}
        </div>
        <Button type="button" variant="outline" onClick={() => router.back()} className="justify-self-start border-slate-300 bg-white text-slate-700 shadow-sm md:justify-self-end">
          <ChevronLeft className="mr-2 h-4 w-4" />Volver
        </Button>
      </div>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Calificación del comprador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex" aria-label={`${reviewStatus?.rating || 0} de 5 estrellas`}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star key={value} className={`h-6 w-6 ${value <= Number(reviewStatus?.rating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                ))}
              </div>
              <strong className="text-lg text-slate-950">{Number(reviewStatus?.rating || 0).toFixed(1)}</strong>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {reviewStatus?.comment || "El comprador no agregó un comentario."}
            </div>
            {reviewStatus?.submittedAt && <p className="text-xs text-slate-500">Recibida el {new Date(reviewStatus.submittedAt).toLocaleString("es-CL")}</p>}
            <p className="text-xs text-slate-500">Este comentario es privado para tu tienda y la administración de MundoBeat.</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setShowReviewDialog(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(error || message)} onOpenChange={(open) => { if (!open) { setError(""); setMessage(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={error ? "text-rose-700" : "text-emerald-700"}>
              {error ? "No se pudo completar la operación" : "Operación completada"}
            </DialogTitle>
          </DialogHeader>
          <div className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => { setError(""); setMessage(""); }}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {order.orderSource === "assisted_sale" && (
        <div className={`rounded-lg border px-4 py-4 ${order.paymentStatus === "approved" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-950">Venta asistida · {order.assistedSaleChannel || "Canal externo"}</p>
              <p className="text-sm text-slate-600">Pago del comprador: {order.customerTransferConfirmedAt ? 'Transferencia recibida' : 'Pendiente de confirmar transferencia'}.</p>
              <p className="text-sm text-slate-600">
                {order.paymentStatus === "approved"
                  ? "MundoBeat: envío y comisión pagados. Ya puedes generar la etiqueta."
                  : order.paymentUrl
                    ? `MundoBeat: pendiente de pagar ${currencyFormatter.format(Number(order.platformChargeAmount || 0))} por envío y comisión.`
                    : "MundoBeat: envío y comisión pendientes de pago."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
            {order.status === 'pending' && <Button disabled={assistedBusy} onClick={() => { setTransferReference(order.customerTransferReference || ''); setShowTransferDialog(true); }}>Confirmar transferencia recibida</Button>}
            {['paid', 'processing'].includes(order.status) && order.customerTransferConfirmedAt && order.paymentStatus !== 'approved' && !order.paymentUrl && <Button disabled={assistedBusy} onClick={() => assistedAction('pay')}>Pagar envío + comisión</Button>}
            {['pending', 'paid', 'processing'].includes(order.status) && order.paymentStatus !== "approved" && order.paymentUrl && (
              <Button type="button" onClick={() => { window.location.href = order.paymentUrl; }}>
                Pagar envío + comisión
              </Button>
            )}
            </div>
          </div>
        </div>
      )}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Confirmar transferencia recibida</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Confirma que el dinero del comprador ya está abonado en la cuenta de la tienda. El pedido pasará a Pagado; el envío y la comisión a MundoBeat se pagan por separado.</p>
          <Label htmlFor="assisted-transfer-reference">Número de operación (opcional)</Label>
          <Input id="assisted-transfer-reference" value={transferReference} onChange={event => setTransferReference(event.target.value)} placeholder="Número de operación" />
          <DialogFooter><Button variant="outline" disabled={assistedBusy} onClick={() => setShowTransferDialog(false)}>Volver</Button><Button disabled={assistedBusy} onClick={() => assistedAction('receive')}>{assistedBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar recepción</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progreso del pedido */}
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,35,65,0.045)]">
        <div className="grid grid-cols-5">
          {progressSteps.map((step, index) => {
            const StepIcon = step.icon;
            const complete = progressIndex >= 0 && index < progressIndex;
            const active = index === progressIndex;
            return (
              <div key={step.status} className="relative flex min-w-0 flex-col items-center text-center">
                {index > 0 && <span className={`absolute right-1/2 top-5 h-0.5 w-full ${complete || active ? "bg-sky-500" : "bg-slate-200"}`} aria-hidden="true" />}
                <span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white shadow-sm ${complete ? "bg-sky-600 text-white" : active ? "bg-[#07172f] text-cyan-300" : "bg-slate-100 text-slate-400"}`}>
                  {complete ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-4 w-4" />}
                </span>
                <span className={`mt-2 truncate px-1 text-xs font-semibold ${active ? "text-sky-700" : complete ? "text-slate-700" : "text-slate-400"}`}>{step.label}</span>
              </div>
            );
          })}
        </div>
        {order.status === "cancelled" && <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-center text-sm font-semibold text-rose-700">{badgeMeta.label}</div>}
      </div>

      {/* Resumen superior */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OrderInfoCard icon={User} title="Cliente">
          <p className="font-semibold text-slate-950">{order.shippingName}</p>
          <p className="flex min-w-0 items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0 text-sky-600" /><span className="truncate">{customerEmail || "-"}</span></p>
          <p className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-sky-600" />
            <span>{order.shippingPhone || "-"}</span>
            {whatsappPhone && (
              <a
                href={`https://wa.me/${whatsappPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir conversación en WhatsApp"
                aria-label={`Abrir WhatsApp con ${order.shippingName || "el cliente"}`}
                className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#25D366] text-white transition-colors hover:bg-[#1fb759] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
              </a>
            )}
          </p>
        </OrderInfoCard>

        <OrderInfoCard icon={MapPin} title="Dirección de envío">
          <p className="font-semibold text-slate-950">{order.shippingAddress}{order.shippingNumber ? ` ${order.shippingNumber}` : ""}</p>
          <p>{order.shippingCity}, {order.shippingRegion}</p>
          {order.notes && <div className="rounded-md border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-slate-700"><span className="font-semibold">Indicaciones: </span>{order.notes}</div>}
        </OrderInfoCard>

        <OrderInfoCard icon={CreditCard} title={order.orderSource === 'assisted_sale' ? 'Pago del comprador' : 'Pago'} badge={order.paymentStatus ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">{order.orderSource === 'assisted_sale' ? order.customerTransferConfirmedAt ? 'Recibido' : 'Pendiente' : order.paymentStatus}</span> : undefined}>
          <p className="text-xs text-slate-500">Método de pago</p>
          <p className="font-semibold capitalize text-slate-950">{order.paymentMethod || "—"}</p>
          <div className="pt-1">
            <div>
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-lg font-extrabold text-slate-950">{currencyFormatter.format(order.total)}</p>
            </div>
            <SalesReceiptActions order={order} onSaved={(updated, notice) => {
              setOrder(updated); setMessage(notice); setError("");
              api.getOrderHistory(order.id).then(setHistory).catch(console.error);
            }} />
          </div>
        </OrderInfoCard>

        <OrderInfoCard icon={Truck} title="Envío" badge={order.enviaShippingStatus ? <Badge className={`${getEnviaStatusBadge(order.enviaShippingStatus).className} rounded-full text-[10px]`}>{getEnviaStatusBadge(order.enviaShippingStatus).label}</Badge> : undefined}>
          <p className="text-xs text-slate-500">Método</p>
          <p className="font-semibold text-slate-950">{order.shippingMethod || "—"}</p>
          {savedTrackingNumber && <><p className="pt-1 text-xs text-slate-500">Tracking / Número de guía</p><p className="break-all font-mono text-xs font-semibold text-slate-900">{savedTrackingNumber}</p></>}
        </OrderInfoCard>
      </div>

      {/* Layout de 2 columnas */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
        
        {/* Columna izquierda (2/3) */}
        <div className="space-y-5">
          
          {/* Productos */}
          <Card className="overflow-hidden rounded-lg border-slate-200 shadow-[0_8px_24px_rgba(15,35,65,0.045)]">
            <CardHeader className="border-b border-slate-200 bg-white py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-950">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><Package className="h-4 w-4" /></span>
                  Productos ({order.items?.length || 0})
                </CardTitle>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowAddProduct(true)}
                    className="flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar producto
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden grid-cols-[minmax(0,1fr)_110px_170px_110px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[11px] font-bold uppercase text-slate-500 md:grid">
                <span>Producto</span><span>Precio unitario</span><span className="text-center">Cantidad</span><span className="text-right">Subtotal</span>
              </div>
              {order.items?.map((item: any) => (
                <div key={item.id} className="grid gap-4 border-b border-slate-100 px-5 py-4 last:border-0 md:grid-cols-[minmax(0,1fr)_110px_170px_110px] md:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    {item.productImage ? (
                      <button
                        type="button"
                        onClick={() => setProductPreview({
                          url: getImageUrl(item.productImage),
                          title: item.productTitle || item.productName || "Producto",
                        })}
                        className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition-colors hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                        aria-label={`Ampliar imagen de ${item.productTitle || item.productName || "producto"}`}
                        title="Ampliar imagen"
                      >
                        <img
                          src={getImageUrl(item.productImage)}
                          alt={item.productTitle || item.productName}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        <Package className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      {item.productId ? (
                        <a
                          href={`/dashboard/products/${item.productId}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-sm font-semibold text-slate-950 transition-colors hover:text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          title="Abrir edición del producto en otra pestaña"
                        >
                          {item.productTitle || item.productName}
                        </a>
                      ) : (
                        <p className="truncate text-sm font-semibold text-slate-950">{item.productTitle || item.productName}</p>
                      )}
                      {(item.condition || item.productCondition) && <span className="mt-1 inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{item.condition || item.productCondition}</span>}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-700"><span className="mr-1 text-xs text-slate-500 md:hidden">Precio unitario:</span>{currencyFormatter.format(item.price)} c/u</p>
                  {canEdit ? (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        disabled={updatingItem === item.id || item.quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center font-semibold text-slate-900">{item.quantity}</span>
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
                    <span className="text-center text-sm font-semibold text-slate-700">
                      <span className="mr-1 font-normal text-slate-500 md:hidden">Cantidad:</span>{item.quantity}
                    </span>
                  )}
                  <p className="text-right text-sm font-bold text-slate-950">
                    <span className="mr-1 font-normal text-slate-500 md:hidden">Subtotal:</span>{currencyFormatter.format((item.subtotal || (item.price * item.quantity)))}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Historial */}
          {operationalHistory.length > 0 && (
            <Card className="rounded-lg border-slate-200 shadow-[0_8px_24px_rgba(15,35,65,0.045)]">
              <CardHeader className="border-b border-slate-200 py-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-950">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><History className="h-4 w-4" /></span>
                  Historial del pedido
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div>
                  {operationalHistory.map((entry: any) => (
                    <HistoryEntry key={entry.id} entry={entry} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-lg border-slate-200 shadow-[0_8px_24px_rgba(15,35,65,0.045)]">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-slate-200 py-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-950">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><StickyNote className="h-4 w-4" /></span>
                Notas del pedido
              </CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowNoteDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />Agregar nota
              </Button>
            </CardHeader>
            <CardContent className="p-5">
              {manualOrderNotes.length > 0 ? (
                <div className="space-y-3">
                  {manualOrderNotes.map((note: any) => (
                    <article key={note.id} className="border-l-2 border-amber-300 bg-amber-50/60 px-4 py-3">
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{note.description}</p>
                      <p className="mt-2 text-xs text-slate-500">{new Date(note.timestamp).toLocaleString("es-CL")}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aún no hay notas internas para este pedido.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha (1/3) */}
        <div className="space-y-5">
          
          {/* Editar pedido */}
          <div>
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-slate-200 bg-slate-50 py-4">
                <CardTitle className="text-base font-bold">Modificar pedido</CardTitle>
                <div className="flex items-center gap-2">
                  {canSendPendingReminder && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={handleSendPendingReminder}
                      disabled={sendingReminder}
                    >
                      {sendingReminder ? "Enviando..." : "Enviar recordatorio de compra"}
                    </Button>
                  )}
                  {canCancelOrder && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setShowCancelModal(true)}
                    >
                      Cancelar pedido
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                  {isMercadoLibreOrder && (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                      Venta gestionada por Mercado Libre. El pago, el envío y cualquier devolución se procesan en esa plataforma.
                    </div>
                  )}
                  {isMercadoLibreOrder && mercadoLibreCancellationLocked && order.status !== "cancelled" && (
                    <p className="text-xs text-amber-700">La etiqueta ya fue impresa, el envío fue despachado o entregado. Para cancelarlo, debes gestionarlo con soporte de Mercado Libre.</p>
                  )}
                  {isFalabellaOrder && (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                      Venta gestionada por Falabella. Los cambios de estado y cancelaciones se procesan en Seller Center.
                    </div>
                  )}
                  {order.status !== "cancelled" && hasGeneratedShippingLabel && !isMercadoLibreOrder && (
                  <p className="text-xs text-amber-700">Este envío ya tiene etiqueta. Para cancelarlo, comunícate con el administrador del marketplace.</p>
                )}
                {order.status !== "cancelled" && order.shippingHandledBy === "vendor" && (
                  <p className="text-xs text-amber-700">Este pedido ya tiene courier y seguimiento registrados. Si necesitas detenerlo o cancelarlo, comunícate con el administrador del marketplace.</p>
                )}
                {order.orderSource === 'pos' && (
                  <div>
                    <Label>Estado del pedido</Label>
                    <Select value={posStatus} onValueChange={handleSavePosStatus} disabled={savingStatus}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Selecciona estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusBadge).filter(([value]) => value !== 'refunded').map(([value, { label }]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {savingStatus && <p className="text-xs text-gray-500 mt-1">Guardando...</p>}
                  </div>
                )}
                {canCompleteVendorManagedShipping && (
                  <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-sm font-semibold text-emerald-900">Confirmar entrega</p>
                    <p className="text-xs text-emerald-800">
                      Usa esta opción cuando el comprador ya haya recibido el pedido enviado mediante {order.externalShippingCarrier}.
                    </p>
                    <Button
                      type="button"
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={handleCompleteVendorManagedShipping}
                      disabled={savingStatus}
                    >
                      {savingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {savingStatus ? "Confirmando entrega..." : "Marcar como entregado"}
                    </Button>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.back()}
                >
                  Volver
                </Button>
                {order.status === "cancelled" && order.cancellationReason && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
                    <p className="font-medium">Pedido cancelado</p>
                    <p className="text-xs mt-0.5">Motivo: {order.cancellationReason}</p>
                    {order.cancellationNote && (
                      <p className="text-xs mt-0.5">Detalle: {order.cancellationNote}</p>
                    )}
                  </div>
                )}
                {order.status === "cancelled" && order.orderSource === "assisted_sale" && (
                  <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                    <p className="font-semibold">Venta asistida cancelada</p>
                    <p>Coordina directamente con el comprador la devolución de su pago. No debes cargar comprobante en MundoBeat y esta cancelación no genera puntos.</p>
                    <p>Reintegro de comisión: <strong>{currencyFormatter.format(Number(order.assistedCommissionRefundAmount) || 0)}</strong></p>
                    <p>Reintegro de envío: <strong>{currencyFormatter.format(Number(order.assistedShippingRefundAmount) || 0)}</strong></p>
                    {order.assistedReimbursementStatus === "pending_shipping_cancellation" && <p>El envío queda pendiente hasta que administración confirme la anulación o crédito de la etiqueta.</p>}
                    {order.assistedReimbursementStatus === "pending_payment" && <p>El reintegro está habilitado para pago por administración.</p>}
                    {order.assistedReimbursementStatus === "paid" && <p>El reintegro ya fue pagado a tu tienda.</p>}
                  </div>
                )}
                {order.status === "cancelled" && order.orderSource !== "assisted_sale" && order.paymentStatus === "approved" && !isMercadoLibreOrder && (
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div>
                      <p className="font-semibold text-amber-900">Devolución al comprador</p>
                      <p className="text-xs text-amber-800">
                        Debes devolver al comprador el total de {currencyFormatter.format(Number(order.total) || 0)}.
                        {order.cancellationReviewStatus === "vendor_responsible"
                          ? ` MundoBeat liquidará ${currencyFormatter.format(Number(order.vendorAmount) || 0)} después de descontar el gasto operacional del 3%.`
                          : ` MundoBeat liquidará ${currencyFormatter.format(Number(order.vendorAmount) || Number(order.total) || 0)} a tu tienda.`}
                      </p>
                    </div>
                    {order.vendorCustomerRefundStatus === "completed" ? (
                      <div className="space-y-1 text-sm text-emerald-800">
                        <p className="font-semibold">Devuelto al comprador</p>
                        <p>Referencia: {order.vendorCustomerRefundReference}</p>
                        {order.vendorCustomerRefundedAt && <p>Fecha: {new Date(order.vendorCustomerRefundedAt).toLocaleDateString("es-CL")}</p>}
                        {order.vendorCustomerRefundProof && (
                          <button
                            type="button"
                            className="block font-medium underline underline-offset-2"
                            onClick={() => setProofPreviewUrl(getBackendAssetUrl(order.vendorCustomerRefundProof))}
                          >
                            Ver comprobante
                          </button>
                        )}
                        {!replacingRefundProof ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-2"
                            onClick={() => {
                              setRefundReference(order.vendorCustomerRefundReference || "");
                              setRefundNote(order.vendorCustomerRefundNote || "");
                              setRefundDate(order.vendorCustomerRefundedAt
                                ? new Date(order.vendorCustomerRefundedAt).toISOString().slice(0, 10)
                                : new Date().toISOString().slice(0, 10));
                              setReplacingRefundProof(true);
                            }}
                          >
                            Reemplazar comprobante
                          </Button>
                        ) : (
                          <div className="mt-3 space-y-3 rounded-lg border border-emerald-200 bg-white p-3 text-gray-800">
                            <div><Label>Nuevo comprobante</Label><Input type="file" accept="image/*,.pdf" onChange={(e) => setRefundProof(e.target.files?.[0] || null)} /></div>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" onClick={() => { setReplacingRefundProof(false); setRefundProof(null); }}>Cancelar</Button>
                              <Button type="button" onClick={handleRegisterCustomerRefund} disabled={savingCustomerRefund || !refundProof}>
                                {savingCustomerRefund ? "Guardando..." : "Guardar comprobante"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div><Label>Referencia de transferencia</Label><Input value={refundReference} onChange={(e) => setRefundReference(e.target.value)} placeholder="Número de operación" /></div>
                        <div><Label>Fecha de transferencia</Label><Input type="date" value={refundDate} onChange={(e) => setRefundDate(e.target.value)} /></div>
                        <div><Label>Comprobante</Label><Input type="file" accept="image/*,.pdf" onChange={(e) => setRefundProof(e.target.files?.[0] || null)} /></div>
                        <div><Label>Nota opcional</Label><Input value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="Detalle adicional" /></div>
                        <Button type="button" className="w-full" onClick={handleRegisterCustomerRefund} disabled={savingCustomerRefund || !refundReference.trim() || !refundProof}>
                          {savingCustomerRefund ? "Registrando..." : "Confirmar devolución al comprador"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Modal cancelación */}
          <Dialog open={showNoteDialog} onOpenChange={(open) => { if (!savingNote) setShowNoteDialog(open); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Agregar nota al pedido</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="detail-order-note">Nota interna</Label>
                <Textarea
                  id="detail-order-note"
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  maxLength={1000}
                  rows={5}
                  placeholder="Escribe información útil para el seguimiento del pedido..."
                />
                <p className="text-right text-xs text-slate-500">{noteText.length}/1000</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNoteDialog(false)} disabled={savingNote}>Cancelar</Button>
                <Button type="button" onClick={handleAddNote} disabled={savingNote || !noteText.trim()}>
                  {savingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar nota
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                  Cancelar pedido
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-gray-600">
                  Selecciona el motivo de cancelación del pedido <strong>{order?.orderNumber}</strong>:
                </p>
                {order?.orderSource === "assisted_sale" && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
                    <p className="font-semibold">Esta cancelación no genera castigos ni puntos.</p>
                    <p className="mt-0.5 text-xs text-sky-800">
                      Solicitamos el motivo únicamente con fines estadísticos y para mejorar el servicio.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {(order?.orderSource === "mercadolibre" ? MERCADOLIBRE_CANCEL_REASONS : CANCEL_REASONS).map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        cancelReason === r.value
                          ? "border-rose-400 bg-rose-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancelReason"
                        value={r.value}
                        checked={cancelReason === r.value}
                        onChange={() => setCancelReason(r.value)}
                        className="accent-rose-500"
                      />
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
                </div>
                {order?.orderSource !== "mercadolibre" && cancelReason === "otro" && (
                  <div>
                    <Label className="text-sm">Describe el motivo</Label>
                    <textarea
                      value={cancelNote}
                      onChange={(e) => setCancelNote(e.target.value)}
                      placeholder="Ingresa el motivo de cancelación..."
                      rows={3}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCancelModal(false)}>
                  Volver
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelOrder}
                  disabled={!cancelReason || (cancelReason === "otro" && !cancelNote.trim()) || cancelling}
                >
                  {cancelling ? "Cancelando..." : "Confirmar cancelación"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Resumen financiero */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-200 bg-slate-50 py-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><CreditCard className="h-4 w-4" /></span>
                Resumen financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 p-5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{currencyFormatter.format(order.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Envío</span>
                <span>
                  {order.shippingCost && order.shippingCost > 0
                    ? currencyFormatter.format(order.shippingCost)
                    : "Gratis"}
                </span>
              </div>
              <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-base font-extrabold text-slate-950">
                <span>Total</span>
                <span>{currencyFormatter.format(order.total)}</span>
              </div>
              
              {/* Comisión y monto a recibir */}
              {(Number(order.commissionAmount) > 0 || Number(order.commissionPercentage) > 0) && (
                <>
                  <div className="flex justify-between text-gray-600 border-t pt-2 mt-2">
                    <span>{order.orderSource === 'assisted_sale' ? assistedCommissionLabel(order) : `Comisión (${order.commissionPercentage}%)`}</span>
                    <span className="text-red-600">
                      -{currencyFormatter.format(commissionAmount)}
                    </span>
                  </div>
                  {sellerFundedShipping > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Costo de envío asumido por la tienda</span>
                      <span className="text-red-600">-{currencyFormatter.format(sellerFundedShipping)}</span>
                    </div>
                  )}
                  {order.shippingHandledBy === "vendor" && externalShippingPayout > 0 && (
                    order.orderSource !== 'assisted_sale' ? <p className="mt-2 text-xs leading-relaxed text-gray-600">{externalShippingNotice}</p> :
                    <div className="flex justify-between text-gray-600">
                      <span>Envío gestionado por la tienda</span>
                      <span className={["eligible", "paid"].includes(order.externalShippingPayoutStatus) ? "font-semibold text-emerald-700" : "text-amber-700"}>
                        {["eligible", "paid"].includes(order.externalShippingPayoutStatus)
                          ? `+${currencyFormatter.format(externalShippingPayout)}`
                          : `${currencyFormatter.format(externalShippingPayout)} al entregar`}
                      </span>
                    </div>
                  )}
                  <div className="-mx-1 mt-3 flex justify-between rounded-md border border-emerald-100 bg-emerald-50 px-3 py-3 font-bold text-emerald-800">
                    <span>{order.orderSource === "assisted_sale" && order.status === "cancelled" ? "Reintegro por cancelación:" : "A recibir de MundoBeat:"}</span>
                    <span>{currencyFormatter.format(order.orderSource === "assisted_sale" ? (order.status === "cancelled" ? Number(order.assistedReimbursementAmount) || 0 : 0) : vendorReceivable)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Envío */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-200 bg-slate-50 py-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><Truck className="h-4 w-4" /></span>
                Envío
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 text-sm">
              <div>
                <p className="text-gray-600">Método</p>
                <p className="font-semibold">{order.shippingMethod || "—"}</p>
              </div>
              <div>
                <p className="text-gray-600 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  Dirección
                </p>
                <p className="font-semibold text-sm">
                  {order.shippingAddress}{order.shippingNumber ? ` ${order.shippingNumber}` : ""}
                </p>
                <p className="text-sm text-gray-600">
                  {order.shippingCity}, {order.shippingRegion}
                </p>
                {(order.externalOrderData?.shipping?.postcode || order.externalOrderData?.billing?.postcode) && (
                  <p className="text-sm text-gray-600">
                    Código postal: {order.externalOrderData?.shipping?.postcode || order.externalOrderData?.billing?.postcode}
                  </p>
                )}
                {order.notes && (
                  <div className="mt-2 border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-gray-700">
                    <span className="font-medium">Indicaciones: </span>{order.notes}
                  </div>
                )}
              </div>
              {order.trackingNumber && (
                <div>
                  <p className="text-gray-600">Número de seguimiento</p>
                  <p className="font-semibold text-sm font-mono">{order.trackingNumber}</p>
                </div>
              )}
              
              {isMercadoLibreOrder && (
                <div className="border-t pt-3 mt-3 space-y-3">
                  <div>
                    <p className="text-gray-600 text-xs">Estado Mercado Envíos</p>
                    <p className="font-medium">{mercadoLibreShipping?.status || order.externalShippingStatus || "Pendiente"}</p>
                    {mercadoLibreShipping?.substatus && <p className="text-xs text-gray-500">{mercadoLibreShipping.substatus}</p>}
                  </div>
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={handleRefreshMercadoLibreShipping} disabled={loadingMercadoLibreShipping}>
                    {loadingMercadoLibreShipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Actualizar desde Mercado Libre
                  </Button>
                  {mercadoLibreShipping?.eligible && (
                    <Button type="button" className="w-full gap-2 bg-sky-600 hover:bg-sky-700" onClick={handleOpenMercadoLibreLabel} disabled={loadingMercadoLibreShipping}>
                      <Package className="h-4 w-4" />
                      Abrir / imprimir etiqueta
                    </Button>
                  )}
                  {mercadoLibreShipping && !mercadoLibreShipping.eligible && mercadoLibreShipping.rawStatus === 'ready_to_ship' && (
                    <p className="text-xs text-amber-700">Mercado Libre todavía no habilita la impresión de esta etiqueta.</p>
                  )}
                  {mercadoLibreShipping?.status === 'delivered' && (
                    <p className="text-xs text-emerald-700">El envío fue entregado. La etiqueta ya no requiere impresión.</p>
                  )}
                </div>
              )}

              {isFalabellaOrder && (
                <div className="border-t pt-3 mt-3 space-y-3">
                  <div>
                    <p className="text-gray-600 text-xs">Estado Falabella</p>
                    <p className="font-medium">{order.externalShippingStatus || order.status || "Pendiente"}</p>
                  </div>
                  <Button type="button" className="w-full gap-2 bg-sky-600 hover:bg-sky-700" onClick={handleOpenFalabellaLabel}>
                    <Package className="h-4 w-4" />
                    Ver etiqueta de Falabella
                  </Button>
                  <p className="text-xs text-gray-500">Falabella habilita la etiqueta cuando la orden está lista para despacho.</p>
                </div>
              )}

              {order.packageSummary && (
                <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="text-xs text-gray-600">Tamaño del paquete</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                      {order.packageSummary.length} × {order.packageSummary.width} × {order.packageSummary.height} cm
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Peso estimado</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                      {Number(order.packageSummary.weight).toLocaleString("es-CL", { maximumFractionDigits: 2 })} kg
                    </p>
                  </div>
                  <p className="col-span-2 text-[11px] text-gray-500">
                    Calculado para {order.packageSummary.itemCount} {order.packageSummary.itemCount === 1 ? "producto" : "productos"}.
                    {order.packageSummary.usesFallback ? " Algunos productos usan medidas de categoría o valores predeterminados." : ""}
                  </p>
                </div>
              )}

              {order.shippingHandledBy === "vendor" && (
                <div className="space-y-3 border-t pt-3">
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <p className="font-semibold">Envío gestionado por la tienda</p>
                    <p className="mt-1 text-xs">La etiqueta de Envia.com quedó deshabilitada para este pedido.</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Courier</p>
                    <p className="font-semibold">{order.externalShippingCarrier}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Motivo</p>
                    <p className="font-medium">{EXTERNAL_SHIPPING_REASONS.find((reason) => reason.value === order.externalShippingReason)?.label || order.externalShippingReason}</p>
                    {order.externalShippingReasonDetail && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{order.externalShippingReasonDetail}</p>}
                  </div>
                  {order.externalShippingEvidenceUrl && (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => window.open(getBackendAssetUrl(order.externalShippingEvidenceUrl), "_blank", "noopener,noreferrer")}>Ver captura adjunta</Button>
                  )}
                  {order.externalShippingTrackingUrl && (
                    <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => window.open(order.externalShippingTrackingUrl, "_blank", "noopener,noreferrer")}>
                      <Truck className="h-4 w-4" /> Rastrear envío
                    </Button>
                  )}
                  <p className="text-xs text-gray-500">
                    {order.orderSource !== 'assisted_sale' ? externalShippingNotice : order.externalShippingPayoutStatus === "paid"
                      ? `El envío por ${currencyFormatter.format(externalShippingPayout)} fue incluido en la liquidación pagada.`
                      : order.externalShippingPayoutStatus === "eligible"
                        ? `El envío por ${currencyFormatter.format(externalShippingPayout)} ya está habilitado para liquidación.`
                      : `El envío por ${currencyFormatter.format(externalShippingPayout)} se habilitará para liquidación cuando el pedido figure entregado.`}
                  </p>
                </div>
              )}

              {/* Envia.com Section */}
              {!isMercadoLibreOrder && order.shippingHandledBy !== "vendor" && (order.enviaCarrier || order.shippingMethodCode?.startsWith('envia-')) && (
                <div className="border-t pt-3 mt-3 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-gray-600 font-medium">Envia.com</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      {order.status === 'processing' && !order.enviaTrackingNumber && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowExternalShipping(true)}
                          disabled={generatingEnviaLabel}
                        >
                          Enviar por otro medio
                        </Button>
                      )}
                      {order.status === 'processing' && !order.enviaTrackingNumber && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleQuoteOtherCourier}
                          disabled={loadingShippingQuotes || generatingEnviaLabel}
                          className="gap-2"
                        >
                          {loadingShippingQuotes ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Truck className="h-4 w-4" />
                          )}
                          Cotizar otro courier
                        </Button>
                      )}
                      {/* Botón Generar Etiqueta - solo disponible en estado "processing" y si NO hay tracking number */}
                      {order.status === 'processing' && !order.enviaTrackingNumber && !canRetryEnviaLabel && order.enviaShippingStatus !== 'failed' && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleGenerateEnviaLabel}
                          disabled={generatingEnviaLabel}
                          className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                        >
                          {generatingEnviaLabel ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Generando...
                            </>
                          ) : (
                            <>
                              <Package className="w-4 h-4" />
                              Generar Etiqueta
                            </>
                          )}
                        </Button>
                      )}
                      {order.status === 'processing' && !order.enviaTrackingNumber && (canRetryEnviaLabel || order.enviaShippingStatus === 'failed') && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleRetryEnviaLabel}
                          disabled={retrying || generatingEnviaLabel}
                          className="gap-2 border-amber-500 text-amber-700 hover:bg-amber-50"
                        >
                          {retrying ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Reintentando...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4" />
                              Reintentar etiqueta
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {Number(order.enviaQuotedPrice) > 0 && (
                    <div>
                      <p className="text-gray-600 text-xs">
                        {shippingCost === 0 ? "Costo asumido por la tienda" : "Precio cotizado"}
                      </p>
                      <p className="font-mono text-sm">${Number(order.enviaQuotedPrice).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                  )}
                  
                  {order.enviaShipmentId && (
                    <div>
                      <p className="text-gray-600 text-xs">Shipment ID</p>
                      <p className="font-mono text-sm">{order.enviaShipmentId}</p>
                    </div>
                  )}
                  
                  {order.enviaShippingStatus && (
                    <div>
                      <p className="text-gray-600 text-xs">Estado de Envío</p>
                      <Badge className={`mt-1 ${getEnviaStatusBadge(order.enviaShippingStatus).className}`}>
                        {getEnviaStatusBadge(order.enviaShippingStatus).label}
                      </Badge>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Última actualización: {formatTrackingUpdatedAt(order.enviaLastTrackingUpdate)}
                      </p>
                    </div>
                  )}
                  
                  {order.enviaLabelUrl && (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => window.open(order.enviaLabelUrl, '_blank')}
                        className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Package className="w-4 h-4" />
                        Ver etiqueta de envío
                      </Button>
                    </div>
                  )}
                  
                  {order.enviaTrackingUrl && (
                    <div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSyncTracking}
                        disabled={syncingTracking}
                        className="w-full gap-2"
                      >
                        {syncingTracking ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sincronizando...
                          </>
                        ) : (
                          <>
                            <Truck className="w-4 h-4" />
                            Rastrear Envío
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información adicional */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-200 bg-slate-50 py-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><Calendar className="h-4 w-4" /></span>
                Información
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 text-sm">
              <div>
                <p className="text-gray-600">Fecha de creación</p>
                <p className="font-semibold">{orderDate}</p>
              </div>
              <div>
                <p className="text-gray-600">Número de pedido</p>
                <p className="font-semibold font-mono">#{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-gray-600">ID del pedido</p>
                <p className="font-mono text-xs text-gray-500">{order.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showExternalShipping} onOpenChange={setShowExternalShipping}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar por otro medio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Al registrar este despacho no podrás generar una etiqueta de Envia.com. El monto cobrado por envío se agregará a tu liquidación cuando el pedido sea entregado.
            </div>
            <div className="space-y-2">
              <Label>¿Por qué usarás otro medio? *</Label>
              <Select value={externalShippingReason} onValueChange={setExternalShippingReason}>
                <SelectTrigger><SelectValue placeholder="Selecciona un motivo" /></SelectTrigger>
                <SelectContent>
                  {EXTERNAL_SHIPPING_REASONS.map((reason) => <SelectItem key={reason.value} value={reason.value}>{reason.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(externalShippingReason === "platform_error" || externalShippingReason === "other") && (
              <div className="space-y-2">
                <Label>{externalShippingReason === "platform_error" ? "Describe el error *" : "Describe el motivo *"}</Label>
                <textarea
                  value={externalShippingDetail}
                  onChange={(event) => setExternalShippingDetail(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder={externalShippingReason === "platform_error" ? "Indica qué ocurrió al intentar usar Envia.com" : "Indica por qué utilizarás otro medio"}
                  className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
            )}
            {externalShippingReason === "platform_error" && (
              <div className="space-y-2">
                <Label htmlFor="external-shipping-evidence">Captura del error (opcional)</Label>
                <Input
                  id="external-shipping-evidence"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setExternalShippingEvidence(event.target.files?.[0] || null)}
                />
                <p className="text-xs text-gray-500">JPG, PNG o WEBP, máximo 10 MB.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="external-shipping-carrier">Courier o medio de entrega *</Label>
              <Input id="external-shipping-carrier" value={externalShippingCarrier} onChange={(event) => setExternalShippingCarrier(event.target.value)} maxLength={120} placeholder="Ej: Chilexpress, transporte propio" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-shipping-tracking">Número de seguimiento *</Label>
              <Input id="external-shipping-tracking" value={externalShippingTracking} onChange={(event) => setExternalShippingTracking(event.target.value)} maxLength={150} placeholder="Número de guía o referencia de entrega" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-shipping-url">Enlace de seguimiento (opcional)</Label>
              <Input id="external-shipping-url" type="url" value={externalShippingTrackingUrl} onChange={(event) => setExternalShippingTrackingUrl(event.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowExternalShipping(false)} disabled={savingExternalShipping}>Cancelar</Button>
            <Button
              type="button"
              onClick={handleUseExternalShipping}
              disabled={
                savingExternalShipping
                || !externalShippingReason
                || !externalShippingCarrier.trim()
                || !externalShippingTracking.trim()
                || (["platform_error", "other"].includes(externalShippingReason) && !externalShippingDetail.trim())
              }
            >
              {savingExternalShipping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar despacho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de agregar producto */}
      <Dialog open={showShippingQuotes} onOpenChange={setShowShippingQuotes}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cotizar otro courier</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600">
            Selecciona una opción para cambiar el transporte del pedido. Esto no genera ni compra la etiqueta.
          </p>

          {loadingShippingQuotes ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Consultando couriers habilitados...
            </div>
          ) : shippingQuotes.length > 0 ? (
            <div className="space-y-3 py-2">
              {shippingQuotes.map((quote) => {
                const key = `${quote.carrier}:${quote.service}`;
                const selectedKey = selectedShippingQuote
                  ? `${selectedShippingQuote.carrier}:${selectedShippingQuote.service}`
                  : "";
                const isSelected = key === selectedKey;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedShippingQuote(quote)}
                    className={`flex w-full items-center gap-4 rounded-md border p-4 text-left transition-colors ${
                      isSelected ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <span className={`h-4 w-4 shrink-0 rounded-full border ${isSelected ? "border-[5px] border-indigo-600" : "border-gray-400"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-gray-900">
                        {quote.carrier} - {quote.serviceDescription || quote.service}
                      </span>
                      {quote.deliveryEstimate && (
                        <span className="mt-1 block text-xs text-gray-500">Entrega estimada: {quote.deliveryEstimate}</span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold text-gray-900">
                      ${Math.round(Number(quote.totalPrice) || 0).toLocaleString("es-CL")}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No se encontraron opciones disponibles para la dirección de este pedido.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowShippingQuotes(false)} disabled={selectingShippingQuote}>
              Cerrar
            </Button>
            <Button type="button" onClick={handleSelectShippingQuote} disabled={!selectedShippingQuote || selectingShippingQuote}>
              {selectingShippingQuote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Usar esta opción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar producto al pedido</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Búsqueda */}
            <div className="flex gap-2">
              <Input
                placeholder="Buscar producto por nombre o artista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchProducts()}
                className="flex-1"
              />
              <Button onClick={handleSearchProducts} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {/* Resultados de búsqueda */}
            {searchResults.length > 0 && !selectedProduct && (
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                    onClick={() => handleSelectProduct(product)}
                  >
                    <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                      {product.images && product.images[0] ? (
                        <img
                          src={getImageUrl(product.images[0])}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-gray-400 text-xl">🎵</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{product.name}</p>
                      <p className="text-xs text-gray-600">{product.artist}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-semibold text-blue-600">
                          {currencyFormatter.format(product.price)}
                        </span>
                        <span className={`text-xs ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}>
                          Stock: {product.stock}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Producto seleccionado */}
            {selectedProduct && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                      {selectedProduct.images && selectedProduct.images[0] ? (
                        <img
                          src={getImageUrl(selectedProduct.images[0])}
                          alt={selectedProduct.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-gray-400 text-2xl">🎵</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{selectedProduct.name}</p>
                      <p className="text-sm text-gray-600">{selectedProduct.artist}</p>
                      <p className="text-sm font-semibold text-blue-600 mt-1">
                        {currencyFormatter.format(selectedProduct.price)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Stock disponible: {selectedProduct.stock}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label>Cantidad</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setProductQuantity(Math.max(1, productQuantity - 1))}
                        disabled={productQuantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        max={selectedProduct.stock}
                        value={productQuantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setProductQuantity(Math.min(selectedProduct.stock, Math.max(1, val)));
                        }}
                        className="w-20 text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setProductQuantity(Math.min(selectedProduct.stock, productQuantity + 1))}
                        disabled={productQuantity >= selectedProduct.stock}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-gray-600 ml-2">
                        Subtotal: {currencyFormatter.format(selectedProduct.price * productQuantity)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedProduct(null);
                        setProductQuantity(1);
                      }}
                      className="flex-1"
                    >
                      Cambiar producto
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAddProduct}
                      disabled={updatingItem === "adding" || productQuantity > selectedProduct.stock}
                      className="flex-1"
                    >
                      {updatingItem === "adding" ? "Agregando..." : "Agregar al pedido"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <div className="text-center py-8 text-gray-500">
                No se encontraron productos
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              ¿Estás seguro de eliminar este producto del pedido? El stock será restaurado automáticamente.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setItemToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmRemoveItem}
            >
              Eliminar producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de sincronización de tracking */}
      <Dialog open={showSyncModal} onOpenChange={setShowSyncModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {syncResult?.statusChanged ? "✓ Pedido Actualizado" : "Estado de Seguimiento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-gray-700">
              {syncResult?.message}
            </p>

            {syncResult?.statusChanged && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-sm text-emerald-800">
                  <strong>El pedido ha sido cerrado correctamente.</strong>
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  Estado anterior: <strong>{syncResult?.previousStatus}</strong> → 
                  Estado actual: <strong>{syncResult?.newStatus}</strong>
                </p>
                {syncResult?.enviaShippingStatus && (
                  <p className="text-xs text-emerald-700 mt-1">
                    Estado de Envia: <strong>{getEnviaStatusBadge(syncResult.enviaShippingStatus).label}</strong>
                  </p>
                )}
                <RefundStatusPanel refund={order.refund} />
              </div>
            )}

            {!syncResult?.success && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <p className="text-sm text-rose-800">
                  <strong>Error:</strong> {syncResult?.message}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {syncResult?.statusChanged ? (
              <Button
                type="button"
                onClick={() => {
                  setShowSyncModal(false);
                  setSyncResult(null);
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Aceptar
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowSyncModal(false);
                    setSyncResult(null);
                  }}
                >
                  Cerrar
                </Button>
                <Button
                  type="button"
                  onClick={() => window.open(order?.enviaTrackingUrl, '_blank')}
                >
                  Ver Tracking Externo
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(productPreview)} onOpenChange={(open) => { if (!open) setProductPreview(null); }}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{productPreview?.title || "Imagen del producto"}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[calc(92vh-74px)] min-h-72 items-center justify-center bg-slate-950 p-4 sm:p-6">
            {productPreview && (
              <img
                src={productPreview.url}
                alt={productPreview.title}
                className="max-h-[calc(92vh-122px)] max-w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(proofPreviewUrl)} onOpenChange={(open) => { if (!open) setProofPreviewUrl(null); }}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Comprobante de devolución</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-[320px] items-center justify-center overflow-auto bg-gray-50 p-4">
            {proofPreviewUrl && proofPreviewUrl.toLowerCase().split("?")[0].endsWith(".pdf") ? (
              <iframe
                src={proofPreviewUrl}
                title="Comprobante de devolución"
                className="h-[72vh] w-full rounded border bg-white"
              />
            ) : proofPreviewUrl ? (
              <img
                src={proofPreviewUrl}
                alt="Comprobante de devolución"
                className="max-h-[72vh] max-w-full rounded object-contain shadow-sm"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
