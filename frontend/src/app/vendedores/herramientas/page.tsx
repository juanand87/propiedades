import type { Metadata } from "next";
import { BarChart3, Boxes, FileText, Heart, LayoutDashboard, MessageCircleQuestion, ScanBarcode, ShoppingBag, Star, Store, UsersRound, WandSparkles } from "lucide-react";
import { FeatureGrid, PortalCta, PortalHero, SectionHeading, VisualFeature } from "@/components/vendor-portal/VendorPortalUI";
import { portalVisuals } from "@/components/vendor-portal/portal-content";

export const metadata: Metadata = { title: "Herramientas para vendedores", description: "Catálogo, pedidos, inventario, tienda, clientes y estadísticas para vendedores de MundoBeat." };

const tools = [
  { icon: LayoutDashboard, title: "Dashboard operativo", description: "Ventas, productos, alertas, canales y métricas importantes al iniciar la jornada." },
  { icon: Boxes, title: "Productos e inventario", description: "Crea, edita, activa, desactiva y controla existencias desde un catálogo central." },
  { icon: ScanBarcode, title: "Carga inteligente", description: "Acelera la ficha musical usando códigos y datos de catálogo disponibles." },
  { icon: ShoppingBag, title: "Gestión de pedidos", description: "Busca por cliente o producto y controla estado, pago, envío y documentación." },
  { icon: UsersRound, title: "Clientes", description: "Consulta datos de contacto e historial necesarios para atender cada compra." },
  { icon: MessageCircleQuestion, title: "Preguntas", description: "Responde consultas de MundoBeat y de integraciones compatibles desde una bandeja." },
  { icon: Star, title: "Calificaciones", description: "Solicita y consulta evaluaciones verificadas después de una entrega." },
  { icon: BarChart3, title: "Estadísticas", description: "Observa ingresos, ticket, unidades, productos y distribución de ventas por canal." },
  { icon: FileText, title: "Estado de cuenta", description: "Revisa montos, comisiones, liquidaciones y documentos asociados a tus ventas." },
  { icon: Store, title: "Editor de tienda", description: "Personaliza navegación, carrusel, banners, páginas, colores y presencia de marca." },
  { icon: Heart, title: "Favoritos y reputación", description: "Tu catálogo puede recibir favoritos y construir confianza con la experiencia de compra." },
  { icon: WandSparkles, title: "Asistencia de contenido", description: "Apóyate en herramientas disponibles para descripciones e imágenes de producto." },
];

export default function VendorToolsPage() {
  return <><PortalHero eyebrow="Herramientas" title="Un panel pensado para la operación diaria." description="Administra catálogo, inventario, pedidos, clientes y resultados sin repartir el trabajo entre sistemas aislados." image={portalVisuals.arrivals} />
    <section className="px-6 py-20 lg:px-8"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow="Centro de trabajo" title="Cada tarea importante tiene su lugar." description="MundoBeat reúne las funciones que una tienda musical necesita para publicar, atender y despachar." /><div className="mt-10"><FeatureGrid items={tools} /></div></div></section>
    <section className="bg-white px-6 py-20 lg:px-8"><div className="mx-auto max-w-7xl space-y-24"><VisualFeature image={portalVisuals.store} alt="Configuración visual de una tienda MundoBeat" eyebrow="Tienda propia" title="Una vitrina con identidad propia." description="Presenta tu catálogo con logo, colores, navegación y contenidos configurados para tu negocio." bullets={["Carrusel principal y banners destacados", "Categorías, páginas y menús configurables", "Diseño adaptable para computadores y teléfonos"]} /><VisualFeature image={portalVisuals.catalog} alt="Carga inteligente de catálogo" eyebrow="Productos" title="Fichas musicales completas y ordenadas." description="Centraliza la información que el comprador necesita para decidir con confianza." bullets={["Datos musicales, imágenes y listado de canciones", "Formato, condición, precio y existencias", "Carga individual, importación y productos de ejemplo"]} reverse /></div></section>
    <PortalCta title="Haz que administrar la tienda sea parte fácil." description="Solicita tu cuenta y conoce el panel preparado para vendedores de música física." /></>;
}
