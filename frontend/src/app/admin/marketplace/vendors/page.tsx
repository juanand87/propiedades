"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Store, 
  Check, 
  X, 
  Settings,
  AlertCircle,
} from "lucide-react";

interface Vendor {
  id: string;
  storeName: string;
  slug: string;
  email: string;
  paymentEmail: string | null;
  paykuClientId: string | null;
  paykuAffiliationToken: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function MarketplaceVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    paykuClientId: "",
    paykuAffiliationToken: "",
  });

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/marketplace/vendors`);
      const data = await response.json();
      console.log("Vendors data:", data);
      // Asegurarse de que data sea un array
      setVendors(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading vendors:", error);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setFormData({
      paykuClientId: vendor.paykuClientId || "",
      paykuAffiliationToken: vendor.paykuAffiliationToken || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedVendor(null);
    setFormData({
      paykuClientId: "",
      paykuAffiliationToken: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVendor) return;

    try {
      setSaving(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/marketplace/vendors/${selectedVendor.id}/payku`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      if (response.ok) {
        alert("Credenciales de Payku actualizadas correctamente");
        loadVendors();
        closeModal();
      } else {
        alert("Error al actualizar credenciales");
      }
    } catch (error) {
      console.error("Error updating Payku credentials:", error);
      alert("Error al actualizar credenciales");
    } finally {
      setSaving(false);
    }
  };

  const getPaykuStatus = (vendor: Vendor) => {
    if (vendor.paykuClientId && vendor.paykuAffiliationToken) {
      return <Badge className="bg-green-500 hover:bg-green-600"><Check className="w-3 h-3 mr-1" /> Configurado</Badge>;
    }
    return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" /> Pendiente</Badge>;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-6 h-6" />
            Gestión de Vendedores
          </CardTitle>
          <CardDescription>
            Configura las credenciales de Payku Marketplace para cada vendedor
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Cargando vendedores...</p>
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay vendedores registrados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Tienda</th>
                    <th className="text-left py-3 px-4 font-semibold">Email</th>
                    <th className="text-left py-3 px-4 font-semibold">Email de Pago</th>
                    <th className="text-left py-3 px-4 font-semibold">Estado Payku</th>
                    <th className="text-left py-3 px-4 font-semibold">Estado</th>
                    <th className="text-right py-3 px-4 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr key={vendor.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{vendor.storeName}</div>
                          <div className="text-sm text-gray-600">/{vendor.slug}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{vendor.email || "-"}</td>
                      <td className="py-3 px-4 text-sm">{vendor.paymentEmail || "-"}</td>
                      <td className="py-3 px-4">{getPaykuStatus(vendor)}</td>
                      <td className="py-3 px-4">
                        {vendor.isActive ? (
                          <Badge variant="default"><Check className="w-3 h-3 mr-1" /> Activa</Badge>
                        ) : (
                          <Badge variant="destructive"><X className="w-3 h-3 mr-1" /> Inactiva</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(vendor)}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Configurar Payku
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de configuración Payku */}
      {showModal && selectedVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Configurar Payku Marketplace</h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedVendor.storeName}
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="font-semibold text-blue-900 mb-2">📋 Instrucciones:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Ingresa a tu panel de Payku Marketplace</li>
                  <li>Crea o busca el cliente asociado a este vendedor</li>
                  <li>Crea una afiliación para este cliente</li>
                  <li>Copia el <strong>ID del cliente</strong> y el <strong>Token de afiliación</strong></li>
                  <li>Pégalos en los campos siguientes</li>
                </ol>
              </div>

              <div>
                <Label htmlFor="paykuClientId">
                  ID Cliente Payku <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="paykuClientId"
                  value={formData.paykuClientId}
                  onChange={(e) => setFormData({ ...formData, paykuClientId: e.target.value })}
                  placeholder="Ej: madb93fc00a2cf6f4449"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  ID del cliente creado en Payku (/api/maclient)
                </p>
              </div>

              <div>
                <Label htmlFor="paykuAffiliationToken">
                  Token de Afiliación <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="paykuAffiliationToken"
                  value={formData.paykuAffiliationToken}
                  onChange={(e) => setFormData({ ...formData, paykuAffiliationToken: e.target.value })}
                  placeholder="Ej: eecd92fdbb8bf615e8215d6f..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Token de la afiliación creada en Payku (/api/maaffiliation)
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
