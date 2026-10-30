"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getImageUrl } from "@/lib/utils";
import { getStoreUrl } from "@/lib/useCustomDomain";
import Link from "next/link";
import { SalesReceiptLink } from "@/components/orders/SalesReceiptLink";
import { CheckCircle, Package, ArrowLeft, Phone, Mail, MapPin, XCircle, Printer } from "lucide-react";

export default function OrderConfirmationPage() {
  const params = useParams();
  const slug = params.slug as string;
  const orderId = params.orderId as string;
  const searchParams = useSearchParams();
  const { items, removeItem } = useCart();
  
  // Detectar si Payku envió algún error o indicador
  const messageError = searchParams.get('message_error');
  const paykuId = searchParams.get('id'); // ID de transacción de Payku
  const urlStatus = searchParams.get('status'); // Status from /payment/success redirect

  const [order, setOrder] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [showFullPendingMessage, setShowFullPendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'products' | 'shipping'>('details');

  useEffect(() => {
    loadData();
  }, [orderId, slug]);

  const loadData = async () => {
    try {
      const [orderData, vendorData] = await Promise.all([
        api.getOrder(orderId),
        api.getVendorBySlug(slug),
      ]);
      setOrder(orderData);
      setVendor(vendorData);

      // 🛒 Clear cart items for this vendor after loading order
      // This removes all products from the current vendor that the user just ordered
      console.log('[OrderConfirmation] Removing cart items for vendor:', vendorData.id);
      const vendorItems = items.filter(item => item.vendorSlug === slug);
      vendorItems.forEach(item => {
        console.log('[OrderConfirmation] Removing item from cart:', item.productId);
        removeItem(item.productId);
      });

      // Si el pago está pending y tiene transactionId de Payku, verificar estado automáticamente
      // Esto cubre el caso cuando el webhook no llega pero el usuario ya pagó
      if (orderData.paymentStatus === 'pending' && orderData.paymentTransactionId) {
        console.log('[OrderPage] Pedido en pending con transactionId, verificando con Payku en 2 segundos...');
        setTimeout(() => checkPaykuStatus(orderData), 2000);
        
        // Después de 5 segundos, mostrar el mensaje completo con botones
        setTimeout(() => {
          setShowFullPendingMessage(true);
        }, 5000);
      }
    } catch (error) {
      console.error("Error loading order:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkPaykuStatus = async (orderData: any) => {
    if (checkingPayment) return;
    
    try {
      setCheckingPayment(true);
      console.log('[OrderPage] Verificando estado del pago con Payku...');
      
      const response = await fetch(`${API_URL}/payment/payku/check-status/${orderData.id}`);
      const result = await response.json();
      
      console.log('[OrderPage] Respuesta de verificación:', result);
      
      if (result.success && result.order) {
        console.log('[OrderPage] Estado actualizado, recargando datos...');
        setOrder(result.order);
        
        // Si el estado cambió de pending a otro, recargar completamente
        if (result.order.paymentStatus !== 'pending') {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('[OrderPage] Error verificando estado del pago:', error);
    } finally {
      setCheckingPayment(false);
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

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      transfer: "Transferencia Bancaria",
      cash: "Efectivo en Entrega",
      credit_card: "Tarjeta de Crédito",
      debit_card: "Tarjeta de Débito",
      paypal: "PayPal",
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <h1 className="text-2xl font-bold text-gray-800 mb-4">Pedido no encontrado</h1>
              <Link href={`/tiendas/${slug}`}>
                <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a la tienda
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Usar el estado real de la base de datos (actualizada por webhook)
  const paymentStatus = order.paymentStatus || 'pending';
  const orderStatus = order.status;
  
  // Detectar si el usuario viene directamente de Payku
  const comesFromPayku = !!paykuId; // Si tiene id de Payku, acaba de ser redirigido
  
  // Estados del pedido (priorizar urlStatus si viene de /payment/success)
  const wasPaymentCancelled = urlStatus === 'cancelled';
  const wasPaymentRejected = urlStatus === 'rejected';
  const wasPaymentError = urlStatus === 'error';
  
  const isApproved = paymentStatus === 'approved';
  const isFailed = paymentStatus === 'failed' || wasPaymentRejected || wasPaymentError;
  const isCancelled = orderStatus === 'cancelled' || wasPaymentCancelled;
  const isPending = paymentStatus === 'pending' && !isCancelled && !isFailed;
  
  // Si tiene transactionId pero sigue pending, mostrar opción de reintentar
  const hasPendingPayment = isPending && order.paymentTransactionId;
  
  const headerIconColor = isCancelled || isFailed
    ? 'bg-red-100 text-red-600' 
    : isPending 
      ? 'bg-yellow-100 text-yellow-600'
      : 'bg-green-100 text-green-600';
  
  const headerTitle = isCancelled 
      ? '❌ Pedido Cancelado'
      : isFailed
        ? '❌ Pago Rechazado'
        : isPending 
          ? hasPendingPayment 
            ? '⏳ Esperando Confirmación de Pago'
            : '⏳ Pago Pendiente' 
          : '✅ ¡Pedido Confirmado!';
  
  const headerSubtitle = isCancelled
      ? 'Este pedido ha sido cancelado.'
      : isFailed
        ? 'El pago fue rechazado por tu entidad bancaria. Puedes intentar nuevamente.'
        : isPending
          ? hasPendingPayment
            ? 'Tu pago está siendo verificado...'
            : 'Tu pedido ha sido registrado. Completa el pago para confirmar tu compra.'
          : `Gracias por tu compra en ${vendor?.storeName}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Order Status Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 ${headerIconColor} rounded-full mb-4`}>
            {isCancelled || isFailed ? (
              <XCircle className="w-10 h-10" />
            ) : isPending ? (
              <Package className="w-10 h-10" />
            ) : (
              <CheckCircle className="w-10 h-10" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{headerTitle}</h1>
          <p className="text-gray-600 mb-4">{headerSubtitle}</p>
          
          {(isPending || isCancelled || isFailed) && (
            <div className="max-w-2xl mx-auto">
              {/* Mensaje inicial: solo mostrar si NO ha pasado el tiempo de espera */}
              {hasPendingPayment && !showFullPendingMessage && (
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 text-blue-600 bg-blue-50 px-6 py-3 rounded-lg">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <p className="font-medium">Verificando tu pago con Payku...</p>
                  </div>
                </div>
              )}
              
              {/* Mensaje completo con botones: mostrar después de 5 segundos O si no es pending payment */}
              {(!hasPendingPayment || showFullPendingMessage) && (
                <>
                  <div className="text-center mb-6">
                    <p className="text-gray-700 mb-6">
                      {isCancelled 
                          ? 'Este pedido fue cancelado.'
                          : isFailed
                            ? 'El pago fue rechazado. Puedes intentar nuevamente con otro método de pago.'
                            : hasPendingPayment 
                              ? 'Si ya completaste el pago en Payku, el estado se actualizará automáticamente en unos minutos. Si cancelaste el pago, puedes intentar nuevamente.'
                              : 'Revisa los datos de tu compra e intenta el pago.'}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {(isFailed || hasPendingPayment) && (
                        <Button 
                          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                          onClick={async () => {
                            try {
                              const currentHostname = typeof window !== 'undefined' ? window.location.hostname : undefined;
                              console.log('🔄 [Retry Payment] Current hostname:', currentHostname);
                              
                              const response = await fetch(`${API_URL}/payment/payku/retry-payment/${orderId}`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  originHostname: currentHostname,
                                }),
                              });
                              
                              const data = await response.json();
                              
                              if (data.success && data.paymentUrl) {
                                // Redirect to new Payku payment URL
                                console.log('✅ [Retry Payment] Redirecting to:', data.paymentUrl);
                                window.location.href = data.paymentUrl;
                              } else if (data.alreadyPaid) {
                                // Payment already completed, reload page
                                alert(data.message || 'Este pedido ya ha sido pagado exitosamente');
                                window.location.reload();
                              } else {
                                alert(data.message || 'Error al generar nuevo pago. Por favor intenta nuevamente.');
                              }
                            } catch (error) {
                              console.error('Error retrying payment:', error);
                              alert('Error al generar nuevo pago. Por favor intenta nuevamente.');
                            }
                          }}
                        >
                          🔄 Intentar Pago Nuevamente
                        </Button>
                      )}
                      <Link href={getStoreUrl(slug)} className={!isFailed && !hasPendingPayment ? 'col-span-2' : ''}>
                        <Button variant="outline" className="w-full border-blue-500 text-blue-600 hover:bg-blue-50">
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Volver a la tienda
                        </Button>
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Only show order details if payment is approved */}
        {isApproved && (
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Print Button - Top Right */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
            </div>

            {/* Tabs */}
            <Card>
              <div className="border-b">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'details'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Detalles del Pedido
                  </button>
                  <button
                    onClick={() => setActiveTab('products')}
                    className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'products'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Productos
                  </button>
                  <button
                    onClick={() => setActiveTab('shipping')}
                    className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'shipping'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Envío
                  </button>
                </div>
              </div>

              <CardContent className="p-6">
                {/* Tab: Detalles del Pedido */}
                {activeTab === 'details' && (
                  <div className="space-y-4">
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
                          ${Math.round(order.total || 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <SalesReceiptLink url={order.salesReceiptUrl} qrImageUrl={order.salesReceiptQrImageUrl} token={order.salesReceiptToken} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Productos */}
                {activeTab === 'products' && (
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
                            Cantidad: {item.quantity} × ${Math.round(item.price || 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="font-semibold">
                          ${Math.round(item.subtotal || 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-4 mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>${Math.round(order.subtotal || 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Envío</span>
                        <span>{order.shippingCost > 0 ? `$${Math.round(order.shippingCost).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : 'Gratis'}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total</span>
                        <span>${Math.round(order.total || 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Envío */}
                {activeTab === 'shipping' && (
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold">{order.shippingName}</p>
                    <p>{order.shippingAddress}</p>
                    <p>
                      {order.shippingCity}, {order.shippingCountry}
                    </p>
                    {order.shippingRut && <p>RUT: {order.shippingRut}</p>}
                    <div className="flex items-center gap-2 pt-2 border-t mt-2">
                      <Phone className="w-4 h-4 text-gray-600" />
                      <span>{order.shippingPhone}</span>
                    </div>
                    {order.trackingNumber && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <p><span className="text-gray-500">Courier:</span> <strong>{order.externalShippingCarrier || order.shippingMethod || '—'}</strong></p>
                        <p><span className="text-gray-500">Seguimiento:</span> <strong className="font-mono">{order.trackingNumber}</strong></p>
                        {order.externalShippingTrackingUrl && (
                          <Button type="button" variant="outline" size="sm" onClick={() => window.open(order.externalShippingTrackingUrl, '_blank', 'noopener,noreferrer')}>
                            Rastrear envío
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vendor Contact */}
            <Card>
              <CardHeader>
                <CardTitle>Contacto del Vendedor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold text-lg mb-2">{vendor?.storeName}</p>
                  {vendor?.email && (
                    <a
                      href={`mailto:${vendor.email}`}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline mb-2"
                    >
                      <Mail className="w-4 h-4" />
                      {vendor.email}
                    </a>
                  )}
                  {vendor?.phone && (
                    <a
                      href={`tel:${vendor.phone}`}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <Phone className="w-4 h-4" />
                      {vendor.phone}
                    </a>
                  )}
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                  <p className="text-green-900 font-medium">
                    ✅ Gracias por tu compra. El producto será despachado a la brevedad y te contactaremos para informarte los detalles del envío y la entrega.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Volver a la tienda */}
            <div className="flex justify-center">
              <Link href={`/tiendas/${slug}`}>
                <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a la tienda
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
