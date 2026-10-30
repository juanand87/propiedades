"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";
import { api } from "@/lib/api";
import { usePathname } from "next/navigation";

export default function ProductQuestions({ productId, embedded = false }: { productId: string; embedded?: boolean }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [canAsk, setCanAsk] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const pathname = usePathname();
  const [returnPath, setReturnPath] = useState(`${pathname}#preguntas`);

  const load = async () => {
    try { setQuestions(await api.getProductQuestions(productId)); }
    catch { setError("No fue posible cargar las preguntas."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setReturnPath(`${window.location.pathname}#preguntas`);
    load();
    const checkSession = async () => {
      if (!api.getToken()) {
        setCanAsk(false);
        setCheckingSession(false);
        return;
      }
      try {
        const profile = await api.getProfile();
        setCanAsk(profile?.role === 'customer');
      } catch {
        setCanAsk(false);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, [productId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true); setError(""); setSent(false);
    try {
      await api.createProductQuestion(productId, message);
      setMessage(""); setSent(true); await load();
    } catch (requestError: any) { setError(requestError.message); }
    finally { setSending(false); }
  };

  return (
    <section id="preguntas" className={embedded ? "scroll-mt-24" : "mt-10 border-t border-gray-200 pt-8 scroll-mt-24"}>
      <div className="mb-5 flex items-center gap-2">
        <MessageCircle className="h-5 w-5" style={{ color: "var(--color-primary, #087fb8)" }} />
        <h2 className="text-xl font-bold text-gray-900">Preguntas sobre este producto</h2>
      </div>

      <div className="mb-7 rounded-md border border-gray-200 bg-white p-4">
        {checkingSession ? (
          <p className="text-sm text-gray-500">Verificando sesión...</p>
        ) : !canAsk ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">Inicia sesión o regístrate como comprador para preguntarle al vendedor.</p>
            <div className="flex gap-2">
              <Link href={`/login?redirect=${encodeURIComponent(returnPath)}`} className="rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "var(--color-primary, #087fb8)" }}>Iniciar sesión</Link>
              <Link href={`/register?redirect=${encodeURIComponent(returnPath)}`} className="rounded-md border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--color-primary, #087fb8)", color: "var(--color-primary, #087fb8)" }}>Registrarse</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="product-question" className="mb-2 block text-sm font-semibold text-gray-800">Pregunta al vendedor</label>
            <textarea id="product-question" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} rows={3} required className="w-full resize-y rounded-md border border-gray-300 p-3 text-sm outline-none focus:ring-2" placeholder="Escribe tu pregunta sobre el producto..." />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-500">No compartas teléfonos, correos, enlaces ni redes sociales.</p>
              <button disabled={sending || message.trim().length < 5} className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "var(--color-primary, #087fb8)" }}><Send className="h-4 w-4" />{sending ? "Enviando..." : "Preguntar"}</button>
            </div>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {sent && <p className="mt-3 text-sm text-green-700">Pregunta publicada y vendedor notificado.</p>}
      </div>

      {loading ? <p className="text-sm text-gray-500">Cargando preguntas...</p> : questions.length === 0 ? (
        <p className="text-sm text-gray-500">Aún no hay preguntas. Sé la primera persona en consultar.</p>
      ) : (
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {questions.map((question) => (
            <div key={question.id} className="space-y-3 py-5">
              {question.messages.map((item: any) => (
                <div key={item.id} className={`flex gap-3 ${item.authorType === 'vendor' ? 'ml-5 md:ml-10' : ''}`}>
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: item.authorType === 'vendor' ? "var(--color-primary, #087fb8)" : "#475569" }}>{item.authorType === 'vendor' ? 'T' : 'C'}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-gray-900">{item.authorType === 'vendor' ? 'Vendedor' : item.authorName}</span><span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString('es-CL')}</span></div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{item.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
