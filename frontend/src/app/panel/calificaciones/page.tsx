"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { api } from "@/lib/api";

type Review = {
  id: string;
  storeName: string;
  orderNumber: string;
  customerName: string;
  rating: number;
  comment: string;
  submittedAt: string;
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/reviews/admin")
      .then(setReviews)
      .catch((requestError) => setError(requestError.message || "No se pudieron cargar las calificaciones"));
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reviews;
    return reviews.filter((review) => `${review.storeName} ${review.orderNumber} ${review.customerName}`.toLowerCase().includes(query));
  }, [reviews, search]);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Calificaciones de tiendas</h1>
        <p className="mt-1 text-sm text-slate-600">Detalle privado de experiencias verificadas del marketplace.</p>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tienda, pedido o cliente" className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-600" />
      </div>

      {error ? <p className="text-red-600">{error}</p> : (
        <div className="overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3">Tienda</th><th className="px-4 py-3">Pedido</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Calificación</th><th className="px-4 py-3">Comentario privado</th><th className="px-4 py-3">Fecha</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((review) => (
                <tr key={review.id} className="align-top">
                  <td className="px-4 py-4 font-semibold text-slate-900">{review.storeName}</td>
                  <td className="px-4 py-4 text-slate-600">{review.orderNumber}</td>
                  <td className="px-4 py-4 text-slate-600">{review.customerName}</td>
                  <td className="px-4 py-4"><span className="inline-flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{review.rating}</span></td>
                  <td className="max-w-md whitespace-pre-wrap px-4 py-4 text-slate-700">{review.comment || "Sin comentario."}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-500">{new Date(review.submittedAt).toLocaleDateString("es-CL")}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No hay calificaciones para mostrar.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
