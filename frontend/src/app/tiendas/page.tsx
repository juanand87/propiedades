"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store, ArrowRight } from "lucide-react";
import StoreRatingSummary from "@/components/StoreRatingSummary";

export default function TiendasPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/vendors`);
      const data = await response.json();
      
      // Filtrar solo vendors activos y excluir el marketplace
      const activeVendors = data.filter((v: any) => 
        v.isActive && v.id !== "00000000-0000-0000-0000-000000000001"
      );
      
      setVendors(activeVendors);
    } catch (error) {
      console.error("Error loading vendors:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Nuestras Tiendas
            </h1>
            <p className="text-lg text-gray-600">
              Descubre nuestras tiendas especializadas en música
            </p>
          </div>

          {vendors.length === 0 ? (
            <Card className="max-w-md mx-auto">
              <CardContent className="p-8 text-center">
                <Store className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  No hay tiendas disponibles
                </h2>
                <p className="text-gray-600 mb-4">
                  Actualmente no hay tiendas activas en el marketplace
                </p>
                <Button asChild>
                  <Link href="/">Volver al inicio</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendors.map((vendor) => (
                <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="w-5 h-5" />
                      {vendor.storeName}
                    </CardTitle>
                    {vendor.description && (
                      <CardDescription>{vendor.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <StoreRatingSummary
                      vendorId={vendor.id}
                      initialAverage={vendor.rating}
                      initialCount={vendor.ratingCount}
                      compact
                      className="mb-5"
                    />
                    <Button asChild className="w-full">
                      <Link href={`/tiendas/${vendor.slug}`}>
                        Visitar tienda
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Button variant="outline" asChild>
              <Link href="/">Volver al marketplace</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
