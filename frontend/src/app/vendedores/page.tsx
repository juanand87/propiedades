import Link from "next/link";
import { ArrowRight, BadgeDollarSign, BarChart3, Boxes, CircleDollarSign, Globe2, LayoutDashboard, MapPinned, MessagesSquare, PackageCheck, Store, Truck } from "lucide-react";
import { FeatureGrid, PortalCta, PortalHero, SectionHeading, VisualFeature } from "@/components/vendor-portal/VendorPortalUI";
import { portalVisuals } from "@/components/vendor-portal/portal-content";

const features = [
  { icon: Store, title: "Tu tienda, tu identidad", description: "Configura logo, colores, páginas, dominio y catálogo con una vitrina adaptada a tu negocio musical.", accent: "bg-cyan-50 text-cyan-700" },
  { icon: Boxes, title: "Catálogo inteligente", description: "Carga productos con información musical, fotografías, stock, condiciones y clasificación Goldmine.", accent: "bg-violet-50 text-violet-700" },
  { icon: Globe2, title: "Más canales de venta", description: "Administra MundoBeat y conecta los canales disponibles sin perder el control del inventario.", accent: "bg-blue-50 text-blue-700" },
  { icon: Truck, title: "Envíos centralizados", description: "Cotiza, genera etiquetas, consulta seguimientos o registra un transporte externo cuando sea necesario.", accent: "bg-orange-50 text-orange-700" },
  { icon: CircleDollarSign, title: "Pagos claros", description: "Revisa cada venta, comisión, monto por recibir, liquidación y documento desde tu estado de cuenta.", accent: "bg-emerald-50 text-emerald-700" },
  { icon: BarChart3, title: "Operación visible", description: "Consulta pedidos, canales, productos destacados, alertas y resultados desde un panel de trabajo.", accent: "bg-rose-50 text-rose-700" },
];

const portalBenefits = [
  {
    title: "Sin costo de entrada",
    text: "Comienza sin una inversión inicial.",
    icon: BadgeDollarSign,
  },
  {
    title: "Operación centralizada",
    text: "Catálogo, pedidos y stock en un panel.",
    icon: LayoutDashboard,
  },
  {
    title: "Cobertura nacional",
    text: "Vende y despacha a compradores de todo Chile.",
    icon: MapPinned,
  },
];

export default function VendorsPortalHome() {
  return (
    <>
      <PortalHero eyebrow="Portal de Vendedores" title="Impulsa tu tienda de música y gestiona tus ventas como un profesional." titleClassName="text-4xl sm:text-5xl lg:text-6xl" description="Crea tu tienda, publica tu catálogo y administra pedidos, stock, pagos y envíos desde MundoBeat." image={portalVisuals.hero}>
        <Link href="/vendedores/herramientas" className="inline-flex h-12 items-center gap-2 border border-white/40 bg-black/20 px-6 font-bold text-white hover:bg-black/40">Conocer las herramientas <ArrowRight className="h-4 w-4" /></Link>
      </PortalHero>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {portalBenefits.map((benefit) => (
            <article key={benefit.title} className="flex items-center gap-4 px-6 py-6 sm:px-7">
              <span className="grid h-12 w-12 shrink-0 place-items-center border border-cyan-200 bg-cyan-50 text-cyan-700" aria-hidden="true">
                <benefit.icon className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="font-bold text-slate-950">{benefit.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{benefit.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Una sola operación" title="Todo lo que necesitas para vender música física." description="Las herramientas de MundoBeat acompañan el proceso completo: desde publicar el primer producto hasta revisar la liquidación de una venta." />
          <div className="mt-10"><FeatureGrid items={features} /></div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl"><VisualFeature image={portalVisuals.catalog} alt="Carga de productos en MundoBeat" eyebrow="Catálogo" title="Menos tiempo escribiendo fichas. Más tiempo vendiendo." description="Registra tus productos con información musical completa y mantén el inventario listo para todos tus canales." bullets={["Información de artista, álbum, año, sello y formato", "Estado del producto con escala Goldmine", "Stock, precio, imágenes y categorías en una sola ficha"]} /></div>
      </section>

      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading eyebrow="Cómo comenzar" title="De la solicitud a tu primera venta." align="center" />
          <div className="mt-12 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 md:grid-cols-4">
            {[['01', 'Solicita tu cuenta', 'Completa los datos de tu negocio, formatos, logo y ubicación.'], ['02', 'Revisión', 'El equipo de MundoBeat revisa la solicitud y crea el acceso.'], ['03', 'Configura tu tienda', 'Ajusta diseño, catálogo, envíos, pagos e integraciones.'], ['04', 'Comienza a vender', 'Publica productos y administra cada venta desde el dashboard.']].map(([number, title, text]) => <article key={number} className="bg-white p-6"><span className="font-mono text-sm font-bold text-cyan-700">{number}</span><h3 className="mt-8 font-bold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bg-[#dff7f5] px-6 py-16 lg:px-8"><div className="mx-auto grid max-w-7xl items-center gap-8 md:grid-cols-[1fr_auto]"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-800">Atención al comprador</p><h2 className="mt-3 text-3xl font-black">Preguntas, pedidos y calificaciones en contexto.</h2><p className="mt-3 max-w-2xl text-slate-700">Responde consultas, acompaña cada despacho y construye reputación con experiencias verificadas.</p></div><div className="flex gap-3 text-teal-900"><MessagesSquare className="h-10 w-10" /><PackageCheck className="h-10 w-10" /></div></div></section>

      <PortalCta title="Tu próxima vitrina puede estar en MundoBeat." description="Solicita una cuenta de vendedor y configura una tienda preparada para crecer contigo." />
    </>
  );
}
