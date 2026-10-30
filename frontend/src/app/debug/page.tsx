"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebugPage() {
  const { user, isAuthenticated } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [decodedToken, setDecodedToken] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      setToken(storedToken);
      
      if (storedToken) {
        try {
          // Decodificar el JWT (solo la parte del payload)
          const parts = storedToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            setDecodedToken(payload);
          }
        } catch (error) {
          console.error('Error decoding token:', error);
        }
      }
    }
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Debug - Estado de Autenticación</h1>

      <Card>
        <CardHeader>
          <CardTitle>Usuario desde AuthContext</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
          <p className="mt-2">
            <strong>Autenticado:</strong> {isAuthenticated ? 'Sí' : 'No'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Token JWT</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2">
            <strong>Token existe:</strong> {token ? 'Sí' : 'No'}
          </p>
          {token && (
            <div className="space-y-2">
              <p className="text-xs break-all bg-gray-100 p-2 rounded">
                {token.substring(0, 50)}...
              </p>
              <div>
                <strong>Token decodificado:</strong>
                <pre className="bg-gray-100 p-4 rounded overflow-auto mt-2">
                  {JSON.stringify(decodedToken, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información Importante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            <strong>Rol en AuthContext:</strong> {user?.role || 'N/A'}
          </p>
          <p>
            <strong>Rol en JWT Token:</strong> {decodedToken?.role || 'N/A'}
          </p>
          <p className="text-sm text-gray-600 mt-4">
            Si el rol es "customer" y ya creaste tu perfil de vendedor, necesitas cerrar sesión y volver a iniciar sesión.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
