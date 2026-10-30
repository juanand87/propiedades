"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Review = { id: string; orderNumber: string; customerName: string; rating: number; comment: string; submittedAt: string; recovery?: { sentAt?: string; acceptedAt?: string; updatedAt?: string } };
type ReviewData = { average: number; count: number; distribution: Record<number, number>; reviews: Review[] };

export default function StoreReviewsPage() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Review | null>(null);
  const [percentage, setPercentage] = useState(10);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [offerError, setOfferError] = useState("");
  async function sendOffer() {
    if (!selected) return;
    setBusy(true); setOfferError("");
    try {
      await api.post(`/reviews/mine/${selected.id}/recovery`, { percentage, resolution });
      setData(await api.get("/reviews/mine")); setSelected(null); setResolution("");
    } catch (e: any) { setOfferError(e.message); } finally { setBusy(false); }
  }

  useEffect(() => {
    api.get("/reviews/mine")
      .then(setData)
      .catch((requestError) => setError(requestError.message || "No se pudieron cargar las calificaciones"));
  }, []);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6 text-slate-500">Cargando calificaciones...</div>;

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-950">Calificaciones</h1>
        <p className="mt-1 text-sm text-slate-600">Experiencias verificadas de pedidos entregados por tu tienda.</p>
      </div>

      <section className="grid gap-6 border-y border-slate-200 bg-white py-6 md:grid-cols-[220px_1fr]">
        <div className="text-center md:border-r md:border-slate-200">
          <p className="text-5xl font-bold text-slate-950">{data.count ? Number(data.average).toFixed(1) : "-"}</p>
          <div className="mt-2 flex justify-center">
            {[1, 2, 3, 4, 5].map((value) => <Star key={value} className={`h-5 w-5 ${value <= Math.round(data.average) ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}`} />)}
          </div>
          <p className="mt-2 text-sm text-slate-500">{data.count} {data.count === 1 ? "calificación verificada" : "calificaciones verificadas"}</p>
        </div>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((value) => {
            const count = Number(data.distribution[value] || 0);
            const percentage = data.count ? (count / data.count) * 100 : 0;
            return (
              <div key={value} className="grid grid-cols-[28px_1fr_36px] items-center gap-3 text-sm">
                <span>{value} ★</span>
                <div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-amber-400" style={{ width: `${percentage}%` }} /></div>
                <span className="text-right text-slate-500">{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-950">Detalle privado</h2>
        <p className="mt-1 text-sm text-slate-500">Los comentarios de esta sección no se publican.</p>
        {data.reviews.length === 0 ? (
          <div className="mt-6 border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            Aún no tienes calificaciones.
          </div>
        ) : (
          <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200 bg-white">
            {data.reviews.map((review) => (
              <article key={review.id} className="px-1 py-5 sm:px-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex">{[1, 2, 3, 4, 5].map((value) => <Star key={value} className={`h-4 w-4 ${value <= review.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />)}</div>
                    <span className="text-sm font-semibold text-slate-900">{review.customerName}</span>
                  </div>
                  <time className="text-xs text-slate-500">{new Date(review.submittedAt).toLocaleDateString("es-CL")}</time>
                </div>
                <p className="mt-2 text-xs text-slate-500">Pedido {review.orderNumber}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{review.comment || "Sin comentario."}</p>
                {review.recovery?.sentAt ? <p className="mt-3 text-xs text-cyan-700">{review.recovery.updatedAt ? "Actualizada después de la atención de la tienda" : review.recovery.acceptedAt ? "Beneficio activado por el comprador" : "Compensación enviada al comprador"}</p> : review.rating <= 3 && <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSelected(review); setOfferError(""); }}>Gestionar experiencia</Button>}
              </article>
            ))}
          </div>
        )}
      </section>
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open && !busy) setSelected(null); }}><DialogContent><DialogHeader><DialogTitle>Recuperar experiencia del cliente</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-600">Enviaremos un correo con un código personal para una próxima compra en tu tienda. El descuento será financiado por tu tienda, tendrá un uso y vencerá en 30 días. El comprador podrá actualizar voluntariamente su calificación.</p>
        <Label htmlFor="recovery-percentage">Descuento</Label><select id="recovery-percentage" className="h-10 rounded border px-3" value={percentage} onChange={(e) => setPercentage(Number(e.target.value))}>{[10,20,30,40].map((n) => <option key={n} value={n}>{n}%</option>)}</select>
        <Label htmlFor="recovery-resolution">Atención o solución ofrecida al comprador</Label><Textarea id="recovery-resolution" rows={4} maxLength={1000} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Describe la atención realizada y tu mensaje de disculpas..." />
        {offerError && <p role="alert" className="text-sm text-red-700">{offerError}</p>}
        <Button disabled={busy || resolution.trim().length < 10} onClick={sendOffer}>{busy ? "Enviando..." : "Enviar compensación"}</Button>
      </DialogContent></Dialog>
    </div>
  );
}
