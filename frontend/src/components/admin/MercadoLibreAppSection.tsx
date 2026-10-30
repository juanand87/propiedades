"use client";

import { useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function MercadoLibreAppSection() {
  const [form, setForm] = useState({ clientId: "", clientSecret: "", redirectUri: "http://localhost:3001/api/mercadolibre/callback" });
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/mercadolibre/admin/configuration`, { headers: { Authorization: `Bearer ${api.getToken()}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "No se pudo cargar la configuración");
        setForm((current) => ({ ...current, clientId: data.clientId || "", redirectUri: data.redirectUri || current.redirectUri }));
        setSecretConfigured(data.secretConfigured);
      })
      .catch((error) => setMessage(error.message));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch(`${API_URL}/mercadolibre/admin/configuration`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}` }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo guardar la configuración");
      setSecretConfigured(data.secretConfigured); setForm((current) => ({ ...current, clientSecret: "" })); setMessage("Configuración guardada correctamente.");
    } catch (error: any) { setMessage(error.message); } finally { setSaving(false); }
  };

  return <Card><CardHeader><CardTitle>Mercado Libre</CardTitle><CardDescription>Credenciales globales para que las tiendas conecten sus cuentas. El Secret Key no se vuelve a mostrar.</CardDescription></CardHeader><CardContent><form onSubmit={save} className="space-y-4 max-w-xl">
    <div><label className="text-sm font-medium">Client ID</label><Input required value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} /></div>
    <div><label className="text-sm font-medium">Secret Key</label><Input type="password" placeholder={secretConfigured ? "Configurado (deja vacío para conservarlo)" : "Ingresa el Secret Key"} value={form.clientSecret} onChange={(event) => setForm({ ...form, clientSecret: event.target.value })} required={!secretConfigured} /></div>
    <div><label className="text-sm font-medium">Redirect URI</label><Input required type="url" value={form.redirectUri} onChange={(event) => setForm({ ...form, redirectUri: event.target.value })} /></div>
    <p className="text-sm text-gray-500">Callback de notificaciones: http://localhost:3001/api/mercadolibre/notifications</p>
    <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</Button>{message && <p className="text-sm text-gray-700">{message}</p>}
  </form></CardContent></Card>;
}
