"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Lock, Star } from "lucide-react";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

type ReviewContext = {
  orderNumber: string;
  storeName: string;
  storeSlug: string;
  storeLogo?: string | null;
  products: Array<{ title: string; image?: string | null; quantity: number }>;
  rating?: number | null;
  comment?: string;
  submittedAt?: string | null;
  editableUntil?: string | null;
  canEdit: boolean;
};

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [review, setReview] = useState<ReviewContext | null>(null);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.get(`/reviews/public/${token}`, false)
      .then((data) => {
        setReview(data);
        setRating(Number(data.rating || 0));
        setComment(data.comment || "");
      })
      .catch((requestError) => setError(requestError.message || "El enlace no está disponible"))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (!rating || !review?.canEdit) return;
    setSaving(true);
    setError("");
    try {
      const result = await api.post(`/reviews/public/${token}`, { rating, comment }, false);
      setMessage(result.message);
      setReview((current) => current ? {
        ...current,
        rating: result.rating,
        comment: result.comment,
        editableUntil: result.editableUntil,
        canEdit: result.canEdit,
        submittedAt: current.submittedAt || new Date().toISOString(),
      } : current);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError: any) {
      setError(requestError.message || "No pudimos guardar la calificación");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">Cargando calificación...</main>;
  }

  if (error && !review) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="max-w-md text-center">
          <Star className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <h1 className="text-2xl font-bold text-slate-950">Enlace no disponible</h1>
          <p className="mt-2 text-slate-600">{error}</p>
          <Link href="/" className="mt-6 inline-block font-semibold text-cyan-700">Volver a MundoBeat</Link>
        </div>
      </main>
    );
  }

  if (!review) return null;
  const isUpdate = Boolean(review.submittedAt);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <Link href="/" className="text-xl font-bold text-cyan-700">MundoBeat</Link>
        </header>

        <div className="px-6 py-7 sm:px-8">
          {message && (
            <div className="mb-6 flex gap-3 border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div><p className="font-semibold">{message}</p><p className="text-sm">No enviaremos más recordatorios.</p></div>
            </div>
          )}

          <div className="flex items-center gap-4">
            {review.storeLogo ? (
              <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-2">
                <img
                  src={getImageUrl(review.storeLogo)}
                  alt={`Logo de ${review.storeName}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-slate-100 text-xl font-bold text-slate-500">{review.storeName.charAt(0)}</div>
            )}
            <div>
              <p className="text-sm text-slate-500">Pedido {review.orderNumber}</p>
              <h1 className="text-2xl font-bold text-slate-950">Califica a {review.storeName}</h1>
            </div>
          </div>

          <section className="mt-8 border-y border-slate-200 py-5">
            <p className="mb-3 text-sm font-semibold text-slate-700">Productos de esta compra</p>
            <div className="space-y-3">
              {review.products.map((product, index) => (
                <div key={`${product.title}-${index}`} className="flex items-center gap-3">
                  {product.image ? <img src={product.image} alt="" className="h-11 w-11 rounded object-cover" /> : <div className="h-11 w-11 rounded bg-slate-100" />}
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-800">{product.title}</p>
                  <span className="text-xs text-slate-500">x{product.quantity}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="py-7 text-center">
            <p className="text-base font-semibold text-slate-900">¿Cómo fue el servicio de la tienda?</p>
            <div className="mt-4 flex justify-center gap-2" onMouseLeave={() => setHovered(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={!review.canEdit}
                  onMouseEnter={() => setHovered(value)}
                  onClick={() => setRating(value)}
                  className="rounded p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:cursor-default"
                  aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}`}
                >
                  <Star className={`h-10 w-10 transition-colors ${(hovered || rating) >= value ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}`} />
                </button>
              ))}
            </div>
          </section>

          <label className="block text-sm font-semibold text-slate-800" htmlFor="review-comment">Comentario para la tienda (opcional)</label>
          <textarea
            id="review-comment"
            value={comment}
            disabled={!review.canEdit}
            maxLength={2000}
            rows={5}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Cuéntale a la tienda cómo fue tu experiencia"
            className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50"
          />
          <div className="mt-2 flex items-start gap-2 text-xs text-slate-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>Este comentario es privado: sólo podrán verlo la tienda y la administración de MundoBeat. Públicamente se muestran las estrellas y el total.</p>
          </div>

          {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

          {review.canEdit ? (
            <button
              type="button"
              disabled={!rating || saving}
              onClick={submit}
              className="mt-6 w-full rounded-md bg-cyan-700 px-5 py-3 font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Guardando..." : isUpdate ? "Actualizar calificación" : "Enviar calificación"}
            </button>
          ) : (
            <p className="mt-6 border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">El período de 7 días para modificar esta calificación ya terminó.</p>
          )}

          {review.editableUntil && review.canEdit && (
            <p className="mt-3 text-center text-xs text-slate-500">Puedes modificarla desde este mismo enlace hasta el {new Date(review.editableUntil).toLocaleDateString("es-CL")}.</p>
          )}
        </div>
      </div>
    </main>
  );
}
