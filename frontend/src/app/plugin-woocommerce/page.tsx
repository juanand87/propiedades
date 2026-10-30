import Link from "next/link";
import { CheckCircle2, Download, Plug, RefreshCw, Settings } from "lucide-react";
import StorefrontAccountHeader from "@/components/StorefrontAccountHeader";

const steps = [
  "En WordPress abre Plugins y selecciona Añadir plugin.",
  "Presiona Subir plugin y elige el archivo descargado.",
  "Si WordPress detecta una versión anterior, selecciona Reemplazar la versión actual.",
  "Abre WooCommerce → MundoBeat para conectar o reparar la integración.",
];

export default function WooCommercePluginPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <StorefrontAccountHeader />

      <main>
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold text-cyan-700">Plugin oficial</p>
              <h1 className="text-3xl font-bold sm:text-4xl">MundoBeat para WooCommerce</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Conecta WooCommerce con MundoBeat sin crear manualmente claves REST ni webhooks.
                El instalador incluye la sincronización de productos, precios y stock.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href="/mundobeat-for-woocommerce.zip"
                  download
                  className="inline-flex min-h-11 items-center gap-2 bg-cyan-700 px-5 py-3 font-semibold text-white transition-colors hover:bg-cyan-800"
                >
                  <Download className="h-5 w-5" />
                  Descargar plugin 2.3.6
                </a>
                <span className="text-sm text-slate-500">Archivo ZIP para instalación directa</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <h2 className="text-2xl font-bold">Instalación o actualización</h2>
            <ol className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-4 py-5">
                  <span className="flex h-8 w-8 flex-none items-center justify-center bg-slate-900 text-sm font-bold text-white">{index + 1}</span>
                  <p className="pt-1 text-slate-700">{step}</p>
                </li>
              ))}
            </ol>

            <h2 className="mt-12 text-2xl font-bold">Qué configura automáticamente</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                [Plug, "API REST", "Credenciales de lectura y escritura para MundoBeat."],
                [RefreshCw, "Pedidos y stock", "Ventas pagadas, seguimiento y existencias sincronizadas."],
                [Settings, "Contenido", "Spotify, listado de canciones y especificaciones técnicas."],
                [CheckCircle2, "Envíos", "Tarifas MundoBeat disponibles en el checkout de WooCommerce."],
              ].map(([Icon, title, description]) => {
                const FeatureIcon = Icon as typeof Plug;
                return (
                  <div key={title as string} className="border border-slate-200 bg-white p-5">
                    <FeatureIcon className="h-5 w-5 text-cyan-700" />
                    <h3 className="mt-3 font-semibold">{title as string}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{description as string}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="h-fit border border-slate-200 bg-white p-6">
            <h2 className="font-semibold">Después de instalar</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Genera el código temporal desde la integración WooCommerce de tu dashboard y pégalo en el plugin.
            </p>
            <Link
              href="/dashboard/settings?section=integraciones&subsection=woocommerce"
              className="mt-5 inline-flex items-center font-semibold text-cyan-700 hover:text-cyan-900"
            >
              Abrir integración WooCommerce
            </Link>
            <p className="mt-6 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
              Requiere WordPress 5.8+, PHP 7.4+ y WooCommerce 5.0+.
            </p>
          </aside>
        </section>
      </main>
    </div>
  );
}
