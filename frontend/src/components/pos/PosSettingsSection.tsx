"use client";

import { useEffect, useState } from "react";
import { Monitor, Plus, Settings, UserRound } from "lucide-react";
import { API_URL, api } from "@/lib/api";

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}/pos${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}`, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || "No fue posible completar la operación");
  return data;
}

export default function PosSettingsSection({ initialTab }: { initialTab?: string }) {
  const mappedTab = initialTab === "usuarios" ? "users" : initialTab === "configuracion-pos" ? "settings" : "registers";
  const [tab, setTab] = useState<"registers" | "users" | "settings">(mappedTab);
  const [registers, setRegisters] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [registerName, setRegisterName] = useState("");
  const [userForm, setUserForm] = useState({ name: "", username: "", pin: "", role: "cashier" });
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load() {
    try { const [r, u] = await Promise.all([request("/registers"), request("/staff")]); setRegisters(r); setUsers(u); }
    catch (e: any) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { setTab(initialTab === "usuarios" ? "users" : initialTab === "configuracion-pos" ? "settings" : "registers"); }, [initialTab]);

  async function addRegister(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await request("/registers", { method: "POST", body: JSON.stringify({ name: registerName }) }); setRegisterName(""); setNotice("Caja creada correctamente."); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function toggleRegister(item: any) {
    setError(""); setNotice("");
    try { await request(`/registers/${item.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !item.isActive }) }); setNotice(`Caja ${item.isActive ? "desactivada" : "activada"}.`); await load(); }
    catch (e: any) { setError(e.message); }
  }
  async function addUser(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await request("/staff", { method: "POST", body: JSON.stringify(userForm) }); setUserForm({ name: "", username: "", pin: "", role: "cashier" }); setNotice("Usuario creado correctamente."); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function toggleUser(item: any) {
    setError(""); setNotice("");
    try { await request(`/staff/${item.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !item.isActive }) }); setNotice(`Usuario ${item.isActive ? "desactivado" : "activado"}.`); await load(); }
    catch (e: any) { setError(e.message); }
  }

  const tabs = [
    { id: "registers" as const, label: "Cajas", icon: Monitor },
    { id: "users" as const, label: "Usuarios", icon: UserRound },
    { id: "settings" as const, label: "Configuración", icon: Settings },
  ];

  return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-bold text-slate-950">Punto de venta</h2><p className="text-sm text-slate-500">Administra las cajas y las personas autorizadas para vender.</p></div>
    <div className="flex gap-1 border-b border-slate-200 px-4 pt-3">{tabs.map(({id,label,icon:Icon}) => <button key={id} onClick={() => { setTab(id); setError(""); setNotice(""); }} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Icon className="h-4 w-4"/>{label}</button>)}</div>
    <div className="p-5">
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
      {tab === "registers" && <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><div><h3 className="font-semibold text-slate-900">Cajas creadas</h3><p className="mb-4 text-sm text-slate-500">Representan los terminales físicos disponibles en el local.</p><div className="space-y-2">{registers.length ? registers.map((item) => <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3"><div><p className="font-semibold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">Código: {item.code}</p></div><button onClick={() => toggleRegister(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.isActive ? "Activa" : "Inactiva"}</button></div>) : <p className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">Aún no hay cajas creadas.</p>}</div></div><form onSubmit={addRegister} className="rounded-md border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">Nueva caja</h3><label className="mt-4 block text-sm font-medium">Nombre</label><input required value={registerName} onChange={(e) => setRegisterName(e.target.value)} placeholder="Ej: Caja 1" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"/><button disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2 font-semibold text-white"><Plus className="h-4 w-4"/>Crear caja</button></form></div>}
      {tab === "users" && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div><h3 className="font-semibold text-slate-900">Usuarios del punto de venta</h3><p className="mb-4 text-sm text-slate-500">Cada cajero ingresa con sus propias credenciales.</p><div className="space-y-2">{users.length ? users.map((item) => <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3"><div><p className="font-semibold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.username} · {item.role === "supervisor" ? "Supervisor" : "Cajero"}</p></div><button onClick={() => toggleUser(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.isActive ? "Activo" : "Inactivo"}</button></div>) : <p className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">Aún no hay usuarios creados.</p>}</div></div><form onSubmit={addUser} className="rounded-md border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">Nuevo usuario</h3><div className="mt-4 space-y-3"><input required value={userForm.name} onChange={(e) => setUserForm({...userForm,name:e.target.value})} placeholder="Nombre completo" className="w-full rounded-md border bg-white px-3 py-2"/><input required value={userForm.username} onChange={(e) => setUserForm({...userForm,username:e.target.value})} placeholder="Usuario" className="w-full rounded-md border bg-white px-3 py-2"/><input required type="password" minLength={4} value={userForm.pin} onChange={(e) => setUserForm({...userForm,pin:e.target.value})} placeholder="Clave o PIN" className="w-full rounded-md border bg-white px-3 py-2"/><select value={userForm.role} onChange={(e) => setUserForm({...userForm,role:e.target.value})} className="w-full rounded-md border bg-white px-3 py-2"><option value="cashier">Cajero</option><option value="supervisor">Supervisor</option></select></div><button disabled={busy} className="mt-4 w-full rounded-md bg-blue-600 py-2 font-semibold text-white">Crear usuario</button></form></div>}
      {tab === "settings" && <div className="rounded-md border border-dashed border-slate-300 px-6 py-12 text-center"><Settings className="mx-auto mb-3 h-8 w-8 text-slate-400"/><h3 className="font-semibold text-slate-900">Configuración del punto de venta</h3><p className="mt-1 text-sm text-slate-500">Aquí se incorporarán próximamente preferencias de operación, comprobantes y cierres.</p></div>}
    </div>
  </div>;
}
