"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { request, send } from "@/lib/estate-api";
import { Notice } from "./EstateApp";
export function DemoAdmin() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState("draft");
  useEffect(() => {
    request("/admin/examples")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  async function install() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await send("/admin/examples", { mode });
      setData(r);
      setSuccess(
        `${r.created} ejemplos creados. ${r.existing} ya existían y se conservaron. Puedes revisarlos en Propiedades.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">PRUEBA TU MARKETPLACE</span>
      <h1>Propiedades de ejemplo</h1>
      <p>
        Instala 20 publicaciones ficticias, cada una con tres imágenes
        ilustrativas, precio en UF, ubicación y características. No son ofertas
        reales y no reciben consultas ni visitas.
      </p>
      <Notice error={error} success={success} />
      <section className="panel-card demo-admin">
        <h2>Instalar el catálogo de muestra</h2>
        <p>
          Los ejemplos se guardan en la base actual de Propiedades con su propio
          perfil. No necesitas ejecutar SQL ni configurar un servicio de
          imágenes.
        </p>
        <label>
          Estado inicial
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={busy}
          >
            <option value="draft">Borradores para revisar primero</option>
            <option value="published">Publicados para probar Descubrir</option>
          </select>
        </label>
        <p>
          Si vuelves a instalar, se agregan únicamente los ejemplos que falten.
          Las publicaciones existentes conservan sus cambios y su estado.
        </p>
        <button
          type="button"
          className="button"
          disabled={busy || !data}
          onClick={() => void install()}
        >
          {busy ? "Procesando ejemplos…" : "Instalar 20 ejemplos"}
        </button>
        {data && (
          <p role="status">
            {data.total} de 20 ejemplos instalados · {data.published} publicados
          </p>
        )}
      </section>
      <section className="panel-card">
        <h2>Revisar el resultado</h2>
        <div className="design-actions">
          <button
            type="button"
            className="button"
            disabled={busy || !data?.total || data.total === data.published}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setData(await send("/admin/examples/publish", {}, "PATCH"));
                setSuccess(
                  "Los ejemplos en borrador o pausados ya están publicados.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Publicar ejemplos pendientes
          </button>
          <Link className="button" href="/descubrir">
            Abrir recorrido vertical
          </Link>
          <Link className="button outline" href="/panel/propiedades">
            Administrar propiedades
          </Link>
          <button
            type="button"
            className="button outline"
            disabled={busy || !data?.published}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setData(await send("/admin/examples/pause", {}, "PATCH"));
                setSuccess(
                  "Los ejemplos publicados quedaron pausados. Puedes volver a publicarlos desde Propiedades.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Despublicar solo los ejemplos
          </button>
        </div>
        <p>
          Puedes pausar los ejemplos sin borrarlos ni afectar tus publicaciones
          reales.
        </p>
      </section>
    </>
  );
}
