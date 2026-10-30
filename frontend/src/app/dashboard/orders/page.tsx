"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, ChevronLeft, ChevronRight, CircleHelp, Database, FileText, HandCoins, Loader2, MoreVertical, ReceiptText, RefreshCw, Search, ShoppingBag, StickyNote, Wifi, X } from "lucide-react";

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

const shippingStatusMap: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pendiente", badge: "bg-amber-100 text-amber-800" },
  generated: { label: "Etiqueta creada", badge: "bg-blue-100 text-blue-800" },
  picked_up: { label: "Recogido", badge: "bg-yellow-100 text-yellow-800" },
  in_transit: { label: "En tránsito", badge: "bg-purple-100 text-purple-800" },
  delivered: { label: "Entregado", badge: "bg-green-100 text-green-800" },
};

const noLabelShippingBadge = { label: "Sin etiqueta", badge: "bg-gray-100 text-gray-800" };
const externalShippingBadge = { label: "Enviado por otro transportista", badge: "bg-orange-100 text-orange-800" };
const cancelledWithoutShippingBadge = { label: "—", badge: "bg-transparent text-gray-500 shadow-none" };
const pendingLabelCancellationBadge = { label: "Anulación pendiente", badge: "bg-amber-100 text-amber-800" };
const cancelledLabelBadge = { label: "Etiqueta anulada", badge: "bg-gray-100 text-gray-700" };

const salesChannelLogos: Record<string, { label: string; url: string }> = {
  paris: {
    label: "Paris",
    url: "http://localhost:3001/media/8a25f1ad-4621-4305-a8d9-21d9c362b19e.png",
  },
  ripley: {
    label: "Ripley",
    url: "http://localhost:3001/media/df95ed76-7a85-4aeb-a36b-1849c9faa8bd.png",
  },
  mercadolibre: {
    label: "Mercado Libre",
    url: "http://localhost:3001/media/2c443324-54e3-4a86-ba24-4ccd569a9cb0.png",
  },
  falabella: {
    label: "Falabella",
    url: "http://localhost:3001/media/fd3d3024-4db0-42e2-826a-248b6a0699e3.png",
  },
  woocommerce: {
    label: "WooCommerce",
    url: "http://localhost:3001/media/af3123ba-d51c-472b-8d7b-2e561efbbfd7.png",
  },
};

const saleTypes = [
  ['marketplace', 'MundoBeat'], ['assisted_sale', 'Venta asistida'],
  ['mercadolibre', 'Mercado Libre'], ['paris', 'Paris'], ['falabella', 'Falabella'],
  ['ripley', 'Ripley'], ['woocommerce', 'WooCommerce'], ['online_store', 'Tienda online'],
];
function getSaleType(order: any) {
  const source = String(order.orderSource || '').trim().toLowerCase();
  if (source === 'direct_store' || source === 'custom_domain') return 'online_store';
  return source || 'marketplace';
}

function SalesChannelIcon({ order }: { order: any }) {
  const source = String(order?.orderSource || "").toLowerCase();
  const channel = salesChannelLogos[source];
  if (channel) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center" title={channel.label} aria-label={channel.label}>
        <Image src={channel.url} alt={channel.label} width={30} height={30} className="h-[30px] w-[30px] object-contain" />
      </span>
    );
  }
  if (source === "pos") {
    return <span className="inline-flex h-8 w-8 items-center justify-center" title="Punto de venta" aria-label="Punto de venta"><ShoppingBag className="h-5 w-5 text-amber-600" /></span>;
  }
  if (source === "assisted_sale") {
    return <span className="inline-flex h-8 w-8 items-center justify-center" title="Venta asistida" aria-label="Venta asistida"><HandCoins className="h-5 w-5 text-emerald-600" /></span>;
  }
  return <span className="inline-flex h-8 w-8 items-center justify-center" title="MundoBeat" aria-label="MundoBeat"><Database className="h-5 w-5 text-purple-600" /></span>;
}

