"use client";

import { useEffect, use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export default function StoreAdminLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Validando acceso a la tienda...");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setError("Falta el token de acceso.");
      return;
    }

    const consumeToken = async () => {
      try {
        await api.consumeStoreSsoToken(token, slug);
        setMessage("Acceso validado. Abriendo tienda...");
        window.location.replace("/");
      } catch (err: any) {
        setError(err?.message || "No se pudo validar el acceso.");
      }
    };

    consumeToken();
  }, [router, searchParams, slug]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg bg-white border border-gray-200 shadow-sm p-6 text-center">
        {!error && <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />}
        <h1 className="text-xl font-bold text-gray-900">Acceso administrativo</h1>
        <p className="mt-2 text-sm text-gray-600">{error || message}</p>
        {error && (
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Volver a la tienda
          </button>
        )}
      </div>
    </main>
  );
}