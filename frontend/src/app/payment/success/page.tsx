'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getOrderUrl } from '@/lib/useCustomDomain';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('loading');
  const [order, setOrder] = useState<any>(null);
  
  const token = searchParams.get('token'); // Flow
  const orderId = searchParams.get('order'); // Payku
  const vendorSlugParam = searchParams.get('vendorSlug');
  const fallbackOrderId = searchParams.get('orderId');

  useEffect(() => {
    if (token) {
      // Flow payment confirmation
      checkPaymentStatus(token);
    } else if (orderId) {
      // Payku payment - check order status directly
      checkPaykuOrderStatus(orderId);
    } else {
      setStatus('error');
    }
  }, [token, orderId]);

  useEffect(() => {
    if (!token && vendorSlugParam && fallbackOrderId) {
      router.replace(`/tiendas/${vendorSlugParam}/pedido/${fallbackOrderId}?status=cancelled`);
    }
  }, [token, vendorSlugParam, fallbackOrderId, router]);

  // When we have order and a final status, redirect appropriately
  useEffect(() => {
    if (status !== 'loading' && order) {
      try {
        // Debug: log current hostname and what we're about to do
        console.log('🔍 [PaymentSuccess] Current hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A');
        console.log('🔍 [PaymentSuccess] Order:', { 
          id: order.id, 
          orderNumber: order.orderNumber,
          orderSource: order.orderSource,
          vendorSlug: order.vendorSlug,
          customerEmail: order.customerEmail 
        });
        
        // If payment was successful, redirect to checkout success with account creation offer
        if (status === 'success' && order.orderNumber && order.customerEmail) {
          const successUrl = `/checkout/success?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(order.customerEmail)}`;
          console.log('🔍 [PaymentSuccess] Redirecting to checkout success:', successUrl);
          
          setTimeout(() => {
            router.replace(successUrl);
          }, 1000);
          return;
        }
        
        // For non-successful payments, redirect to order page with status
        const statusParam = status === 'success' ? 'paid' : status;
        
        // For marketplace multi-vendor orders, redirect to /pedido/{orderNumber}
        // For single vendor orders, redirect to /tiendas/{vendorSlug}/pedido/{orderId}
        let orderUrl: string;
        
        if (order.orderSource === 'marketplace' && order.orderNumber) {
          // Multi-vendor marketplace order -> use orderNumber
          orderUrl = `/pedido/${order.orderNumber}`;
        } else {
          // Single vendor order -> use vendorSlug + orderId
          const inferredVendorSlug = order.vendorSlug || (order.items && order.items[0] && order.items[0].product && order.items[0].product.vendor && order.items[0].product.vendor.slug);
          if (inferredVendorSlug) {
            orderUrl = getOrderUrl(inferredVendorSlug, order.id);
          } else {
            // Fallback to orderNumber if no vendor slug
            orderUrl = `/pedido/${order.orderNumber || order.id}`;
          }
        }
        
        console.log('🔍 [PaymentSuccess] Redirecting to:', orderUrl, 'with status:', statusParam);
        
        // Redirect back to order page with status
        setTimeout(() => {
          router.replace(`${orderUrl}?status=${statusParam}`);
        }, 1000);
      } catch (err) {
        console.error('Error redirecting to vendor page:', err);
      }
    }
  }, [status, order, router]);

  const checkPaymentStatus = async (token: string) => {
    try {
      // Call backend to confirm payment (Flow)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/payment/flow/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();
      
      if (data.success) {
        setOrder(data.order);
        if (data.order.paymentStatus === 'approved') {
          setStatus('success');
        } else if (data.order.paymentStatus === 'rejected') {
          setStatus('rejected');
        } else if (data.order.paymentStatus === 'cancelled') {
          setStatus('cancelled');
        } else {
          setStatus('pending');
        }
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Error checking payment:', error);
      setStatus('error');
    }
  };

  const checkPaykuOrderStatus = async (orderId: string) => {
    try {
      console.log('[PaymentSuccess] Checking Payku order status:', orderId);
      
      // Check order status via Payku endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/payment/payku/status/${orderId}`);
      const data = await response.json();
      
      console.log('[PaymentSuccess] Payku status response:', data);
      
      if (data.order) {
        setOrder(data.order);
        
        if (data.order.paymentStatus === 'approved') {
          setStatus('success');
        } else if (data.order.paymentStatus === 'rejected') {
          setStatus('rejected');
        } else if (data.order.paymentStatus === 'cancelled') {
          setStatus('cancelled');
        } else if (data.order.paymentStatus === 'payment_error') {
          // Payment initialization failed (invalid token, API error, etc)
          setStatus('error');
        } else if (data.order.paymentStatus === 'pending') {
          // Payment might still be processing, show pending message
          setStatus('pending');
        } else {
          setStatus('error');
        }
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Error checking Payku order:', error);
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <Card className="p-8 text-center max-w-md">
          <CardContent className="pt-6">
            <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4 text-purple-600" />
            <h2 className="text-2xl font-semibold mb-2">Procesando pago...</h2>
            <p className="text-gray-600">Por favor espera mientras confirmamos tu pago</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <Card className="p-8 max-w-md">
          <CardContent className="text-center pt-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Pago Exitoso!</h1>
            <p className="text-gray-600 mb-2">
              Tu pago ha sido procesado correctamente.
            </p>
            {order?.orderNumber && (
              <p className="text-lg font-semibold text-purple-600 mb-6">
                Pedido #{order.orderNumber}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-6">
              Recibirás un correo de confirmación con los detalles de tu pedido.
            </p>
            <Button 
              onClick={() => router.push('/')}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <Card className="p-8 max-w-md">
          <CardContent className="text-center pt-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Pago Rechazado</h1>
            <p className="text-gray-600 mb-6">
              Lo sentimos, tu pago no pudo ser procesado. Por favor verifica tus datos e intenta nuevamente.
            </p>
            <Button 
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full"
            >
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending status - payment might still be processing
  if (status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <Card className="p-8 max-w-md">
          <CardContent className="text-center pt-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Pago en Proceso</h1>
            <p className="text-gray-600 mb-4">
              Tu pago está siendo procesado. Esto puede tomar unos momentos.
            </p>
            {order?.orderNumber && (
              <p className="text-lg font-semibold text-purple-600 mb-4">
                Pedido #{order.orderNumber}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-6">
              Recibirás un correo de confirmación cuando el pago sea aprobado.
            </p>
            <div className="space-y-2">
              <Button 
                onClick={() => checkPaykuOrderStatus(orderId || '')}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                Verificar Estado
              </Button>
              <Button 
                onClick={() => router.push('/')}
                variant="outline"
                className="w-full"
              >
                Volver al Inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error or cancelled
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <Card className="p-8 max-w-md">
        <CardContent className="text-center pt-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-12 w-12 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {status === 'cancelled' ? 'Pago Cancelado' : 'Error en el Pago'}
          </h1>
          <p className="text-gray-600 mb-4">
            {status === 'cancelled' 
              ? 'Has cancelado el proceso de pago.' 
              : 'No se pudo inicializar el pago. Esto puede deberse a:'}
          </p>
          {status === 'error' && (
            <ul className="text-sm text-gray-600 mb-6 text-left list-disc list-inside space-y-1">
              <li>Configuración de pago pendiente en la tienda</li>
              <li>Problema temporal con el sistema de pagos</li>
              <li>Error de conexión con el servicio</li>
            </ul>
          )}
          {order?.orderNumber && (
            <p className="text-sm font-semibold text-gray-700 mb-4">
              Pedido #{order.orderNumber} - Estado: Error de pago
            </p>
          )}
          <p className="text-sm text-gray-500 mb-6">
            Por favor contacta al vendedor o intenta nuevamente más tarde.
          </p>
          <Button 
            onClick={() => router.push('/')}
            variant="outline"
            className="w-full"
          >
            Volver al Inicio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-600">Cargando...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
