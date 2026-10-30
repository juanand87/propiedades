'use client';

import { useState } from 'react';
import { Mail, CheckCircle, Package, Clock, Loader2 } from 'lucide-react';
import { SalesReceiptLink } from '@/components/orders/SalesReceiptLink';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  salesReceiptUrl?: string | null;
  salesReceiptQrImageUrl?: string | null;
  salesReceiptToken?: string | null;
  items: {
    id: string;
    productTitle: string;
    productImage: string;
    quantity: number;
    price: number;
  }[];
}

export default function MisPedidosPage() {
  const [step, setStep] = useState<'email' | 'code' | 'orders'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/request-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al enviar código');
      }

      setSuccessMessage('¡Código enviado! Revisa tu correo electrónico.');
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Error al enviar código. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/verify-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, token: code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Código inválido o expirado');
      }

      // Guardar token JWT
      localStorage.setItem('customerAccessToken', data.accessToken);

      // Cargar pedidos
      await loadOrders(data.accessToken);
    } catch (err: any) {
      setError(err.message || 'Código inválido. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (token: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error('Error al cargar pedidos');
      }

      setOrders(data);
      setStep('orders');
    } catch (err: any) {
      setError(err.message || 'Error al cargar pedidos');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
      paid: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
      processing: { label: 'Procesando', color: 'bg-blue-100 text-blue-800' },
      shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800' },
      delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Package className="mx-auto h-12 w-12 text-purple-600" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Mis Pedidos</h1>
          <p className="mt-2 text-gray-600">
            Accede a tu historial de compras usando tu correo electrónico
          </p>
        </div>

        {/* Step 1: Email Input */}
        {step === 'email' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-purple-100 rounded-full p-3">
                <Mail className="h-8 w-8 text-purple-600" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-center mb-2">Ingresa tu correo</h2>
            <p className="text-gray-600 text-center mb-6 text-sm">
              Te enviaremos un código de acceso temporal
            </p>

            <form onSubmit={handleRequestAccess}>
              <div className="mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Enviando...
                  </>
                ) : (
                  'Enviar código'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Code Verification */}
        {step === 'code' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-center mb-2">Ingresa el código</h2>
            <p className="text-gray-600 text-center mb-6 text-sm">
              Hemos enviado un código de 6 dígitos a <span className="font-semibold">{email}</span>
            </p>

            <form onSubmit={handleVerifyCode}>
              <div className="mb-4">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  required
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Verificando...
                  </>
                ) : (
                  'Verificar código'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                }}
                className="w-full mt-3 text-gray-600 hover:text-gray-900 py-2 text-sm"
              >
                Volver atrás
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start">
                <Clock className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">
                  El código expira en 15 minutos. Si no lo recibiste, verifica tu carpeta de spam.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Orders List */}
        {step === 'orders' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Tus Pedidos</h2>
                <button
                  onClick={() => {
                    localStorage.removeItem('customerAccessToken');
                    setStep('email');
                    setEmail('');
                    setCode('');
                    setOrders([]);
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Cerrar sesión
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="mx-auto h-16 w-16 text-gray-300" />
                  <p className="mt-4 text-gray-600">No tienes pedidos aún</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">Pedido #{order.orderNumber}</h3>
                          <p className="text-sm text-gray-600">{formatDate(order.createdAt)}</p>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>

                      <div className="space-y-3 mb-4">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center space-x-4">
                            {item.productImage && (
                              <img
                                src={item.productImage}
                                alt={item.productTitle}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{item.productTitle}</p>
                              <p className="text-sm text-gray-600">
                                Cantidad: {item.quantity} × {formatPrice(item.price)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-900">Total:</span>
                          <span className="font-bold text-xl text-purple-600">{formatPrice(order.total)}</span>
                        </div>
                        <SalesReceiptLink url={order.salesReceiptUrl} qrImageUrl={order.salesReceiptQrImageUrl} token={order.salesReceiptToken} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
