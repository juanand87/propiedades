"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { AlertCircle } from "lucide-react";

export default function PanelLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await api.panelLogin(email, password);
      
      // Guardar el token
      api.setToken(result.access_token);
      
      // Guardar autenticación en localStorage para el layout del panel
      if (typeof window !== "undefined") {
        localStorage.setItem("panel_auth", "true");
        localStorage.setItem("panel_user", result.user?.role || "admin");
      }
      
      // Redirigir al panel (página raíz)
      router.push("/panel");
    } catch (error: any) {
      console.error("Panel login error:", error);
      setError(error.message || "Error al iniciar sesión. Verifica tus credenciales.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #e0f8ff 0%, #f0fbff 50%, #e6f9ff 100%)' }}>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-white rounded-t-lg" style={{ background: 'linear-gradient(to right, #046284, #0691b6)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl">🎵</div>
            <span className="text-xs bg-white/20 px-2 py-1 rounded">Admin</span>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Panel Administrativo</CardTitle>
          <CardDescription className="text-cyan-100">
            Solo para administradores del marketplace
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@marketplace.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex gap-2 items-start text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full text-white"
              style={{ background: 'linear-gradient(to right, #046284, #0691b6)' }}
              disabled={loading}
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>

            <div className="border-t pt-4 text-center text-sm text-gray-600">
              <p>¿Volver al marketplace?</p>
              <Link href="/" className="font-semibold hover:opacity-80" style={{ color: '#0691b6' }}>
                Ir al inicio
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
