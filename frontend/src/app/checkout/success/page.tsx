"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Package, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const orderNumber = searchParams.get("order") || "";
  const email = searchParams.get("email") || "";
  
  const [showCreateAccount, setShowCreateAccount] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Verificar si el usuario ya tiene cuenta
    const checkIfHasAccount = async () => {
      // Puedes agregar lógica aquí para verificar si ya existe la cuenta
      // Por ahora asumimos que es un guest
    };
    
    if (email) {
      checkIfHasAccount();
    }
  }, [email]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validaciones
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setCreating(true);

    try {
      const response = await api.post("/customers/convert-guest", {
        orderNumber,
        email,
        password,
      });

      if (response.success) {
        setAccountCreated(true);
        
        // Redirigir al login después de 3 segundos
        setTimeout(() => {
          router.push("/login?email=" + encodeURIComponent(email));
        }, 3000);
      }
    } catch (err: any) {
      console.error("Error creating account:", err);
      setError(err.response?.data?.message || "Error al crear la cuenta. Intenta más tarde.");
    } finally {
      setCreating(false);
    }
  };

  const handleSkip = () => {
    setShowCreateAccount(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header de éxito */}
        <Card className="border-green-200 bg-white shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <CardTitle className="text-3xl font-bold text-gray-900">
              ¡Compra Exitosa!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Número de orden</p>
              <p className="text-2xl font-bold text-purple-600">#{orderNumber}</p>
            </div>
            
            <div className="flex items-start gap-3 text-left bg-blue-50 p-4 rounded-lg border border-blue-200">
              <Package className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Confirmación enviada</p>
                <p className="text-sm text-gray-600">
                  Te enviamos los detalles a <span className="font-medium">{email}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Oferta de crear cuenta */}
        {showCreateAccount && !accountCreated && (
          <Card className="border-purple-200 bg-white shadow-lg">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-xl font-bold text-gray-900">
                💡 ¿Quieres seguir tus pedidos?
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Crea una cuenta para acceder a tu historial de compras y seguimiento de envíos
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Beneficios */}
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                  <p className="font-medium text-purple-900 mb-2 text-sm">
                    ✓ Con tu cuenta podrás:
                  </p>
                  <ul className="space-y-1 text-sm text-purple-700">
                    <li>• Ver historial completo de compras</li>
                    <li>• Seguimiento en tiempo real de tus envíos</li>
                    <li>• Checkout más rápido en futuras compras</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {creating ? "Creando cuenta..." : "Crear mi cuenta"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkip}
                    className="flex-1"
                  >
                    Ahora no
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Cuenta creada exitosamente */}
        {accountCreated && (
          <Card className="border-green-200 bg-white shadow-lg">
            <CardContent className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                ¡Cuenta creada exitosamente!
              </h3>
              <p className="text-gray-600 mb-4">
                Redirigiendo al login...
              </p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            </CardContent>
          </Card>
        )}

        {/* Botón para ver pedido */}
        {!showCreateAccount && (
          <div className="text-center">
            <Link href={`/pedido/${orderNumber}`}>
              <Button variant="outline" size="lg">
                Ver detalles del pedido
              </Button>
            </Link>
          </div>
        )}

        {/* Link al inicio */}
        <div className="text-center">
          <Link
            href="/"
            className="text-purple-600 hover:text-purple-700 font-medium text-sm inline-flex items-center gap-2"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
