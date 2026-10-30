"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PanelPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir directamente a orders
    router.push("/panel/orders");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redireccionando...</p>
      </div>
    </div>
  );
}
