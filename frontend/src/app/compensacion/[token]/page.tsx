"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Gift, Copy, Star } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function RecoveryPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api
      .get(`/reviews/recovery/${token}`, false)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);
  async function activate() {
    setBusy(true);
    setError("");
    try {
      setData(
        await api.post(
          `/reviews/recovery/${token}/accept`,
          { acceptedTerms: accepted },
          false,
        ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const money = (value: number) => `$${Number(value).toLocaleString("es-CL")}`;
  return (
    <main className="min-h-screen bg-sky-50 px-4 py-12">
      <div className="mx-auto max-w-xl rounded-lg border bg-white p-6 sm:p-9">
        <Link href="/" className="font-bold text-cyan-700">
          MundoBeat
        </Link>
        {error && (
          <p role="alert" className="my-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {!data ? (
          <p className="mt-6">
            {error ? "Beneficio no disponible." : "Cargando beneficio..."}
          </p>
        ) : (
          <>
            <Gift className="mt-7 h-10 w-10 text-cyan-600" />
            <h1 className="mt-4 text-2xl font-bold">
              Un beneficio de {data.storeName}
            </h1>
            <p className="mt-4 whitespace-pre-wrap text-slate-600">
              {data.resolution}
            </p>
            <p className="mt-6 text-4xl font-bold text-cyan-700">
              {data.percentage}% de descuento
            </p>
            <ul className="my-5 space-y-2 text-sm text-slate-600">
              <li>
                Válido en una próxima compra en {data.storeName}, sin incluir
                envío.
              </li>
              <li>
                Personal, de un solo uso y asociado al correo de tu compra
                anterior.
              </li>
              <li>
                Vence el {new Date(data.expiresAt).toLocaleDateString("es-CL")}.
              </li>
              {!!data.minPurchase && (
                <li>Compra mínima: {money(data.minPurchase)}.</li>
              )}
              {!!data.maxDiscount && (
                <li>Descuento máximo: {money(data.maxDiscount)}.</li>
              )}
              <li>
                No acumulable con otros códigos. Se reserva al crear el pedido.
              </li>
            </ul>
            {!data.available ? (
              <p className="text-amber-800">
                Este beneficio venció o ya no está disponible.
              </p>
            ) : !data.acceptedAt ? (
              <>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  Acepto las condiciones del beneficio. Entiendo que activarlo
                  no modifica mi calificación y que actualizarla es opcional.
                </label>
                <Button
                  className="mt-5 w-full"
                  disabled={!accepted || busy}
                  onClick={activate}
                >
                  {busy ? "Activando..." : "Activar y ver código"}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 border border-cyan-200 bg-cyan-50 p-4">
                  <code className="break-all text-lg font-bold">
                    {data.code}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Copiar código"
                    onClick={async () => {
                      await navigator.clipboard.writeText(data.code);
                      setCopied(true);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {copied && (
                  <p className="mt-1 text-xs text-emerald-700">
                    Código copiado
                  </p>
                )}
                <p className="mt-5 text-sm text-slate-600">
                  Tu calificación sigue igual. Si deseas reflejar la atención
                  recibida, puedes elegir libremente las estrellas y editar tu
                  comentario durante los próximos 7 días.
                </p>
                <Button asChild variant="outline" className="mt-4 w-full">
                  <Link href={data.reviewUrl}>
                    <Star className="mr-2 h-4 w-4" />
                    Actualizar mi calificación (opcional)
                  </Link>
                </Button>
                <Link
                  href={`/tiendas/${data.storeSlug}`}
                  className="mt-5 block text-center font-semibold text-cyan-700"
                >
                  Visitar la tienda
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
