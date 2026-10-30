"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, ExternalLink, EyeOff, MessageCircle, RefreshCw, Search, Send, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

type Mode = "vendor" | "customer" | "admin";

const PENALTY_REASONS = [
  "Compartió datos de contacto",
  "Intentó concretar la venta fuera de MundoBeat",
  "Respuesta inapropiada o contraria a las normas",
];

export default function QuestionsInbox({ mode }: { mode: Mode }) {
  return mode === "vendor" ? <VendorQuestionsInbox /> : <LegacyQuestionsInbox mode={mode} />;
}

function VendorQuestionsInbox() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [mlSyncStatus, setMlSyncStatus] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getVendorQuestions(status);
      setRows(Array.isArray(data) ? data : []);
      setSelectedId((current) => current && data.some((row: any) => row.id === current) ? current : data[0]?.id || "");
    } catch (requestError: any) {
      setError(requestError.message || "No fue posible cargar las preguntas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]);

  const loadMercadoLibreStatus = async () => {
    try {
      setMlSyncStatus(await api.getMercadoLibreQuestionSyncStatus());
    } catch {
      setMlSyncStatus(null);
    }
  };

  useEffect(() => { loadMercadoLibreStatus(); }, []);

  const syncMercadoLibre = async () => {
    setSyncing(true);
    setError("");
    setSyncNotice("");
    try {
      const result = await api.syncMercadoLibreQuestions();
      setSyncNotice(`${result.imported || 0} nuevas, ${result.updated || 0} actualizadas${result.unlinked ? ` y ${result.unlinked} sin vínculo` : ""}.`);
      await Promise.all([load(), loadMercadoLibreStatus()]);
    } catch (requestError: any) {
      setError(requestError.message || "No fue posible sincronizar las preguntas de Mercado Libre.");
    } finally {
      setSyncing(false);
    }
  };

  const filteredRows = rows.filter((question) => {
    const needle = search.trim().toLocaleLowerCase("es");
    if (!needle) return true;
    const messageText = (question.messages || []).map((message: any) => message.content).join(" ");
    const customerName = `${question.customer?.firstName || ""} ${question.customer?.lastName || ""}`;
    return `${question.product?.title || ""} ${customerName} ${messageText}`.toLocaleLowerCase("es").includes(needle);
  });
  const selected = filteredRows.find((question) => question.id === selectedId) || null;

  const sendReply = async () => {
    if (!selected || draft.trim().length < 5) return;
    setBusy(true);
    setError("");
    try {
      await api.replyToQuestion(selected.id, draft.trim());
      setDraft("");
      await load();
    } catch (requestError: any) {
      setError(requestError.message || "No fue posible enviar la respuesta.");
    } finally {
      setBusy(false);
    }
  };

  const productImage = (question: any) => getImageUrl(question?.product?.images?.[0] || question?.product?.image || "");
  const customerName = (question: any) => {
    const firstName = question?.customer?.firstName?.trim();
    const lastName = question?.customer?.lastName?.trim();
    return [firstName, lastName].filter(Boolean).join(" ") || "Comprador";
  };
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Preguntas de compradores</h1>
          <p className="mt-1 text-sm text-slate-600">Gestiona las consultas de tus productos desde un solo lugar.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
          {mlSyncStatus?.connected && <button onClick={syncMercadoLibre} disabled={syncing || mlSyncStatus.running} className="inline-flex h-10 items-center gap-2 rounded-md border border-sky-300 bg-white px-3 font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-wait disabled:opacity-60"><RefreshCw size={16} className={syncing || mlSyncStatus.running ? "animate-spin" : ""} />{syncing || mlSyncStatus.running ? "Sincronizando..." : "Sincronizar Mercado Libre"}</button>}
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 font-medium text-amber-800">{rows.filter((row) => row.status === "pending").length} pendientes</span>
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 font-medium text-emerald-800">{rows.filter((row) => row.status === "answered").length} respondidas</span>
        </div>
      </header>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {mlSyncStatus?.connected && (syncNotice || mlSyncStatus.lastSuccessAt || mlSyncStatus.lastError) && <div className={`rounded-md border px-4 py-3 text-sm ${mlSyncStatus.lastError && !syncNotice ? "border-amber-200 bg-amber-50 text-amber-800" : "border-sky-200 bg-sky-50 text-sky-800"}`}><strong>Mercado Libre:</strong> {syncNotice || (mlSyncStatus.lastError ? `Último intento fallido: ${mlSyncStatus.lastError}` : `Última sincronización ${new Date(mlSyncStatus.lastSuccessAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}.`)}</div>}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm lg:grid lg:min-h-[650px] lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={`border-slate-200 lg:border-r ${selected ? "hidden lg:block" : "block"}`}>
          <div className="space-y-3 border-b border-slate-200 p-3">
            <div className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
              <Search size={17} className="text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar comprador o producto" className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none" />
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1 text-xs font-medium">
              {[{ id: "", label: "Todas" }, { id: "pending", label: "Pendientes" }, { id: "answered", label: "Respondidas" }].map((item) => (
                <button key={item.id} onClick={() => setStatus(item.id)} className={`rounded px-2 py-2 transition ${status === item.id ? "bg-white text-sky-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{item.label}</button>
              ))}
            </div>
          </div>

          <div className="max-h-[570px] overflow-y-auto">
            {loading ? <div className="p-8 text-center text-sm text-slate-500">Cargando preguntas...</div> : filteredRows.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No hay preguntas en esta vista.</div> : filteredRows.map((question) => {
              const messages = question.messages || [];
              const lastMessage = messages[messages.length - 1];
              const name = customerName(question);
              const isSelected = selected?.id === question.id;
              return (
                <button key={question.id} onClick={() => setSelectedId(question.id)} className={`relative flex w-full gap-3 border-b border-slate-100 p-3 text-left transition ${isSelected ? "bg-sky-50" : "hover:bg-slate-50"}`}>
                  {question.status === "pending" && <span className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-sky-600" />}
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                    {productImage(question) ? <img src={productImage(question)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><MessageCircle size={22} className="text-slate-300" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2"><strong className="truncate text-sm text-slate-950">{name}</strong><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${question.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{question.status === "pending" ? "Pendiente" : "Respondida"}</span></div>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-700">{question.product?.title || "Producto"}</p>
                    <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${question.source === "mercadolibre" ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-600"}`}>{question.source === "mercadolibre" ? "Mercado Libre" : "MundoBeat"}</span>
                    <p className="mt-1 truncate text-xs text-slate-500">{lastMessage?.content || "Sin mensajes"}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{new Date(question.updatedAt || question.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={`${selected ? "flex" : "hidden lg:flex"} min-w-0 flex-col bg-slate-50/50`}>
          {!selected ? <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">Selecciona una conversación para verla.</div> : <>
            <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white p-4">
              <button onClick={() => setSelectedId("")} className="rounded-md border border-slate-200 p-2 text-slate-600 lg:hidden" title="Volver al listado"><ChevronLeft size={18} /></button>
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                {productImage(selected) ? <img src={productImage(selected)} alt={`Portada de ${selected.product?.title || "producto"}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><MessageCircle className="text-slate-300" /></div>}
              </div>
              <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><h2 className="truncate font-bold text-slate-950">{selected.product?.title || "Producto"}</h2><span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${selected.source === "mercadolibre" ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-600"}`}>{selected.source === "mercadolibre" ? "Mercado Libre" : "MundoBeat"}</span></div><p className="mt-1 text-sm text-slate-500">{selected.product?.format?.name || selected.product?.formats?.[0]?.name || "Producto publicado"}{selected.product?.price ? ` · ${new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(selected.product.price)}` : ""}</p></div>
              <div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${selected.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{selected.status === "pending" ? "Pendiente" : "Respondida"}</span><Link href={`/productos/${selected.product?.slug || selected.productId}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50">Ver producto <ExternalLink size={13} /></Link></div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              {(selected.messages || []).map((message: any) => {
                const fromVendor = message.authorType === "vendor";
                const name = fromVendor ? "Tu tienda" : customerName(selected);
                return <div key={message.id} className={`flex items-end gap-2 ${fromVendor ? "justify-end" : "justify-start"}`}>
                  {!fromVendor && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-200 text-xs font-bold text-fuchsia-800">{initials(name)}</div>}
                  <div className={`max-w-[82%] ${fromVendor ? "text-right" : "text-left"}`}><div className={`mb-1 flex items-center gap-2 text-xs text-slate-500 ${fromVendor ? "justify-end" : ""}`}><strong className="text-slate-700">{name}</strong><span>{new Date(message.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</span></div><div className={`rounded-md px-4 py-3 text-left text-sm leading-6 shadow-sm ${fromVendor ? "bg-sky-100 text-slate-900" : "border border-slate-200 bg-white text-slate-800"}`}>{message.content}</div></div>
                  {fromVendor && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">MB</div>}
                </div>;
              })}
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-700">Responder públicamente como vendedor</p><span className="text-xs text-slate-400">{draft.length}/1000</span></div>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") sendReply(); }} rows={4} maxLength={1000} placeholder="Escribe una respuesta clara para el comprador..." className="w-full resize-none rounded-md border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
              <div className="mt-3 flex justify-end"><button disabled={busy || draft.trim().length < 5} onClick={sendReply} className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Send size={16} />{busy ? "Enviando..." : "Enviar respuesta"}</button></div>
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}

function LegacyQuestionsInbox({ mode }: { mode: Mode }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(mode === "admin" ? "pending_review" : "");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [penaltyReasons, setPenaltyReasons] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true); setError("");
    try {
      const data = mode === "vendor" ? await api.getVendorQuestions(status) : mode === "admin" ? await api.getAdminQuestions(search, status) : await api.getMyQuestions();
      setRows(data);
    } catch (requestError: any) { setError(requestError.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [mode, status]);

  const reply = async (questionId: string) => {
    setBusy(questionId); setError("");
    try { await api.replyToQuestion(questionId, drafts[questionId] || ""); setDrafts((current) => ({ ...current, [questionId]: "" })); await load(); }
    catch (requestError: any) { setError(requestError.message); }
    finally { setBusy(""); }
  };

  const moderate = async (question: any, action: 'review' | 'penalize' | 'annul') => {
    const vendorMessage = [...(question.messages || [])].reverse().find((message: any) => message.authorType === 'vendor');
    if (!vendorMessage) return;
    const reason = action === 'penalize' ? penaltyReasons[question.id] : undefined;
    if (action === 'penalize' && !reason) { setError('Selecciona un motivo de penalización.'); return; }
    if (action === 'annul' && !window.confirm('¿Anular esta conversación? La pregunta y todas sus respuestas dejarán de mostrarse públicamente y no podrán recibir nuevas respuestas.')) return;
    const annulQuestion = action === 'penalize'
      ? window.confirm('¿También deseas anular toda la conversación?\n\nAceptar: se ocultarán la pregunta y todas sus respuestas.\nCancelar: solo se ocultará la respuesta penalizada.')
      : false;
    setBusy(question.id); setError("");
    try { await api.moderateQuestionMessage(vendorMessage.id, action, reason, annulQuestion); await load(); }
    catch (requestError: any) { setError(requestError.message); }
    finally { setBusy(""); }
  };

  return (
    <div className="space-y-5">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><MessageCircle className="h-6 w-6" />Preguntas</h1><p className="mt-1 text-sm opacity-70">{mode === 'admin' ? 'Revisa todas las conversaciones públicas del marketplace.' : mode === 'vendor' ? 'Responde las consultas públicas sobre tus productos.' : 'Revisa las preguntas que has realizado.'}</p></div>
      <div className="flex flex-wrap gap-2">
        {mode === 'admin' && <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-md border bg-white px-3"><Search className="h-4 w-4 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} placeholder="Producto, tienda o mensaje" className="h-10 w-full outline-none" /><button onClick={load} className="text-sm font-semibold">Buscar</button></div>}
        {mode === 'admin' ? <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-md border bg-white px-3 text-sm text-gray-800"><option value="pending_review">Pendientes de revisión</option><option value="reviewed">Revisadas</option><option value="penalized">Penalizadas</option><option value="annulled">Anuladas</option><option value="all">Todas las respondidas</option></select> : mode === 'vendor' && <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-md border bg-white px-3 text-sm text-gray-800"><option value="">Todas</option><option value="pending">Pendientes</option><option value="answered">Respondidas</option></select>}
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <p className="text-sm opacity-70">Cargando preguntas...</p> : rows.length === 0 ? <div className="rounded-md border border-dashed p-10 text-center text-sm opacity-70">No hay preguntas en esta vista.</div> : <div className="space-y-4">{rows.map((question) => (
        <article key={question.id} className="overflow-hidden rounded-md border bg-white text-gray-900 shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50 px-4 py-3"><div><Link href={`/productos/${question.product?.slug || question.productId}`} target="_blank" className="font-semibold hover:underline">{question.product?.title || 'Producto'}</Link><p className="text-xs text-gray-500">{mode === 'admin' ? `${question.vendor?.storeName} · ` : ''}{new Date(question.createdAt).toLocaleString('es-CL')}</p></div><div className="flex items-center gap-2">{question.source === 'mercadolibre' && <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800">Mercado Libre</span>}<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${mode === 'admin' ? question.reviewStatus === 'penalized' ? 'bg-red-100 text-red-700' : question.reviewStatus === 'annulled' ? 'bg-gray-800 text-white' : question.reviewStatus === 'reviewed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800' : question.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{mode === 'admin' ? question.reviewStatus === 'penalized' ? 'Penalizada' : question.reviewStatus === 'annulled' ? 'Anulada' : question.reviewStatus === 'reviewed' ? 'Revisada' : 'Pendiente de revisión' : question.status === 'pending' ? 'Pendiente' : 'Respondida'}</span>{mode === 'admin' && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${(question.vendorPenaltyPoints || 0) >= 3 ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'}`}>{question.vendorPenaltyPoints || 0}/3 puntos</span>}</div></header>
          <div className="space-y-3 p-4">{(question.messages || []).map((message: any) => (
            <div key={message.id} className={`rounded-md border p-3 ${message.isHidden ? 'border-red-200 bg-red-50' : message.authorType === 'vendor' ? 'ml-4 border-blue-100 bg-blue-50 md:ml-10' : 'bg-white'}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase text-gray-500">{message.authorType === 'vendor' ? 'Vendedor' : 'Comprador'} · {new Date(message.createdAt).toLocaleString('es-CL')}</p>{message.isHidden && <span className="flex items-center gap-1 text-xs font-semibold text-red-700"><EyeOff className="h-3.5 w-3.5" />Oculto por penalización</span>}</div><p className="mt-1 whitespace-pre-wrap text-sm">{message.content}</p>{message.moderationReason && <p className="mt-2 text-xs text-red-700"><strong>Motivo:</strong> {message.moderationReason}</p>}</div>
          ))}{mode !== 'admin' && <div className="flex gap-2 pt-2"><textarea value={drafts[question.id] || ''} onChange={(event) => setDrafts((current) => ({ ...current, [question.id]: event.target.value }))} rows={2} maxLength={1000} placeholder={mode === 'vendor' ? 'Responder públicamente...' : 'Agregar otra consulta...'} className="min-w-0 flex-1 resize-y rounded-md border p-2 text-sm" /><button disabled={busy === question.id || (drafts[question.id] || '').trim().length < 5} onClick={() => reply(question.id)} title="Enviar respuesta" className="self-end rounded-md bg-sky-600 p-3 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button></div>}</div>
          {mode === 'admin' && question.reviewStatus === 'pending_review' && <div className="flex flex-wrap items-center gap-2 border-t bg-gray-50 px-4 py-3"><button disabled={busy === question.id} onClick={() => moderate(question, 'review')} className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Marcar como revisada</button><button disabled={busy === question.id} onClick={() => moderate(question, 'annul')} className="rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">Anular conversación</button><select value={penaltyReasons[question.id] || ''} onChange={(event) => setPenaltyReasons((current) => ({ ...current, [question.id]: event.target.value }))} className="min-w-[260px] flex-1 rounded-md border bg-white px-3 py-2 text-sm"><option value="">Seleccionar motivo de penalización</option>{PENALTY_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select><button disabled={busy === question.id || !penaltyReasons[question.id]} onClick={() => moderate(question, 'penalize')} className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><ShieldAlert className="h-4 w-4" />Penalizar vendedor</button></div>}
          {mode === 'admin' && (question.vendorPenaltyPoints || 0) >= 3 && <div className="flex items-center gap-2 border-t border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" />Esta tienda alcanzó 3 penalizaciones y requiere revisión manual de su cuenta.</div>}
        </article>
      ))}</div>}
    </div>
  );
}
