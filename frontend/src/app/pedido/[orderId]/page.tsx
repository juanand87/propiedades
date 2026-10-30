"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getImageUrl } from "@/lib/utils";
import { getStoreUrl } from "@/lib/useCustomDomain";
import Link from "next/link";
import { CheckCircle, Package, ArrowLeft, Phone, Mail, MapPin, Loader2, Clock, XCircle, Eye, EyeOff, Sparkles } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { SalesReceiptLink } from "@/components/orders/SalesReceiptLink";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

export default function OrderConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const urlStatus = searchParams.get("status");

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [storeUrl, setStoreUrl] = useState<string>('/');
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const cartClearedRef = useRef(false);
  const { clearCart } = useCart();
  
  // Account creation states
  const [showAccountOffer, setShowAccountOffer] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    loadData();
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [orderId]);

  // Calculate store URL on client side with inline custom domain detection
  useEffect(() => {
    if (orders.length === 1 && orders[0].vendor?.slug) {
      const hostname = window.location.hostname;
      
      // Detect if this is a custom domain (NOT subdomain or marketplace)
      const isCustomDomain = hostname !== 'localhost' 
        && hostname !== '127.0.0.1'
        && hostname !== 'mundobeat.cl' 
        && hostname !== 'www.mundobeat.cl'
        && !hostname.includes('.mundobeat.cl')
        && !hostname.includes('vercel.app');
      
      const url = isCustomDomain ? '/' : `/tiendas/${orders[0].vendor.slug}`;
      
      console.log('🔗 [OrderPage] hostname:', hostname, '| isCustomDomain:', isCustomDomain, '| URL:', url);
      setStoreUrl(url);
    }
  }, [orders]);

  useEffect(() => {
    // Start polling if any order is pending payment
    const hasPendingPayment = orders.some(
      order => order.paymentStatus === "pending" && order.paymentMethod !== "transfer"
    );

    if (hasPendingPayment && !pollingInterval.current) {
      startPolling();
    } else if (!hasPendingPayment && pollingInterval.current) {
      stopPolling();
    }
  }, [orders]);

  const loadData = async () => {
    try {
      const isOrderNumber = orderId.startsWith('ORD-');
      
      if (isOrderNumber) {
        // Try new endpoint for multiple orders
        try {
          const ordersData = await api.getOrdersByNumber(orderId);
          setOrders(Array.isArray(ordersData) ? ordersData : [ordersData]);
        } catch (error) {
          console.warn("New endpoint not available yet, falling back to old method:", error);
          // Fallback: use old endpoint (single order lookup)
          try {
            const orderData = await api.getOrder(orderId);
            setOrders([orderData]);
          } catch (fallbackError) {
            console.error("Fallback also failed:", fallbackError);
            setOrders([]);
          }
        }
      } else {
        // Load single order by UUID
        const orderData = await api.getOrder(orderId);
        setOrders([orderData]);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    console.log("🔄 Starting payment status polling...");
    setIsPolling(true);
    
    pollingInterval.current = setInterval(async () => {
      try {
        const isOrderNumber = orderId.startsWith('ORD-');
        let updatedOrders;
        
        if (isOrderNumber) {
          try {
            updatedOrders = await api.getOrdersByNumber(orderId);
            updatedOrders = Array.isArray(updatedOrders) ? updatedOrders : [updatedOrders];
          } catch (error) {
            // Fallback for polling too
            const orderData = await api.getOrder(orderId);
            updatedOrders = [orderData];
          }
        } else {
          const orderData = await api.getOrder(orderId);
          updatedOrders = [orderData];
        }
        
        setOrders(updatedOrders);
        
        // Stop polling if no more pending payments
        const stillPending = updatedOrders.some(
          order => order.paymentStatus === "pending" && order.paymentMethod !== "transfer"
        );
        
        if (!stillPending) {
          console.log("✅ Payment confirmed! Stopping polling.");
          stopPolling();
          
          // Clear cart only once when payment is confirmed
          if (!cartClearedRef.current) {
            console.log("🛒 Clearing cart after payment confirmation...");
            clearCart();
            cartClearedRef.current = true;
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 10000); // Poll every 10 seconds
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
      setIsPolling(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      processing: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendiente",
      paid: "Pagado",
      processing: "Procesando",
      shipped: "Enviado",
      delivered: "Entregado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pago Pendiente",
      approved: "Pago Aprobado",
      rejected: "Pago Rechazado",
    };
    return labels[status] || status;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      transfer: "Transferencia Bancaria",
      cash: "Efectivo en Entrega",
      credit_card: "Tarjeta de Crédito",
      debit_card: "Tarjeta de Débito",
      paypal: "PayPal",
      payku: "Payku",
    };
    return labels[method] || method;
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError("");

    if (password.length < 6) {
      setAccountError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setAccountError("Las contraseñas no coinciden");
      return;
    }

    setCreating(true);

    try {
      const response = await api.post("/customers/convert-guest", {
        orderNumber: firstOrder.orderNumber,
        email: firstOrder.customerEmail,
        password,
      });

      if (response.success) {
        setAccountCreated(true);
        setTimeout(() => {
          router.push("/login?email=" + encodeURIComponent(firstOrder.customerEmail));
        }, 3000);
      } else {
        setAccountError(response.message || "Error al crear la cuenta");
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Error al crear la cuenta";
      
      if (errorMessage.includes("ya existe")) {
        setAccountError("Ya tienes una cuenta con este email. Puedes iniciar sesión.");
      } else {
        setAccountError(errorMessage);
      }
    } finally {
      setCreating(false);
    }
  };

  // Check if there are pending payments (not transfer)
  const hasPendingPayment = orders.some(
    order => order.paymentStatus === "pending" && order.paymentMethod !== "transfer"
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">Pedido no encontrado</h1>
              <Link href="/">
                <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al inicio
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const firstOrder = orders[0];
  const totalAmount = orders.reduce((sum, order) => sum + (order.total || 0), 0);

  // Detect if user cancelled or payment was rejected
  const wasCancelled = urlStatus === 'cancelled';
  const wasRejected = urlStatus === 'rejected';
  const wasPaymentError = urlStatus === 'error';
  const hadPaymentIssue = wasCancelled || wasRejected || wasPaymentError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Success Header - Hide if payment was cancelled/rejected */}
        {!hadPaymentIssue && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {hasPendingPayment ? "¡Pedido Registrado!" : "¡Pedido Confirmado!"}
            </h1>
            <p className="text-gray-600">
              {orders.length > 1
                ? `Tu compra incluye ${orders.length} pedidos de diferentes tiendas`
                : `Gracias por tu compra${firstOrder.vendor?.storeName ? ` en ${firstOrder.vendor.storeName}` : ''}`}
            </p>
          </div>
        )}

        {/* Payment Cancelled/Rejected Banner */}
        {hadPaymentIssue && (
          <Card className="mb-6 border-orange-300 bg-orange-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <XCircle className="w-10 h-10 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-orange-900 mb-2">
                    {wasCancelled && "Pago Cancelado"}
                    {wasRejected && "Pago Rechazado"}
                    {wasPaymentError && "Error en el Pago"}
                  </h2>
                  <p className="text-orange-800 mb-4">
                    {wasCancelled && "Cerraste la ventana de pago antes de completar la transacción."}
                    {wasRejected && "El pago fue rechazado. Por favor verifica tus datos e intenta nuevamente."}
                    {wasPaymentError && "Ocurrió un error al procesar el pago."}
                  </p>
                  <p className="text-orange-700 text-sm">
                    Tu pedido fue registrado pero NO ha sido pagado. Puedes intentar pagar nuevamente o contactar con la tienda.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Validation Banner */}
        {hasPendingPayment && (
          <Card className="mb-6 border-blue-300 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {isPolling ? (
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  ) : (
                    <Clock className="w-8 h-8 text-blue-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    ✅ Tu pedido ha sido registrado correctamente
                  </h3>
                  <p className="text-blue-800 mb-2">
                    ⏳ Estamos validando tu pago con el banco. Esto puede tardar 1-3 minutos.
                  </p>
                  {isPolling && (
                    <p className="text-sm text-blue-700 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                      Verificando estado del pago automáticamente...
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Orders Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Render each order */}
            {orders.map((order, index) => (
              <div key={order.id} className="space-y-6">
                {/* Order Header - Only show if multiple orders */}
                {orders.length > 1 && (
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">
                      Pedido de {order.vendor?.storeName || 'Tienda'}
                    </h2>
                  </div>
                )}

                {/* Order Info */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle>Detalles del Pedido</CardTitle>
                      <div className="flex gap-2">
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusLabel(order.status)}
                        </Badge>
                        {order.paymentStatus && (
                          <Badge 
                            className={
                              order.paymentStatus === "approved" 
                                ? "bg-green-100 text-green-800"
                                : order.paymentStatus === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {getPaymentStatusLabel(order.paymentStatus)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Número de Pedido:</span>
                        <p className="font-semibold">{order.orderNumber}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Fecha:</span>
                        <p className="font-semibold">
                          {new Date(order.createdAt).toLocaleDateString('es-CL', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Método de Pago:</span>
                        <p className="font-semibold">{getPaymentMethodLabel(order.paymentMethod)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Total:</span>
                        <p className="font-semibold text-lg text-purple-600">
                          ${order.total?.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <SalesReceiptLink url={order.salesReceiptUrl} qrImageUrl={order.salesReceiptQrImageUrl} token={order.salesReceiptToken} />
                      </div>
                    </div>

                    {order.paymentMethod === 'transfer' && order.status === 'pending' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                        <h3 className="font-semibold text-blue-900 mb-2">Instrucciones de Pago</h3>
                        <p className="text-sm text-blue-800 mb-3">
                          El vendedor se pondrá en contacto contigo para proporcionarte los datos de transferencia.
                        </p>
                        <p className="text-xs text-blue-700">
                          Por favor, incluye el número de pedido <strong>{order.orderNumber}</strong> en la referencia de la transferencia.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Products */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Productos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {order.items?.map((item: any) => (
                        <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                          <div className="w-20 h-20 bg-gray-100 rounded flex-shrink-0">
                            {item.productImage ? (
                              <img
                                src={getImageUrl(item.productImage)}
                                alt={item.productTitle}
                                className="w-full h-full object-cover rounded"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                🎵
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">{item.productTitle || 'Producto'}</h4>
                            <p className="text-sm text-gray-600">
                              Cantidad: {item.quantity} × ${item.price?.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div className="font-semibold">
                            ${item.subtotal?.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4 mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>${order.subtotal?.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Envío</span>
                        <span>{order.shippingCost > 0 ? `$${order.shippingCost.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'Gratis'}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total</span>
                        <span>${order.total?.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Vendor Contact - inline with order */}
                {orders.length > 1 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Contacto del Vendedor</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="font-semibold text-lg mb-2">{order.vendor?.storeName}</p>
                        {order.vendor?.email && (
                          <a
                            href={`mailto:${order.vendor.email}`}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:underline mb-2"
                          >
                            <Mail className="w-4 h-4" />
                            {order.vendor.email}
                          </a>
                        )}
                        {order.vendor?.phone && (
                          <a
                            href={`tel:${order.vendor.phone}`}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                          >
                            <Phone className="w-4 h-4" />
                            {order.vendor.phone}
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Separator between orders */}
                {index < orders.length - 1 && (
                  <div className="border-t-4 border-purple-200 my-8"></div>
                )}
              </div>
            ))}

            {/* Shipping Address - Shared for all orders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Dirección de Envío
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold">{firstOrder.shippingName}</p>
                <p>{firstOrder.shippingAddress}</p>
                <p>
                  {firstOrder.shippingCity}, {firstOrder.shippingCountry}
                </p>
                {firstOrder.shippingRut && <p>RUT: {firstOrder.shippingRut}</p>}
                <div className="flex items-center gap-2 pt-2 border-t mt-2">
                  <Phone className="w-4 h-4 text-gray-600" />
                  <span>{firstOrder.shippingPhone}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Total Summary for multiple orders */}
            {orders.length > 1 && (
              <Card className="border-purple-300 bg-purple-50">
                <CardHeader>
                  <CardTitle className="text-purple-900">Resumen Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Pedidos:</span>
                      <span className="font-semibold">{orders.length} tiendas</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-purple-900 border-t pt-2">
                      <span>Total:</span>
                      <span>${totalAmount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Vendor Contact - Only for single order */}
            {orders.length === 1 && firstOrder.vendor && (
              <Card>
                <CardHeader>
                  <CardTitle>Contacto del Vendedor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-semibold text-lg mb-2">{firstOrder.vendor.storeName}</p>
                    {firstOrder.vendor.email && (
                      <a
                        href={`mailto:${firstOrder.vendor.email}`}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline mb-2"
                      >
                        <Mail className="w-4 h-4" />
                        {firstOrder.vendor.email}
                      </a>
                    )}
                    {firstOrder.vendor.phone && (
                      <a
                        href={`tel:${firstOrder.vendor.phone}`}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <Phone className="w-4 h-4" />
                        {firstOrder.vendor.phone}
                      </a>
                    )}
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                    <p className="text-purple-900">
                      El vendedor se pondrá en contacto contigo para coordinar la entrega.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardContent className="p-4 space-y-3">
                {orders.length === 1 && firstOrder.vendor?.slug ? (
                  <Link href={storeUrl}>
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Volver a la tienda
                    </Button>
                  </Link>
                ) : (
                  <Link href="/">
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Volver a Mundobeat
                    </Button>
                  </Link>
                )}
                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  onClick={() => window.print()}
                >
                  Imprimir Pedido
                </Button>
              </CardContent>
            </Card>

            {/* Help Info */}
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <p className="text-sm text-gray-600">
                  <strong>¿Necesitas ayuda?</strong>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Guarda el número de pedido <strong>{firstOrder.orderNumber}</strong> para cualquier consulta.
                </p>
              </CardContent>
            </Card>

            {/* Account Creation Offer - Show for successful guest orders */}
            {!hadPaymentIssue && urlStatus === 'paid' && firstOrder.customerId === null && firstOrder.customerEmail && showAccountOffer && !accountCreated && (
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-900">
                    <Sparkles className="w-5 h-5" />
                    ¿Quieres seguir tus pedidos?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-700">
                    Crea una cuenta para acceder a estos beneficios:
                  </p>

                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Ver historial de compras</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Package className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>Seguimiento de envíos en tiempo real</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Loader2 className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <span>Checkout más rápido en futuras compras</span>
                    </li>
                  </ul>

                  <form onSubmit={handleCreateAccount} className="space-y-3 pt-2">
                    <div>
                      <Label htmlFor="create-password" className="text-sm font-medium">
                        Crear contraseña
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          id="create-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="confirm-password" className="text-sm font-medium">
                        Confirmar contraseña
                      </Label>
                      <Input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repite tu contraseña"
                        className="mt-1"
                        required
                      />
                    </div>

                    {accountError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                        {accountError}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="submit"
                        disabled={creating}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          "Crear mi cuenta"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAccountOffer(false)}
                        disabled={creating}
                      >
                        Ahora no
                      </Button>
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                      Email: <strong>{firstOrder.customerEmail}</strong>
                    </p>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Account Created Success */}
            {accountCreated && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-900 mb-2">
                    ¡Cuenta creada exitosamente!
                  </h3>
                  <p className="text-sm text-green-700 mb-3">
                    Redirigiendo a inicio de sesión...
                  </p>
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-green-600" />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
