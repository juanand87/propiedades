"use client";

import { useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";

type Product = { id: string; title: string; stock: number; price: number; mercadoLibreItemId?: string };
type MusicCategory = { id: string; name: string; attributes: Array<{ id: string; name: string }> };

export default function MercadoLibreIntegrationPage() {
  const [connection, setConnection] = useState<{ connected: boolean; appConfigured: boolean; userId?: string }>({ connected: false, appConfigured: false });
  const [products, setProducts] = useState<Product[]>([]);
  const [musicCategory, setMusicCategory] = useState<MusicCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const request = async (path: string, options?: RequestInit) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.getToken()}`, ...options?.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "No se pudo completar la solicitud");
    return data;
  };

  useEffect(() => {
    Promise.all([request("/mercadolibre/connection"), api.getProducts({ limit: 100, includeOutOfStock: true })])
      .then(([connectionData, productData]) => {
        setConnection(connectionData);
        setProducts(productData.products || productData || []);
        if (connectionData.connected) request("/mercadolibre/default-music-category").then(setMusicCategory).catch((error) => setMessage(error.message));
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  const connect = async () => {
    try {
      const { authorizationUrl } = await request("/mercadolibre/authorize", { method: "POST" });
      window.location.assign(authorizationUrl);
    } catch (error: any) { setMessage(error.message); }
  };

  const publish = async (product: Product) => {
    setMessage("");
    try {
      const result = await request(`/mercadolibre/products/${product.id}/publish`, { method: "POST" });
      setMessage(`Publicación ${result.itemId} creada correctamente.`);
      setProducts((current) => current.map((currentProduct) => currentProduct.id === product.id ? { ...currentProduct, mercadoLibreItemId: result.itemId } : currentProduct));
    } catch (error: any) { setMessage(error.message); }
  };

  if (loading) return <p className="p-8 text-slate-600">Cargando integración…</p>;

  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Mercado Libre</h1>
      <p className="mt-1 text-slate-600">Publica productos de tu tienda y mantén su información sincronizada.</p>
    </div>
    {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">{message}</div>}
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Cuenta de vendedor</h2>
      {!connection.appConfigured ? <p className="mt-2 text-sm text-amber-700">El administrador debe registrar la aplicación y definir las variables de entorno de Mercado Libre antes de conectar una cuenta.</p>
        : connection.connected ? <p className="mt-2 text-sm text-emerald-700">Cuenta conectada (usuario {connection.userId}).</p>
        : <button onClick={connect} className="mt-3 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700">Conectar Mercado Libre</button>}
    </section>
    {connection.connected && <section className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Publicar en Música</h2>
      <p className="mt-1 text-sm text-slate-600">Todos los productos se publicarán en la categoría predeterminada Música de Mercado Libre Chile.</p>
      {musicCategory && <div className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900"><strong>Categoría:</strong> {musicCategory.name}. <strong>Campos requeridos:</strong> {musicCategory.attributes.length ? musicCategory.attributes.map((attribute) => attribute.name).join(", ") : "ninguno adicional"}.</div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {products.map((product) => <button key={product.id} onClick={() => publish(product)} className="rounded-lg border p-3 text-left hover:border-sky-500 hover:bg-sky-50">
          <div className="font-medium text-slate-900">{product.title}</div><div className="mt-1 text-sm text-slate-500">Stock: {product.stock} · ${product.price}{product.mercadoLibreItemId ? " · Publicado" : ""}</div>
        </button>)}
      </div>
    </section>}
  </main>;
}
