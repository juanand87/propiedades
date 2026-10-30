"use client";

const steps = [
  {
    number: "01",
    icon: "🔍",
    title: "Explora el catálogo",
    description:
      "Navega por nuestro catálogo de vinilos, CDs, cassettes y más. Usa los filtros por género, formato, condición y precio para encontrar exactamente lo que buscas.",
    color: "from-purple-500 to-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  {
    number: "02",
    icon: "🛒",
    title: "Agrega al carrito",
    description:
      "Cuando encuentres un producto que te interese, revisa la descripción, condición y fotos. Luego haz clic en \"Agregar al carrito\".",
    color: "from-blue-500 to-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    number: "03",
    icon: "📋",
    title: "Revisa tu pedido",
    description:
      "En el carrito puedes ver todos tus productos, ajustar cantidades y ver el total. Asegúrate de que todo esté correcto antes de continuar.",
    color: "from-cyan-500 to-cyan-700",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
  },
  {
    number: "04",
    icon: "📦",
    title: "Elige el envío",
    description:
      "Ingresa tu dirección y selecciona el método de envío que prefieras. Calculamos el costo de despacho según tu ubicación.",
    color: "from-green-500 to-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  {
    number: "05",
    icon: "💳",
    title: "Realiza el pago",
    description:
      "Paga de forma segura con tarjeta de crédito, débito, transferencia bancaria u otros medios disponibles. Tu información está protegida.",
    color: "from-yellow-500 to-amber-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
  },
  {
    number: "06",
    icon: "✅",
    title: "Confirma y recibe",
    description:
      "Recibirás un correo de confirmación con los detalles de tu compra. Luego te notificaremos cuando tu pedido esté en camino.",
    color: "from-rose-500 to-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
  },
];

const faqs = [
  {
    q: "¿Puedo comprar a distintas tiendas en un solo pedido?",
    a: "Sí, Mundo Beat es un marketplace con múltiples tiendas. Puedes agregar productos de distintos vendedores al carrito. Cada tienda gestionará su parte del despacho.",
  },
  {
    q: "¿Cómo sé la condición real del producto?",
    a: "Cada vendedor describe la condición usando la escala Goldmine estándar (M, NM, VG+, VG, G+, G). Las fotos son referenciales pero idénticas al producto real. Una vez realizada la compra, puedes ponerte en contacto directamente con el vendedor si tienes alguna consulta.",
  },
  {
    q: "¿Qué hago si el producto llega en mal estado?",
    a: "Contáctate directamente con el vendedor a través del panel de tu pedido. Si no hay resolución, puedes escribirnos a soporte@mundobeat.cl y te ayudaremos a mediar.",
  },
  {
    q: "¿Cuánto demora el envío?",
    a: "Depende de la ubicación del vendedor y el método de envío elegido. En general, los envíos dentro de Chile tardan entre 2 y 5 días hábiles.",
  },
];

export default function HowToBuy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="text-5xl mb-4">🎵</div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          ¿Cómo comprar en Mundo Beat?
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          Comprar en Mundo Beat es simple y seguro. Sigue estos pasos para
          conseguir los discos que tanto buscas.
        </p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
        {steps.map((step) => (
          <div
            key={step.number}
            className={`rounded-2xl border p-6 ${step.bg} ${step.border} flex gap-4 items-start`}
          >
            {/* Number badge */}
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow`}
            >
              {step.number}
            </div>
            <div>
              <div className="text-2xl mb-1">{step.icon}</div>
              <h3 className="font-semibold text-gray-900 text-lg mb-1">
                {step.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 mb-12" />

      {/* FAQ */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Preguntas frecuentes
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
            >
              <p className="font-semibold text-gray-900 mb-2">❓ {faq.q}</p>
              <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 text-center bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white shadow-lg">
        <div className="text-4xl mb-3">🛍️</div>
        <h3 className="text-2xl font-bold mb-2">¿Listo para empezar?</h3>
        <p className="text-white/80 mb-6 text-sm">
          Explora miles de discos de vendedores verificados en todo Chile.
        </p>
        <a
          href="/catalogo"
          className="inline-block bg-white text-purple-700 font-bold px-8 py-3 rounded-full hover:bg-purple-50 transition-colors shadow"
        >
          Ver catálogo
        </a>
      </div>
    </div>
  );
}