function getShippingBadge(order: any): { label: string; badge: string } {
  const orderIsCancelled = ['cancelled', 'refunded'].includes(String(order?.status || '').toLowerCase());

  if (order?.orderSource === 'mercadolibre') {
    const status = String(order.externalShippingStatus || '').toLowerCase();
    if (status === 'delivered') return shippingStatusMap.delivered;
    if (['shipped', 'in_transit'].includes(status)) return shippingStatusMap.in_transit;
    if (orderIsCancelled) return cancelledWithoutShippingBadge;
    if (status === 'ready_to_ship') return { label: 'Preparando envío ML', badge: 'bg-sky-100 text-sky-800' };
    return { label: 'Mercado Envíos', badge: 'bg-sky-100 text-sky-800' };
  }
  const hasLabelData = Boolean(
    order?.enviaTrackingNumber || order?.enviaLabelUrl || order?.enviaShipmentId,
  );
  const normalizedStatus = String(order?.enviaShippingStatus || "").toLowerCase().trim();

  if (orderIsCancelled) {
    if (['picked_up', 'in_transit', 'delivered'].includes(normalizedStatus)) {
      return shippingStatusMap[normalizedStatus];
    }
    if (order?.assistedReimbursementStatus === 'pending_shipping_cancellation') {
      return pendingLabelCancellationBadge;
    }
    if (order?.assistedShippingCancellationConfirmedAt || order?.assistedShippingRefundStatus === 'confirmed') {
      return cancelledLabelBadge;
    }
    if (!hasLabelData) {
      return cancelledWithoutShippingBadge;
    }
  }

  const isExternalShipping = order?.shippingHandledBy === 'vendor'
    || order?.shippingMethodCode === 'vendor-external'
    || Boolean(order?.externalShippingCarrier);
  if (!orderIsCancelled && isExternalShipping && !hasLabelData) {
    return externalShippingBadge;
  }

  if (!hasLabelData && !normalizedStatus) {
    return noLabelShippingBadge;
  }

  // Envia puede devolver pending aun con etiqueta ya creada.
  // Si ya existe tracking/label, mostramos "Etiqueta creada" para evitar falsos "Sin etiqueta".
  if (hasLabelData && (!normalizedStatus || normalizedStatus === "pending")) {
    return shippingStatusMap.generated;
  }

  return shippingStatusMap[normalizedStatus] || { label: normalizedStatus || "Sin estado", badge: "bg-gray-100 text-gray-800" };
}

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

const ITEMS_PER_PAGE = 10;

function getSaleAmount(order: any) {
  const subtotal = Number(order?.subtotal);
  if (order?.subtotal !== null && order?.subtotal !== undefined && Number.isFinite(subtotal)) return subtotal;
  return Math.max(0, Number(order?.total || 0) - Number(order?.shippingCost || 0));
}

function getVendorReceivable(order: any) {
  const vendorAmount = Number(order?.vendorAmount);
  return order?.vendorAmount !== null && order?.vendorAmount !== undefined && Number.isFinite(vendorAmount)
    ? vendorAmount
    : getSaleAmount(order);
}

