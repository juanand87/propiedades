"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function WooCommerceIntegrationRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/settings?section=integraciones&subsection=woocommerce");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Abriendo la integración con WooCommerce...
    </div>
  );
}
