"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";

interface Product {
  id: string;
  title: string;
  artist: string;
  type: string;
  condition: string;
  price: number;
  stock: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadProducts();
  }, [filter]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts({ type: filter });
      setProducts(data.products);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const typeLabels: { [key: string]: string } = {
    vinyl: "Vinilo",
    cd: "CD",
    cassette: "Cassette",
    merchandise: "Merch",
    equipment: "Equipo",
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Catálogo de productos</h1>
        <p className="text-gray-600">Explora nuestra colección de música física</p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex gap-2">
        <Button
          variant={filter === undefined ? "default" : "outline"}
          onClick={() => setFilter(undefined)}
        >
          Todos
        </Button>
        <Button
          variant={filter === "vinyl" ? "default" : "outline"}
          onClick={() => setFilter("vinyl")}
        >
          Vinilos
        </Button>
        <Button
          variant={filter === "cd" ? "default" : "outline"}
          onClick={() => setFilter("cd")}
        >
          CDs
        </Button>
        <Button
          variant={filter === "cassette" ? "default" : "outline"}
          onClick={() => setFilter("cassette")}
        >
          Cassettes
        </Button>
        <Button
          variant={filter === "merchandise" ? "default" : "outline"}
          onClick={() => setFilter("merchandise")}
        >
          Merchandising
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      )}

      {/* Products Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <Link href={`/products/${product.id}`} key={product.id}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="p-0">
                  <div className="bg-gray-200 h-48 rounded-t-lg flex items-center justify-center">
                    <Music className="h-16 w-16 text-gray-400" />
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <Badge className="mb-2">{typeLabels[product.type] || product.type}</Badge>
                  <CardTitle className="text-lg mb-1">{product.title}</CardTitle>
                  <CardDescription>{product.artist}</CardDescription>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex justify-between items-center">
                  <span className="text-xl font-bold">{formatPrice(product.price)}</span>
                  <Button size="sm">Ver</Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && products.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">No se encontraron productos</p>
        </div>
      )}
    </div>
  );
}
