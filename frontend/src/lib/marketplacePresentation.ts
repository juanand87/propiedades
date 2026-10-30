export interface PresentationSection {
  id: string;
  phase: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  imageUrl: string;
  imageAlt: string;
}

export interface MarketplacePresentationConfig {
  badge: string;
  title: string;
  subtitle: string;
  heroImageUrl: string;
  heroImageAlt: string;
  ctaText: string;
  ctaLink: string;
  sections: PresentationSection[];
}

export const PRESENTATION_SLUG = "presentacion-marketplace";

export const defaultMarketplacePresentation: MarketplacePresentationConfig = {
  badge: "MundoBeat para tiendas de música",
  title: "Todo el proceso de venta, en un solo lugar.",
  subtitle:
    "Publica tu catálogo, recibe pedidos y prepara cada despacho con herramientas creadas para tiendas de música.",
  heroImageUrl: "",
  heroImageAlt: "Vista general del marketplace MundoBeat",
  ctaText: "Quiero vender en MundoBeat",
  ctaLink: "/registro-vendedor",
  sections: [
    {
      id: "catalogo",
      phase: "01 · Publicación",
      eyebrow: "CATÁLOGO",
      title: "Carga productos con información completa.",
      description:
        "La tienda define precio, stock y condición. MundoBeat ayuda a completar la ficha para reducir el trabajo manual y mantener un catálogo útil para el comprador.",
      bullets: [
        "Búsqueda por código de barras o número de catálogo.",
        "Importación de artista, título, sello, año, país, formato y canciones.",
        "Carga manual disponible cuando el lanzamiento no está en el catálogo.",
        "Condición separada para soporte y carátula.",
        "Control de precio, stock, estado e imágenes del producto.",
      ],
      imageUrl: "",
      imageAlt: "Demostración de la carga inteligente de productos",
    },
    {
      id: "ficha",
      phase: "01 · Publicación",
      eyebrow: "FICHA DE PRODUCTO",
      title: "Cada edición se presenta con el detalle que importa.",
      description:
        "La ficha reúne la información comercial y musical para que el comprador pueda decidir con confianza sin abandonar la página.",
      bullets: [
        "Galería de imágenes y descripción del artículo.",
        "Tracklist, especificaciones técnicas y reproductor de Spotify.",
        "Clasificación por formato, género, artista, sello, año y país.",
        "Disponibilidad y condición visibles antes de comprar.",
      ],
      imageUrl: "",
      imageAlt: "Ficha de producto publicada en MundoBeat",
    },
    {
      id: "tienda",
      phase: "01 · Publicación",
      eyebrow: "TU TIENDA",
      title: "Tu marca conserva su identidad.",
      description:
        "Cada vendedor dispone de una tienda propia dentro de MundoBeat, además de participar en el catálogo general del marketplace.",
      bullets: [
        "Logo, colores, portada, descripción y redes sociales.",
        "Menús, banners y páginas informativas configurables.",
        "Catálogo propio con búsqueda y navegación por categorías.",
        "Productos visibles tanto en la tienda como en el marketplace.",
      ],
      imageUrl: "",
      imageAlt: "Ejemplo de una tienda personalizada en MundoBeat",
    },
    {
      id: "descubrimiento",
      phase: "02 · Venta",
      eyebrow: "DESCUBRIMIENTO",
      title: "El comprador encuentra exactamente lo que busca.",
      description:
        "El catálogo está preparado para explorar lanzamientos, comparar alternativas y resolver dudas antes de agregar un producto al carrito.",
      bullets: [
        "Búsqueda por álbum, artista y formato.",
        "Filtros por género, condición, precio y características del soporte.",
        "Favoritos, productos recomendados y preguntas al vendedor.",
        "Información de la tienda y opciones de entrega visibles.",
      ],
      imageUrl: "",
      imageAlt: "Navegación y filtros del catálogo MundoBeat",
    },
    {
      id: "checkout",
      phase: "02 · Venta",
      eyebrow: "COMPRA",
      title: "El pedido se completa en línea y con stock validado.",
      description:
        "MundoBeat coordina el carrito, el pago y la disponibilidad para convertir la intención de compra en un pedido listo para preparar.",
      bullets: [
        "Carrito con validación de precio, cantidad y stock.",
        "Cotización de envío según dirección y servicios habilitados.",
        "Pago en línea y confirmación automática del pedido.",
        "Actualización de inventario e historial de compra.",
      ],
      imageUrl: "",
      imageAlt: "Proceso de compra y pago en MundoBeat",
    },
    {
      id: "pedido",
      phase: "03 · Preparación",
      eyebrow: "GESTIÓN DEL PEDIDO",
      title: "Toda la información para preparar sin errores.",
      description:
        "La tienda recibe el pedido en su panel con los datos del comprador, los productos, el pago y la dirección de entrega.",
      bullets: [
        "Detalle de productos, cantidades y condición de la venta.",
        "Datos de contacto, dirección e indicaciones de entrega.",
        "Resumen financiero e historial de cambios del pedido.",
        "Seguimiento del estado desde la confirmación hasta la entrega.",
      ],
      imageUrl: "",
      imageAlt: "Panel de gestión de pedidos de MundoBeat",
    },
    {
      id: "envio",
      phase: "03 · Preparación",
      eyebrow: "ENVÍOS",
      title: "Cotiza, elige el courier y genera la etiqueta.",
      description:
        "La integración con Envia.com permite comparar los servicios habilitados por la tienda y administrar el despacho desde el mismo pedido.",
      bullets: [
        "Cotización de couriers según origen, destino y paquete.",
        "Cambio de transportista antes de generar la etiqueta.",
        "Etiqueta, número de guía y enlace de seguimiento centralizados.",
        "Actualización del estado de envío hasta marcarlo como entregado.",
      ],
      imageUrl: "",
      imageAlt: "Cotización y generación de etiqueta de envío",
    },
    {
      id: "integraciones",
      phase: "Canales conectados",
      eyebrow: "INTEGRACIONES",
      title: "El catálogo puede acompañar a la tienda en otros canales.",
      description:
        "MundoBeat centraliza la operación y permite conectar canales externos para evitar configuraciones y tareas repetidas.",
      bullets: [
        "WooCommerce: sincronización de productos, stock, pedidos y envíos.",
        "Mercado Libre: publicaciones, inventario, ventas y preguntas.",
        "Control desde el panel de la tienda con trazabilidad por canal.",
        "Una base operativa preparada para sumar nuevas integraciones.",
      ],
      imageUrl: "",
      imageAlt: "Integraciones de MundoBeat con otros canales de venta",
    },
    {
      id: "estados-pago",
      phase: "Control financiero",
      eyebrow: "ESTADOS DE PAGO",
      title: "Cada pago mantiene un estado claro y trazable.",
      description:
        "La tienda puede reconocer rápidamente qué pedidos esperan pago, cuáles fueron aprobados y cuáles requieren revisión antes de continuar la preparación.",
      bullets: [
        "Estados de pago visibles desde el detalle de cada pedido.",
        "Registro del medio de pago y las confirmaciones recibidas.",
        "Separación entre el estado financiero, el pedido y el envío.",
        "Historial para revisar cambios y resolver diferencias.",
      ],
      imageUrl: "",
      imageAlt: "Estados de pago y resumen financiero de un pedido",
    },
    {
      id: "estadisticas",
      phase: "Gestión comercial",
      eyebrow: "ESTADÍSTICAS",
      title: "Los resultados de la tienda, convertidos en decisiones.",
      description:
        "El panel resume el desempeño comercial para identificar productos, períodos y tendencias que ayudan a gestionar mejor el catálogo.",
      bullets: [
        "Ventas e ingresos por período.",
        "Productos con mayor movimiento y rendimiento del catálogo.",
        "Evolución de pedidos y ticket promedio.",
        "Información centralizada para planificar stock y promociones.",
      ],
      imageUrl: "",
      imageAlt: "Panel de estadísticas y rendimiento comercial",
    },
    {
      id: "preguntas",
      phase: "Atención al comprador",
      eyebrow: "PREGUNTAS",
      title: "Las consultas llegan a una bandeja centralizada.",
      description:
        "La tienda responde dudas sobre productos y publicaciones desde el panel, manteniendo el contexto de cada conversación.",
      bullets: [
        "Preguntas asociadas al producto correspondiente.",
        "Respuestas del vendedor desde una única bandeja.",
        "Integración de consultas provenientes de Mercado Libre.",
        "Historial visible para dar respuestas consistentes.",
      ],
      imageUrl: "",
      imageAlt: "Bandeja de preguntas de compradores",
    },
    {
      id: "punto-venta",
      phase: "Venta presencial",
      eyebrow: "PUNTO DE VENTA",
      title: "El mismo inventario también acompaña la venta en tienda.",
      description:
        "El punto de venta permite registrar operaciones presenciales sin separar el control de productos y existencias del canal en línea.",
      bullets: [
        "Búsqueda rápida de productos disponibles.",
        "Armado de la venta y cálculo del total desde el panel.",
        "Registro de la operación presencial.",
        "Actualización del stock compartido con los canales conectados.",
      ],
      imageUrl: "",
      imageAlt: "Punto de venta para operaciones presenciales",
    },
  ],
};

export function parseMarketplacePresentation(value?: string): MarketplacePresentationConfig {
  if (!value) return defaultMarketplacePresentation;

  try {
    const parsed = JSON.parse(value) as Partial<MarketplacePresentationConfig>;
    const savedSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const mergedDefaultSections = defaultMarketplacePresentation.sections.map((defaultSection) => {
      const savedSection = savedSections.find((section) => section.id === defaultSection.id);
      return savedSection
        ? {
            ...defaultSection,
            ...savedSection,
            bullets: Array.isArray(savedSection.bullets) ? savedSection.bullets : defaultSection.bullets,
          }
        : defaultSection;
    });
    const customSections = savedSections.filter(
      (section) => !defaultMarketplacePresentation.sections.some((defaultSection) => defaultSection.id === section.id),
    );
    return {
      ...defaultMarketplacePresentation,
      ...parsed,
      sections: [...mergedDefaultSections, ...customSections],
    };
  } catch {
    return defaultMarketplacePresentation;
  }
}
