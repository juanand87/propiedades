"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import StorefrontAccountHeader from "@/components/StorefrontAccountHeader";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registerHref, setRegisterHref] = useState("/register");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    if (redirect?.startsWith("/")) {
      setRegisterHref(`/register?redirect=${encodeURIComponent(redirect)}`);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(formData.email, formData.password);
      const requested = new URLSearchParams(window.location.search).get('redirect');
      const profile = await api.getProfile();
      router.push(requested?.startsWith('/') ? requested : profile.role === 'customer' ? '/' : '/dashboard');
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error.message || "Error al iniciar sesión. Verifica tus credenciales.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg-site, #f8fafc)" }}>
      <StorefrontAccountHeader />
      <main className="flex justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold" style={{ color: "var(--color-primary, #046284)" }}>Iniciar Sesión</h2>
          <p className="mt-2 text-sm text-gray-600">
            Accede a tu cuenta de MusicMarket
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bienvenido de vuelta</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div>
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button type="submit" className="w-full text-white theme-gradient-bg" disabled={loading}>
                {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>

              <div className="text-center pt-4">
                <p className="text-sm text-gray-600">
                  ¿No tienes una cuenta?{" "}
                  <Link href={registerHref} className="font-semibold hover:opacity-80" style={{ color: "var(--color-primary, #0691b6)" }}>
                    Crear tu cuenta
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      </main>
    </div>
  );
}
