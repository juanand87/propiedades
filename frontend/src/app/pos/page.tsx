"use client";

import { useEffect, useState } from "react";
import PosSessionGate from "@/components/pos/PosSessionGate";
import { PosWorkspace } from "@/app/dashboard/pos/page";
import { API_URL } from "@/lib/api";

export default function PublicPosPage() {
  const [store, setStore] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase().replace(/^www\./, "");
    const queryStore = new URLSearchParams(window.location.search).get("tienda");
    const isSubdomain = hostname.endsWith(".mundobeat.cl") && hostname !== "mundobeat.cl";
    const key = queryStore || (isSubdomain ? hostname.replace(".mundobeat.cl", "") : hostname);
    if (!queryStore && ["localhost", "127.0.0.1", "mundobeat.cl"].includes(hostname)) {
      setError("Abre el punto de venta desde el subdominio de una tienda.");
      return;
    }
    const endpoint = isSubdomain || queryStore
      ? `${API_URL}/vendors/slug/${encodeURIComponent(key)}`
      : `${API_URL}/vendors/domain/${encodeURIComponent(key)}`;
    fetch(endpoint).then(async (response) => {
      if (!response.ok) throw new Error("Tienda no encontrada");
      const vendor = await response.json();
      setStore({ key: isSubdomain || queryStore ? vendor.slug : hostname, id: vendor.id, name: vendor.storeName, slug: vendor.slug, logo: vendor.settings?.headerConfig?.logo || vendor.logo });
    }).catch((reason) => setError(reason.message || "No fue posible cargar la tienda"));
  }, []);

  if (error) return <div className="grid min-h-screen place-items-center bg-slate-100 p-6"><div className="max-w-md rounded-lg border bg-white p-6 text-center"><h1 className="text-xl font-bold">Punto de venta no disponible</h1><p className="mt-2 text-sm text-slate-600">{error}</p></div></div>;
  if (!store) return <div className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">Cargando punto de venta...</div>;
  return <PosSessionGate publicStore={store}>{(pos) => <PosWorkspace pos={pos} />}</PosSessionGate>;
}
