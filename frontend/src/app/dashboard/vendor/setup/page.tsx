"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function VendorSetupPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    storeName: "",
    description: "",
    address: "",
    city: "",
    country: "Chile",
  });

  useEffect(() => {
    // Verificar autenticación
    if (!authLoading && !isAuthenticated) {
      console.log('Usuario no autenticado, redirigiendo a login');
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar token antes de enviar
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      alert("No estás autenticado. Por favor inicia sesión.");
      router.push('/login');
      return;
    }
    
    console.log('Usuario autenticado:', user);
    console.log('Token existe:', !!token);
    
    setLoading(true);

    try {
      console.log('Enviando datos del vendedor:', formData);
      const result = await api.createVendor(formData);
      console.log('Vendedor creado exitosamente:', result);
      
      alert("¡Perfil de vendedor creado exitosamente! Tu rol ha sido actualizado. Por favor inicia sesión nuevamente para aplicar los cambios.");
      
      // Cerrar sesión para que el token se actualice con el nuevo rol
      localStorage.removeItem('token');
      router.push('/login');
    } catch (error: any) {
      console.error("Error creating vendor:", error);
      const errorMessage = error.message || "Error al crear el perfil de vendedor";
      console.error("Mensaje de error:", errorMessage);
      
      // Verificar si es un error de autenticación
      if (errorMessage.toLowerCase().includes("unauthorized") || errorMessage.toLowerCase().includes("unauthenticated")) {
        alert("Sesión expirada o inválida. Por favor inicia sesión nuevamente.");
        localStorage.removeItem('token');
        router.push('/login');
      } else if (errorMessage.includes("NetworkError") || errorMessage.includes("fetch")) {
        alert("Error de conexión: No se puede conectar con el servidor. Verifica que el backend esté corriendo en http://localhost:3001");
      } else {
        alert(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Verificando autenticación...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold">Crear Perfil de Vendedor</h1>
        <p className="text-gray-600 mt-2">Completa la información de tu tienda</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Información de la Tienda</CardTitle>
            <CardDescription>
              Esta información será visible para los clientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="storeName">Nombre de la Tienda *</Label>
              <Input
                id="storeName"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                placeholder="Ej: Discos Vintage"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                placeholder="Describe tu tienda y qué tipo de productos ofreces..."
              />
            </div>

            <div>
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Calle y número"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Santiago"
                />
              </div>
              <div>
                <Label htmlFor="country">País</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Chile"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creando..." : "Crear Tienda"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
