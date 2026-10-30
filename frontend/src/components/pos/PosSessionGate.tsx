"use client";

import { ReactNode, useEffect, useState } from "react";
import { Banknote, Download, LockKeyhole, UserRound, X } from "lucide-react";
import { API_URL, api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { getImageUrl } from "@/lib/utils";

export interface PosContext {
  token: string;
  staff: { id: string; name: string; role: string };
  shift: any;
  store?: { id: string; name: string; slug: string; logo?: string };
  requestClose: () => void;
  logout: () => void;
}

async function request(path: string, options: RequestInit = {}, posToken?: string) {
  const response = await fetch(`${API_URL}/pos${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}`, ...(posToken ? { "X-Pos-Token": posToken } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || "No fue posible completar la operación");
  return data;
}

function CloseReport({ report }: { report: any }) {
  const summary = report.summary || {};
  const payments = summary.paymentMethods || {
    cash: { count: 0, total: report.cashSales || 0 },
    debit: { count: 0, total: report.debitSales || 0 },
    credit: { count: 0, total: report.creditSales || 0 },
    transfer: { count: 0, total: report.transferSales || 0 },
  };
  function downloadSummary() {
    const paymentRows = [
      ["Efectivo", payments.cash],
      ["Débito", payments.debit],
      ["Crédito", payments.credit],
      ["Transferencia", payments.transfer],
    ] as const;
    const rows: Array<Array<string | number>> = [
      ["RESUMEN DE CIERRE DE CAJA"],
      ["Caja", report.register?.name || "Caja"],
      ["Cajero", report.staff?.name || "Cajero"],
      ["Apertura", report.openedAt ? new Date(report.openedAt).toLocaleString("es-CL") : ""],
      ["Cierre", report.closedAt ? new Date(report.closedAt).toLocaleString("es-CL") : ""],
      [],
      ["Medio de pago", "Cantidad de ventas", "Monto CLP"],
      ...paymentRows.map(([label, payment]) => [label, Number(payment?.count || 0), Number(payment?.total || 0)]),
      ["TOTAL VENTAS", Number(summary.orderCount || 0), Number(summary.totalSales || 0)],
      [],
      ["Fondo inicial", "", Number(report.openingCash || 0)],
      ["Ingresos de efectivo", "", Number(summary.cashMovements?.income || 0)],
      ["Retiros de efectivo", "", Number(summary.cashMovements?.withdrawal || 0)],
      ["Efectivo esperado", "", Number(report.expectedCash || 0)],
      ["Efectivo contado", "", Number(report.countedCash || 0)],
      ["Diferencia", "", Number(report.difference || 0)],
      ["Observación", report.closingNote || ""],
    ];
    const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    const closedAt = report.closedAt ? new Date(report.closedAt) : new Date();
    const stamp = closedAt.toISOString().slice(0, 16).replace(/[:T]/g, "-");
    link.href = url;
    link.download = `resumen-cierre-caja-${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <section className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
    <p className="font-bold text-emerald-900">Turno cerrado correctamente</p>
    <p className="mt-1 text-sm text-emerald-700">{report.register?.name || "Caja"} · {report.staff?.name || "Cajero"} · {Number(summary.orderCount || 0)} venta(s)</p>
    <button type="button" onClick={downloadSummary} className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800">
      <Download className="h-4 w-4" />
      Descargar resumen
    </button>
  </section>;
}

export default function PosSessionGate({ children, publicStore }: { children: (context: PosContext) => ReactNode; publicStore?: { key: string; id?: string; name: string; slug?: string; logo?: string } }) {
  const [registers, setRegisters] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [shift, setShift] = useState<any>(null);
  const [existingShift, setExistingShift] = useState<any>(null);
  const [view, setView] = useState<"login" | "setup">("login");
  const [username, setUsername] = useState(""); const [pin, setPin] = useState("");
  const [registerId, setRegisterId] = useState(""); const [openingCash, setOpeningCash] = useState("");
  const [checkingShift, setCheckingShift] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [staffForm, setStaffForm] = useState({ name: "", username: "", pin: "", role: "cashier" });
  const [closeOpen, setCloseOpen] = useState(false); const [countedCash, setCountedCash] = useState(""); const [closingNote, setClosingNote] = useState("");
  const [lastClose, setLastClose] = useState<any>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);

  async function fetchCurrentShift(posToken: string) {
    const current = await request("/shifts/current-state", { method: "POST" }, posToken);
    return current?.id && current.status === "open" ? current : null;
  }

  async function loadSetup(posToken?: string) {
    if (publicStore) {
      if (!posToken) return;
      const r = await request("/public/registers", {}, posToken);
      setRegisters(r); if (!registerId && r[0]) setRegisterId(r[0].id);
      return;
    }
    const [r, s] = await Promise.all([request("/registers"), request("/staff")]);
    setRegisters(r); setStaffList(s); if (!registerId && r[0]) setRegisterId(r[0].id);
  }

  useEffect(() => {
    if (!publicStore) loadSetup().catch((e) => setError(e.message));
    const saved = sessionStorage.getItem(`mundobeat_pos_session_${publicStore?.key || "dashboard"}`);
    if (saved) {
      const parsed = JSON.parse(saved); setSession(parsed);
      setCheckingShift(true);
      loadSetup(parsed.token).catch(() => undefined);
      fetchCurrentShift(parsed.token).then(setExistingShift).catch(() => { sessionStorage.removeItem(`mundobeat_pos_session_${publicStore?.key || "dashboard"}`); setSession(null); }).finally(() => setCheckingShift(false));
    }
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setCheckingShift(true); setError("");
    try { const data = await request(publicStore ? "/public/login" : "/login", { method: "POST", body: JSON.stringify({ username, pin, store: publicStore?.key }) }); setSession(data); sessionStorage.setItem(`mundobeat_pos_session_${publicStore?.key || "dashboard"}`, JSON.stringify(data)); await loadSetup(data.token); setExistingShift(await fetchCurrentShift(data.token)); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); setCheckingShift(false); }
  }
  async function openShift(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const openedShift = await request("/shifts/open", { method: "POST", body: JSON.stringify({ registerId, openingCash: Number(openingCash) }) }, session.token);
      if (!openedShift?.id || openedShift.status !== "open") throw new Error("No fue posible confirmar la apertura del turno");
      setShift(openedShift); setExistingShift(null);
    }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function continueShift() {
    setBusy(true); setCheckingShift(true); setError("");
    try {
      const current = await fetchCurrentShift(session.token);
      if (!current) { setExistingShift(null); setError("Ese turno ya no está abierto. Abre uno nuevo para comenzar a vender."); return; }
      setShift(current); setExistingShift(null);
    } catch (e: any) { setExistingShift(null); setError(e.message); }
    finally { setBusy(false); setCheckingShift(false); }
  }
  async function addRegister(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await request("/registers", { method: "POST", body: JSON.stringify({ name: registerName }) }); setRegisterName(""); await loadSetup(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function addStaff(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await request("/staff", { method: "POST", body: JSON.stringify(staffForm) }); setStaffForm({ name: "", username: "", pin: "", role: "cashier" }); await loadSetup(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function closeShift(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const report = await request("/shifts/close-current", { method: "POST", body: JSON.stringify({ countedCash: Number(countedCash), note: closingNote }) }, session.token); setLastClose(report); setShift(null); setExistingShift(null); setCloseOpen(false); setCountedCash(""); setClosingNote(""); }
    catch (e: any) {
      if (/no tienes un turno abierto|ya no est[aá] abierto/i.test(e.message)) {
        setShift(null); setExistingShift(null); setCloseOpen(false);
        setError("El turno ya estaba cerrado. Puedes abrir uno nuevo.");
      } else {
        setError(e.message);
      }
    } finally { setBusy(false); }
  }
  function logout() { sessionStorage.removeItem(`mundobeat_pos_session_${publicStore?.key || "dashboard"}`); setSession(null); setShift(null); setExistingShift(null); setLastClose(null); }

  if (session && shift) return <>{children({ token: session.token, staff: session.staff, shift, store: session.store || publicStore, requestClose: () => { setError(""); setCloseOpen(true); }, logout })}{closeOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4"><form onSubmit={closeShift} className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold text-slate-900">Cerrar turno</h2><p className="text-sm text-slate-500">Cuenta el efectivo disponible en la caja.</p></div><button type="button" disabled={busy} onClick={() => { setCloseOpen(false); setError(""); }}><X className="h-5 w-5" /></button></div>{error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}<label className="text-sm font-medium">Efectivo contado</label><input autoFocus required type="number" min="0" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2"/><label className="mt-4 block text-sm font-medium">Observación (opcional)</label><textarea value={closingNote} onChange={(e) => setClosingNote(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2"/><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => { setCloseOpen(false); setError(""); }} className="rounded-md border px-4 py-2 disabled:opacity-60">Cancelar</button><button type="submit" disabled={busy} className="min-w-44 rounded-md bg-rose-600 px-4 py-2 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{busy ? "Cerrando..." : "Cerrar y cuadrar caja"}</button></div></form></div>}</>;

  return <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e0f2fe_0,#f8fafc_48%)] p-5"><div className="w-full max-w-md"><div className="mb-7 flex flex-col items-center text-center">{publicStore?.logo ? <div className="mb-4 flex min-h-20 w-full items-center justify-center"><img src={getImageUrl(publicStore.logo)} alt={publicStore.name} className="max-h-20 w-auto max-w-[240px] object-contain"/></div> : <div className="mb-4 grid h-16 w-16 place-items-center rounded-lg bg-blue-600 text-2xl font-bold text-white shadow-sm">{publicStore?.name?.charAt(0) || "M"}</div>}<p className="text-sm font-semibold text-blue-600">{publicStore?.name || "MundoBeat"}</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Punto de Venta</h1><p className="mt-1 text-sm text-slate-600">Acceso seguro para el equipo de tienda.</p>{session && <div className="mt-4 flex flex-wrap items-center justify-center gap-2"><div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-slate-700"><UserRound className="h-4 w-4 text-blue-600"/><span>Cajero: <b>{session.staff.name}</b></span></div><button onClick={logout} className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50">Cambiar cajero</button></div>}</div>
    {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {lastClose && <CloseReport report={lastClose} />}
    {!session ? <form onSubmit={login} className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60"><div className="mb-5 text-center"><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-blue-600"><LockKeyhole className="h-6 w-6"/></div><h2 className="text-lg font-bold">Acceso del cajero</h2><p className="mt-1 text-sm text-slate-500">Ingresa con las credenciales asignadas por la tienda.</p></div><label className="text-sm font-medium text-slate-700">Usuario</label><input autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Tu usuario" className="mb-3 mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/><label className="text-sm font-medium text-slate-700">Clave o PIN</label><input required type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Tu clave" className="mb-5 mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/><button disabled={busy} className="w-full rounded-md bg-blue-600 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? "Ingresando..." : "Ingresar"}</button></form>
    : checkingShift ? <div className="w-full rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-medium text-slate-600">Comprobando turno abierto...</p></div>
    : existingShift ? <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60"><div className="text-center"><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Banknote className="h-6 w-6"/></div><h2 className="text-lg font-bold">Tienes un turno abierto</h2><p className="mt-1 text-sm text-slate-500">{existingShift.register?.name || "Caja"} · Fondo inicial {formatPrice(existingShift.openingCash || 0)}</p></div><div className="mt-6 space-y-2"><button type="button" disabled={busy} onClick={continueShift} className="w-full rounded-md bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? "Comprobando turno..." : "Continuar turno abierto"}</button><button type="button" disabled={busy} onClick={() => { setShift(existingShift); setCloseOpen(true); }} className="w-full rounded-md border border-slate-300 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cerrar turno y abrir uno nuevo</button></div><p className="mt-4 text-center text-xs text-slate-500">Para registrar un fondo inicial diferente debes cerrar y cuadrar el turno anterior.</p></div>
    : <form onSubmit={openShift} className="mx-auto max-w-lg rounded-lg border bg-white p-6 shadow-sm"><Banknote className="mb-4 h-8 w-8 text-emerald-600"/><h2 className="text-xl font-bold">Abrir turno</h2><p className="mb-5 text-sm text-slate-500">Hola, {session.staff.name}. Selecciona la caja y registra el fondo inicial.</p>{registers.length ? <><label className="text-sm font-medium">Caja</label><select required value={registerId} onChange={(e) => setRegisterId(e.target.value)} className="mb-4 mt-1 w-full rounded-md border px-3 py-2">{registers.filter((r) => r.isActive).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><label className="text-sm font-medium">Fondo inicial en efectivo</label><input autoFocus required type="number" min="0" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} placeholder="Ingresa el monto, incluso si es 0" className="mb-5 mt-1 w-full rounded-md border px-3 py-2"/><button type="submit" disabled={busy || openingCash === ""} className="w-full rounded-md bg-emerald-600 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Abriendo caja..." : "Abrir caja e iniciar ventas"}</button></> : <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">Primero crea una caja en Configuración de Tienda → Punto de venta.</div>}</form>}
  </div></div>;
}
