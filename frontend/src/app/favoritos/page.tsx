"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

const FAVORITES_KEYS = ["mundobeat:favorites", "favoriteProductIds", "favorites"];

export default function FavoritosPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const readFavoriteIds = () => {
    if (typeof window === "undefined") return [] as string[];

    for (const key of FAVORITES_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => typeof item === "string" ? item : item?.id || item?.productId).filter(Boolean);
        }
      } catch {
        continue;
      }
    }

    return [] as string[];
  };

  const loadFavorites = async () => {
    try {
      const ids = [...new Set(readFavoriteIds())];
      if (ids.length === 0) {
        setProducts([]);
        return;
      }

      const loaded = await Promise.allSettled(ids.map((id) => api.getProduct(id)));
      setProducts(loaded
        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
        .map((result) => result.value));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-[1300px] space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
            <Heart className="h-7 w-7" /> Favoritos
          </h1>
          <p className="mt-1 text-slate-600">Tus productos guardados para revisar después.</p>
        </div>

        {loading ? (
          <div className="rounded border bg-white p-10 text-center text-slate-500">Cargando favoritos...</div>
        ) : products.length === 0 ? (
          <div className="rounded border bg-white p-10 text-center">
            <Heart className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-semibold text-slate-900">Aún no tienes favoritos</h2>
            <p className="mt-1 text-sm text-slate-500">Cuando guardes productos, aparecerán aquí.</p>
            <Link href="/" className="mt-5 inline-flex rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              Volver a la tienda
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => {
              const image = Array.isArray(product.images) ? product.images[0] : null;
              return (
                <Link key={product.id} href={`/productos/${product.slug || product.id}`} className="overflow-hidden rounded border bg-white shadow-sm transition hover:shadow-md">
                  <div className="aspect-square bg-slate-100">
                    {image && <img src={getImageUrl(image)} alt={product.title} className="h-full w-full object-cover" />}
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 font-semibold text-slate-900">{product.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{product.artist}</p>
                    <p className="mt-2 text-lg font-bold text-sky-700">{formatPrice(Number(product.salePrice || product.price || 0))}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}