export default function DashboardOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [noteOrder, setNoteOrder] = useState<any | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  
  // Filtros
  const [searchClient, setSearchClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("without_pending");
  const [filterType, setFilterType] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  
  // Estado de ordenamiento
  type SortField = 'orderNumber' | 'createdAt' | 'shippingName' | 'subtotal' | 'status';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Toggle: pedidos físicos (POS) vs pedidos online
  const [posView, setPosView] = useState(false);

  useEffect(() => {
    // Verificar si hay token antes de cargar
    const token = api.getToken();
    if (token) {
      loadOrders(posView);
    } else {
      setLoading(false);
      setError("Debes iniciar sesión para ver los pedidos de tu tienda.");
    }
  }, [posView]);

  const loadOrders = async (pos = false) => {
    setLoading(true);
    setError("");

    try {
      const data = await api.getVendorOrders(undefined, pos ? 'pos' : undefined);
      setOrders(data);
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

  // Función para cambiar ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Si ya está ordenado por este campo, cambiar dirección
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nuevo campo, ordenar ascendente por defecto
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtrar y ordenar pedidos
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];
    if (filterType !== 'all') filtered = filtered.filter(order => getSaleType(order) === filterType);

    // Filtro compartido por nombre de cliente o producto del pedido.
    if (searchClient.trim()) {
      const normalizeSearchValue = (value: unknown) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const searchLower = normalizeSearchValue(searchClient.trim());

      filtered = filtered.filter((order) => {
        const matchesCustomer = normalizeSearchValue(order.shippingName).includes(searchLower);
        const matchesProduct = Array.isArray(order.items) && order.items.some((item: any) =>
          [item.productTitle, item.product?.title, item.product?.sku]
            .some((value) => normalizeSearchValue(value).includes(searchLower))
        );
        return matchesCustomer || matchesProduct;
      });
    }

    // En pedidos online ocultamos pendientes por defecto.
    // Solo aparecen si el filtro se establece explicitamente en "pending".
    if (!posView && (!filterStatus || filterStatus === "without_pending")) {
      filtered = filtered.filter((order) => order.status !== "pending" || order.orderSource === "assisted_sale");
    } else if (filterStatus && filterStatus !== "all") {
      filtered = filtered.filter((order) => order.status === filterStatus);
    }

    // Filtro por fecha desde
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate >= fromDate;
      });
    }

    // Filtro por fecha hasta
    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate <= toDate;
      });
    }

    // Ordenar
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Manejar diferentes tipos de valores
      if (sortField === 'createdAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortField === 'subtotal') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else if (sortField === 'orderNumber') {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      } else if (sortField === 'shippingName') {
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      } else if (sortField === 'status') {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [orders, searchClient, filterStatus, filterType, filterDateFrom, filterDateTo, sortField, sortDirection]);

  // Calcular paginación con pedidos filtrados
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  // Resetear página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchClient, filterStatus, filterType, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterType('all');
    setSearchClient("");
    setFilterStatus("without_pending");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasActiveFilters =
    Boolean(searchClient || filterDateFrom || filterDateTo || filterType !== 'all') ||
    filterStatus !== "without_pending";

  const pendingCount = useMemo(
    () => orders.filter((order) => order.status === "pending" && order.orderSource !== "assisted_sale").length,
    [orders],
  );

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const openNoteDialog = (order: any) => {
    setNoteOrder(order);
    setNoteText("");
  };

  const saveNote = async () => {
    if (!noteOrder || !noteText.trim()) return;
    setSavingNote(true);
    setError("");
    try {
      await api.addOrderNote(noteOrder.id, noteText.trim());
      setNoteOrder(null);
      setNoteText("");
    } catch (err: any) {
      setError(err.message || "No se pudo agregar la nota");
    } finally {
      setSavingNote(false);
    }
  };

  const chooseReceipt = (order: any) => {
    setReceiptOrder(order);
    window.setTimeout(() => receiptInputRef.current?.click(), 0);
  };

  const uploadReceipt = async (file?: File) => {
    if (!file || !receiptOrder) return;
    setUploadingReceipt(true);
    setError("");
    try {
      const updated = await api.uploadOrderSalesReceipt(receiptOrder.id, file);
      setOrders((current) => current.map((order) => order.id === updated.id ? { ...order, ...updated } : order));
    } catch (err: any) {
      setError(err.message || "No se pudo adjuntar la boleta");
    } finally {
      setUploadingReceipt(false);
      setReceiptOrder(null);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  };

  const renderActionsMenu = (order: any) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-700"
          aria-label={`Acciones del pedido ${order.orderNumber}`}
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/orders/${order.id}`}><FileText />Ver detalle</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openNoteDialog(order)}>
          <StickyNote />Agregar nota
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => chooseReceipt(order)} disabled={uploadingReceipt}>
          <ReceiptText />{order.salesReceiptUrl ? "Actualizar boleta" : "Adjuntar boleta"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <CircleHelp />Necesito ayuda
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderOrders = () => {
    if (loading) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin w-6 h-6" />
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-lg font-semibold text-red-700">No se pudieron cargar las ventas</p>
            <p className="max-w-xl text-sm text-gray-600">{error}</p>
            <Button variant="outline" onClick={() => loadOrders(posView)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (orders.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12 space-y-2">
            <p className="text-lg font-semibold">Aún no recibes pedidos</p>
            <p className="text-sm text-gray-500">
              Tus clientes verán sus compras aquí cuando paguen en tu tienda.
            </p>
          </CardContent>
        </Card>
      );
    }

    if (filteredOrders.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-12 space-y-2">
            <Search className="w-12 h-12 mx-auto text-gray-400" />
            <p className="text-lg font-semibold">No se encontraron pedidos</p>
            <p className="text-sm text-gray-500">
              Prueba ajustando los filtros de búsqueda
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
                <X className="w-4 h-4 mr-2" />
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-gray-100">
          {currentOrders.map((order) => {
            const badgeMeta = getBadgeMeta(order);
            const createdAt = new Date(order.createdAt).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            return (
              <div key={order.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50">
                <Link href={`/dashboard/orders/${order.id}`} className="min-w-0 flex-1 active:opacity-80">
                  <div className="flex items-center gap-1.5">
                    <SalesChannelIcon order={order} />
                    <span className="text-sm font-semibold text-gray-900">#{order.orderNumber}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">{order.shippingName}</p>
                  <p className="text-xs text-gray-400">{createdAt}</p>
                  {posView ? (
                    <Badge className="bg-amber-100 text-amber-800 text-xs mt-1 capitalize">
                      {order.paymentMethod || 'Efectivo'}
                    </Badge>
                  ) : (
                    <Badge className={`${getShippingBadge(order).badge} text-xs mt-1`}>
                      {getShippingBadge(order).label}
                    </Badge>
                  )}
                </Link>
                <div className="flex shrink-0 items-start gap-2">
                  <div className="space-y-1 text-right">
                  <p className="text-sm font-semibold text-gray-900">{currencyFormatter.format(getSaleAmount(order))}</p>
                  <p className="text-xs font-semibold text-green-600">Recibes {currencyFormatter.format(getVendorReceivable(order))}</p>
                  <Badge className={`${badgeMeta.badge} text-xs`}>{badgeMeta.label}</Badge>
                  </div>
                  {renderActionsMenu(order)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-16 px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Canal
                </th>
                <th 
                  className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('orderNumber')}
                >
                  <div className="flex items-center gap-1">
                    ID Pedido
                    {sortField === 'orderNumber' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1">
                    Fecha
                    {sortField === 'createdAt' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('shippingName')}
                >
                  <div className="flex items-center gap-1">
                    Cliente
                    {sortField === 'shippingName' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('subtotal')}
                >
                  <div className="flex items-center gap-1">
                    Valor venta
                    {sortField === 'subtotal' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Estado / Envío
                    {sortField === 'status' && (
                      <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentOrders.map((order) => {
                const badgeMeta = getBadgeMeta(order);
                const createdAt = new Date(order.createdAt).toLocaleDateString("es-CL", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });

                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <SalesChannelIcon order={order} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="text-sm font-semibold text-cyan-700 hover:text-cyan-900 hover:underline"
                        >
                          #{order.orderNumber}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{createdAt}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.shippingName}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{currencyFormatter.format(getSaleAmount(order))}</div>
                      <div className="mt-0.5 text-xs font-semibold text-green-600">
                        Recibes {currencyFormatter.format(getVendorReceivable(order))}
                      </div>
                      {order.isMarketplaceSale && (
                        <div className="text-xs text-gray-500">-{order.commissionPercentage || 0}% comisión</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1.5">
                        <Badge className={badgeMeta.badge}>{badgeMeta.label}</Badge>
                        {posView ? (
                        <Badge className="bg-amber-100 text-amber-800 capitalize">
                          {order.paymentMethod || 'Efectivo'}
                        </Badge>
                        ) : (
                          <Badge className={getShippingBadge(order).badge}>
                            {getShippingBadge(order).label}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {renderActionsMenu(order)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* end desktop table */}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Mostrando {startIndex + 1} - {Math.min(endIndex, filteredOrders.length)} de {filteredOrders.length} pedidos
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <span className="text-sm text-gray-700">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
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
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Órdenes</h1>
          <p className="text-gray-600">{error}</p>
        </div>
        <div className="flex justify-center">
          <Link href="/dashboard/login">
            <Button>Iniciar sesión</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Órdenes</h1>
          <p className="text-gray-600 mt-1">
            {posView ? "Pedidos físicos (Punto de Venta)" : "Lista de pedidos recibidos"}
          </p>
          {!posView && pendingCount > 0 && (
            <p className="text-xs text-amber-700 mt-1">
              {pendingCount} pedido{pendingCount !== 1 ? "s" : ""} pendiente{pendingCount !== 1 ? "s" : ""} oculto{pendingCount !== 1 ? "s" : ""} por defecto
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {!posView && (
          <>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/dashboard/orders/shipping-quote">
              <Calculator className="h-4 w-4" /> Cotizar envío
            </Link>
          </Button>
          <Button asChild className="gap-2">
            <Link href="/dashboard/orders/assisted/new">
              <HandCoins className="h-4 w-4" /> Nueva venta asistida
            </Link>
          </Button>
          </>
        )}
        <Button
          variant={posView ? "default" : "outline"}
          onClick={() => {
            setPosView((v) => !v);
            setFilterType('all');
            setCurrentPage(1);
            setSearchClient("");
            setFilterStatus("without_pending");
            setFilterDateFrom("");
            setFilterDateTo("");
          }}
          className={`gap-2 ${
            posView
              ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
              : "border-amber-400 text-amber-700 hover:bg-amber-50"
          }`}
        >
          {posView ? (
            <><Wifi className="w-4 h-4" /> Ver pedidos online</>
          ) : (
            <><ShoppingBag className="w-4 h-4" /> Ver pedidos físicos</>
          )}
        </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className={`grid grid-cols-1 md:grid-cols-2 ${posView ? 'xl:grid-cols-4' : 'xl:grid-cols-5'} gap-4`}>
            <div className="space-y-2">
              <Label htmlFor="search-client">Cliente o producto</Label>
              <Input
                id="search-client"
                placeholder="Buscar por cliente o producto..."
                value={searchClient}
                onChange={(e) => {
                  setSearchClient(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-status">Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  {!posView && <SelectItem value="without_pending">Todos excepto pendientes</SelectItem>}
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {Object.entries(statusMap).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!posView && <div className="min-w-0 space-y-2">
              <Label htmlFor="filter-type">Tipo de venta</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger id="filter-type" className="w-full"><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {saleTypes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>}
            <div className="space-y-2">
              <Label htmlFor="filter-date-from">Fecha desde</Label>
              <Input
                id="filter-date-from"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-date-to">Fecha hasta</Label>
              <Input
                id="filter-date-to"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {filteredOrders.length} pedido{filteredOrders.length !== 1 ? "s" : ""} encontrado{filteredOrders.length !== 1 ? "s" : ""}
              </p>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-2" />
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {renderOrders()}

      <input
        ref={receiptInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(event) => uploadReceipt(event.target.files?.[0])}
      />

      <Dialog open={Boolean(noteOrder)} onOpenChange={(open) => { if (!open && !savingNote) setNoteOrder(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar nota al pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="order-note">Nota interna</Label>
            <Textarea
              id="order-note"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="Escribe información útil para el seguimiento del pedido..."
            />
            <p className="text-right text-xs text-slate-500">{noteText.length}/1000</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNoteOrder(null)} disabled={savingNote}>Cancelar</Button>
            <Button type="button" onClick={saveNote} disabled={savingNote || !noteText.trim()}>
              {savingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
