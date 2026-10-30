"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, X, Check, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import {
  inventoryRequest as request,
  inventoryStatuses,
  inventoryPrimary as primary,
  inventoryButton as button,
  inventoryInput as input,
} from "@/lib/inventory";

export default function InventoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [cancelSession, setCancelSession] = useState<any>(null);
  async function reviewSession(session: any) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (session.status === "counting")
        await request(`sessions/${session.id}/status`, "PATCH", {
          status: "review",
        });
      router.push(`/dashboard/inventario/${session.id}?review=1`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  async function cancelCount() {
    if (!cancelSession || busy) return;
    setBusy(true);
    setError("");
    try {
      await request(`sessions/${cancelSession.id}/status`, "PATCH", {
        status: "cancelled",
      });
      setSessions((current) =>
        current.map((session) =>
          session.id === cancelSession.id
            ? { ...session, status: "cancelled" }
            : session,
        ),
      );
      setCancelSession(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const [form, setForm] = useState({
    name: `Inventario ${new Date().toLocaleDateString("es-CL")}`,
    categoryId: "",
    genreId: "",
    type: "",
  });
  useEffect(() => {
    request("mine")
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    api
      .getMyVendor()
      .then(async (vendor) => {
        const data = await api.getVendorCategories(vendor.id);
        setCategories(Array.isArray(data) ? data : data.categories || []);
      })
      .catch(() => {});
    api
      .getGenres()
      .then((data) => setGenres(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
  }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await request("sessions", "POST", form);
      router.push(`/dashboard/inventario/${session.id}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ClipboardList className="h-6 w-6 text-cyan-700" />
          Revisión de inventario
        </h1>
        <button
          className={primary}
          disabled={loading || !!error}
          onClick={() => setOpen(true)}
        >
          <Plus size={18} />
          Nuevo conteo
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <div className="flex gap-3 border-b border-slate-200 pb-3">
        <select
          aria-label="Estado del conteo"
          className={`${input} max-w-56`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(inventoryStatuses).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <p>Cargando conteos...</p>
      ) : (
        <div className="overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {["Conteo", "Fecha", "Estado", "Acciones"].map((title, i) => (
                  <th
                    className={`p-3 font-medium ${i === 1 || i === 2 ? "hidden sm:table-cell" : ""}`}
                    key={i}
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions
                .filter((s) => !filter || s.status === filter)
                .map((s) => (
                  <tr key={s.id} className="border-t border-slate-200">
                    <td className="max-w-48 break-words p-3 align-top font-medium">
                      {s.name}
                      <div className="mt-1 text-xs font-normal text-slate-500 sm:hidden">
                        {inventoryStatuses[s.status]}
                        <br />
                        {new Date(s.createdAt).toLocaleDateString("es-CL")}
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap p-3 sm:table-cell">
                      {new Date(s.createdAt).toLocaleString("es-CL")}
                    </td>
                    <td className="hidden p-3 sm:table-cell">
                      {inventoryStatuses[s.status]}
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex flex-col items-start gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
                        <Link
                          className={`${button} min-h-11`}
                          href={`/dashboard/inventario/${s.id}`}
                        >
                          {["counting", "review"].includes(s.status)
                            ? "Continuar"
                            : "Ver resultado"}
                        </Link>
                        {["counting", "review"].includes(s.status) && (
                          <>
                            <button
                              className={`${primary} min-h-11`}
                              disabled={busy}
                              onClick={() => reviewSession(s)}
                            >
                              <Check size={16} />
                              Revisar ajustes
                            </button>
                            <button
                              className={`${button} min-h-11 text-red-700`}
                              disabled={busy}
                              onClick={() => {
                                setError("");
                                setCancelSession(s);
                              }}
                            >
                              <XCircle size={16} />
                              Cancelar conteo
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!sessions.length && (
            <p className="p-8 text-center text-sm text-slate-500">
              No hay conteos registrados.
            </p>
          )}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-inventory"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
          >
            <header className="mb-4 flex items-center justify-between">
              <h2 id="create-inventory" className="font-semibold">
                Nuevo conteo
              </h2>
              <button
                title="Cerrar"
                className={button}
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <form className="space-y-4" onSubmit={create}>
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <label className="block text-sm">
                Nombre
                <input
                  required
                  maxLength={150}
                  className={`${input} mt-1`}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                Categoría
                <select
                  className={`${input} mt-1`}
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Género
                <select
                  className={`${input} mt-1`}
                  value={form.genreId}
                  onChange={(e) =>
                    setForm({ ...form, genreId: e.target.value })
                  }
                >
                  <option value="">Todos</option>
                  {genres.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className={`${primary} w-full`} disabled={busy}>
                {busy ? "Preparando..." : "Iniciar conteo"}
              </button>
            </form>
          </section>
        </div>
      )}
      {cancelSession && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Cancelar conteo"
            className="w-full max-w-lg rounded-lg bg-white p-5"
          >
            <h2 className="font-semibold">Cancelar {cancelSession.name}</h2>
            <p className="my-4 text-sm text-slate-600">
              El conteo se cerrará sin aplicar ajustes al stock.
            </p>
            {error && (
              <p role="alert" className="mb-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                className={button}
                disabled={busy}
                onClick={() => setCancelSession(null)}
              >
                Volver
              </button>
              <button className={primary} disabled={busy} onClick={cancelCount}>
                {busy ? "Procesando..." : "Confirmar cancelación"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
