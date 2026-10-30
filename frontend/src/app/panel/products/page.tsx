"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface Product {
  id: string;
  title: string;
  artist: string;
  type: string;
  price: number;
  stock: number;
  isActive: boolean;
}

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      // TODO: Filtrar por vendorId del usuario actual
      const data = await api.getProducts({ includeOutOfStock: true });
      setProducts(data.products);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
      await api.deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
    } catch (error: any) {
      alert(error.message || 'Error al eliminar producto');
    }
  };

  const filteredProducts = products.filter((product) =>
    product.title.toLowerCase().includes(search.toLowerCase()) ||
    product.artist?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="text-gray-600 mt-2">Gestiona tu catálogo de productos</p>
        </div>
        <Link href="/dashboard/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Producto
          </Button>
        </Link>
      </div>

      {/* Mobile scanner shortcut */}
      <Link href="/panel/escanear" className="md:hidden block">
        <div className="flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white rounded-xl px-4 py-3 shadow-md shadow-green-500/30 transition-colors">
          <span className="text-2xl">📷</span>
          <div>
            <p className="font-bold text-sm">Agregar disco con el teléfono</p>
            <p className="text-xs text-green-100">Escaneá el código de barras →</p>
          </div>
        </div>
      </Link>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="search"
            placeholder="Buscar productos..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={loadProducts}>Actualizar</Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      )}

      {/* Products Table */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle>Todos los productos ({filteredProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-3 font-semibold">Producto</th>
                    <th className="pb-3 font-semibold">Tipo</th>
                    <th className="pb-3 font-semibold">Precio</th>
                    <th className="pb-3 font-semibold">Stock</th>
                    <th className="pb-3 font-semibold">Estado</th>
                    <th className="pb-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-gray-50">
                    <td className="py-4">
                      <div>
                        <p className="font-medium">{product.title}</p>
                        <p className="text-sm text-gray-600">{product.artist}</p>
                      </div>
                    </td>
                    <td className="py-4">
                      <Badge variant="outline">{product.type}</Badge>
                    </td>
                    <td className="py-4">${product.price.toLocaleString()}</td>
                    <td className="py-4">
                      <span className={product.stock < 5 ? "text-red-600 font-semibold" : ""}>
                        {product.stock} unidades
                      </span>
                    </td>
                    <td className="py-4">
                      {product.isActive ? (
                        <Badge className="bg-green-100 text-green-800">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        <Link href={`/dashboard/products/${product.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
