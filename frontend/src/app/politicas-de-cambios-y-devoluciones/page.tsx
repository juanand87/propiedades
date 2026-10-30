import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ReturnsPolicyContent from '@/components/policies/ReturnsPolicyContent';
import { getSiteUrl } from '@/lib/siteUrl';

const url = `${getSiteUrl()}/politicas-de-cambios-y-devoluciones`;
export const metadata: Metadata = {
  title: 'Politicas de cambios y devoluciones',
  description: 'Conoce el retracto, la garantia legal, los costos y el proceso de devolucion para compras en MundoBeat.',
  alternates: { canonical: url },
  robots: { index: true, follow: true },
  openGraph: { title: 'Cambios y devoluciones | MundoBeat', url, type: 'website' },
};

export default function MarketplaceReturnsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-700">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="text-2xl font-bold text-sky-700">MundoBeat</Link>
          <Link href="/mis-pedidos" className="text-sm font-semibold text-sky-700 hover:underline">Mis compras</Link>
        </div>
      </header>
      <main>
        <section className="relative border-b border-slate-200">
          <img src="/images/returns-policy-hero.webp" alt="Producto y embalaje para una devolución" className="absolute inset-0 h-full w-full object-cover object-right" />
          <div className="absolute inset-0 bg-white/80" />
          <div className="relative mx-auto max-w-6xl px-5 py-10 sm:py-14">
            <div className="max-w-lg">
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-sky-700 hover:underline"><ArrowLeft size={16} /> Volver a MundoBeat</Link>
              <h1 className="mt-5 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">Políticas de cambios y devoluciones</h1>
              <p className="mt-4 leading-7">Información para compras realizadas en el marketplace MundoBeat.</p>
            </div>
          </div>
        </section>
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
          <section className="mb-10 space-y-4 border-b border-slate-200 pb-8 leading-7">
            <h2 className="text-2xl font-bold text-slate-900">Cómo gestionar tu devolución</h2>
            <p>Identifica la tienda vendedora en el detalle de tu pedido y comunícale tu solicitud, indicando el número de orden y el producto. Coordina con ella la dirección y el transporte antes de enviar el paquete; no lo envíes a una dirección general de MundoBeat.</p>
            <p>La tienda coordina la recepción del producto y la solución correspondiente. Si necesitas apoyo para contactar al vendedor o resolver una incidencia, puedes comunicarte con MundoBeat desde nuestra <Link href="/pagina/contacto" className="font-semibold text-sky-700 underline">página de contacto</Link>. Este procedimiento no limita los derechos que te reconoce la ley.</p>
            <p>El costo de devolución depende del motivo, según se indica a continuación. El reintegro se coordinará según el medio de pago utilizado, informando su estado y sin sustituirlo por un cupón sin tu consentimiento.</p>
          </section>
          <ReturnsPolicyContent storeName="MundoBeat" additionalConditions="Cada tienda puede ofrecer beneficios adicionales informados antes de la compra. Estas condiciones no pueden reducir los derechos legales del comprador. Para discos usados, revisa la condición del disco y de la portada publicada en la ficha; puedes reclamar si lo recibido no corresponde a lo anunciado." />
          <p className="mt-10 border-t border-slate-200 pt-6 text-sm leading-6">Fuentes: <a href="https://www.sernac.cl/portal/618/w3-propertyvalue-8062.html" className="text-sky-700 underline">garantía legal y retracto (SERNAC)</a> y <a href="https://www.sernac.cl/portal/617/w3-article-57428.html" className="text-sky-700 underline">productos usados (SERNAC)</a>.</p>
        </div>
      </main>
    </div>
  );
}
