"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Database, Pause, Play, RefreshCw } from "lucide-react";
import {
  inventoryRequest as request,
  inventoryButton as button,
  inventoryPrimary as primary,
} from "@/lib/inventory";

export default function InventoryAdmin() {
  const [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const load = useCallback(() => request("admin/status").then(setData), []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const timer = setInterval(
      () => load().catch((e) => setError(e.message)),
      20000,
    );
    return () => clearInterval(timer);
  }, [load]);
  async function action(path: string, values: any) {
    setBusy(true);
    setError("");
    try {
      await request(`admin/${path}`, "POST", values);
      await load();
      setConfirm(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <ClipboardList className="text-cyan-700" />
        Inventario físico
      </h1>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {!data ? (
        <p>Cargando estado...</p>
      ) : (
        <>
          <section className="space-y-3 border-y border-slate-200 py-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Database size={18} />
              Base de datos
            </h2>
            <p className="text-sm text-slate-600">
              {data.ready
                ? "Módulo preparado. Las tiendas pueden iniciar conteos."
                : "El módulo necesita preparar sus tablas antes de iniciar conteos."}
            </p>
            {!data.ready && (
              <button
                className={primary}
                disabled={busy}
                onClick={() => setConfirm(true)}
              >
                Preparar módulo
              </button>
            )}
          </section>
          {data.ready && (
            <section className="space-y-4">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Reconocimiento de portadas</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => action("index", { enabled: !data.enabled })}
                  >
                    {data.enabled ? <Pause size={16} /> : <Play size={16} />}
                    {data.enabled ? "Pausar indexación" : "Iniciar indexación"}
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      action("index", { enabled: true, retry: true })
                    }
                  >
                    <RefreshCw size={16} />
                    Reintentar fallidas
                  </button>
                </div>
              </header>
              <p className="text-sm text-slate-500">
                {data.enabled ? "Indexación activa" : "Indexación pausada"} ·{" "}
                {data.model}
              </p>
              <dl className="grid grid-cols-2 gap-px border border-slate-200 bg-slate-200 sm:grid-cols-4">
                {[
                  ["ready", "Preparadas"],
                  ["pending", "Pendientes"],
                  ["processing", "Procesando"],
                  ["failed", "Fallidas"],
                ].map(([key, label]) => (
                  <div key={key} className="bg-white p-4">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {data.counts?.[key] || 0}
                    </dd>
                  </div>
                ))}
              </dl>
              {data.lastError && (
                <p role="alert" className="text-sm text-red-700">
                  {data.lastError}
                </p>
              )}
              {data.failures?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Producto</th>
                        <th className="p-2">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.failures.map((item: any) => (
                        <tr key={item.productId} className="border-t">
                          <td className="p-2">
                            <a
                              className="text-cyan-700 underline"
                              href={`/panel/products/${item.productId}/edit`}
                            >
                              {item.productId}
                            </a>
                          </td>
                          <td className="p-2">{item.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
      {confirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Preparar inventario"
            className="w-full max-w-lg rounded-lg bg-white p-5"
          >
            <h2 className="font-semibold">Preparar módulo de inventario</h2>
            <p className="my-4 text-sm text-slate-600">
              Se crearán únicamente las tablas del inventario. No se modificarán
              productos, ventas ni stock existentes. La indexación de imágenes
              se activa por separado.
            </p>
            {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                className={button}
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Cancelar
              </button>
              <button
                className={primary}
                disabled={busy}
                onClick={() => action("setup", {})}
              >
                {busy ? "Preparando..." : "Confirmar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
