"use client";

const benefits = [
  {
    icon: "🌎",
    title: "Visibilidad Nacional",
    description:
      "Accede a una comunidad activa de compradores apasionados por la música en todo Chile.",
    color: "bg-purple-100 text-purple-700",
  },
  {
    icon: "🏪",
    title: "Tu Propia Tienda",
    description:
      "Personaliza tu espacio con tu marca, colores y estilo. Tu identidad, tu vitrina.",
    color: "bg-blue-100 text-blue-700",
  },
  {
    icon: "📊",
    title: "Gestión Integrada",
    description:
      "Panel completo para productos, pedidos, envíos e inventario, todo en un solo lugar.",
    color: "bg-cyan-100 text-cyan-700",
  },
  {
    icon: "💿",
    title: "Carga Inteligente",
    description:
      "Ingresa solo el número de serie o catálogo y nosotros importamos toda la información del disco automáticamente.",
    color: "bg-green-100 text-green-700",
  },
  {
    icon: "💳",
    title: "Pagos Seguros",
    description:
      "Integraciones con Payku y transferencias bancarias para que recibas tu dinero sin complicaciones.",
    color: "bg-yellow-100 text-yellow-700",
  },
  {
    icon: "🚚",
    title: "Envíos Facilitados",
    description:
      "Conexión directa con empresas de transporte, generación de etiquetas y retiro de encomiendas desde tu domicilio.",
    color: "bg-orange-100 text-orange-700",
  },
  {
    icon: "🆓",
    title: "Sin Costos Iniciales",
    description:
      "Comienza a vender sin inversión previa. Solo pagas comisión cuando realizas una venta.",
    color: "bg-rose-100 text-rose-700",
  },
];

const requirements = [
  "Ser mayor de 18 años o empresa legalmente constituida",
  "RUT personal o RUT de empresa",
  "Cuenta bancaria para recibir pagos",
  "Productos relacionados con música física (vinilos, CDs, cassettes, merchandising)",
  "Compromiso con entregas oportunas y servicio de calidad",
];

const steps = [
  {
    number: "01",
    title: "Solicitud",
    description: "Completa el formulario de registro con tus datos.",
    icon: "📝",
  },
  {
    number: "02",
    title: "Revisión",
    description: "Nuestro equipo revisará tu información en 1–3 días hábiles.",
    icon: "🔍",
  },
  {
    number: "03",
    title: "Acceso",
    description: "Recibirás tus credenciales de acceso por email.",
    icon: "📧",
  },
  {
    number: "04",
    title: "Configura",
    description:
      "Personaliza tu tienda y sube tus productos. Te damos soporte en cada paso.",
    icon: "🛠️",
  },
  {
    number: "05",
    title: "¡A vender!",
    description: "Tu tienda estará activa y lista para recibir pedidos.",
    icon: "🚀",
  },
];

const policies = [
  "Describir productos de forma honesta y precisa usando la escala Goldmine.",
  "Tiempos de despacho máximos de 2 días hábiles.",
  "Atención a clientes profesional y cordial.",
  "Cumplimiento de los términos y condiciones del marketplace.",
];

const support = [
  { icon: "🏗️", text: "Configuración inicial de tu tienda" },
  { icon: "📦", text: "Carga masiva de productos" },
  { icon: "🔧", text: "Resolución de problemas técnicos" },
  { icon: "📈", text: "Estrategias de venta" },
];

export default function SellWithUs() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-700 via-purple-600 to-blue-600 text-white text-center px-8 py-14 mb-14 shadow-xl">
        {/* decorative circles */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -right-10 w-52 h-52 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="text-5xl mb-4">🎵</div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">
            Únete al Marketplace de Música<br />Más Grande de Chile
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8">
            Mundo Beat conecta vendedores de música física con miles de
            coleccionistas y melómanos en todo Chile. Si tienes vinilos, CDs o
            merchandising musical, esta es tu oportunidad.
          </p>
          <a
            href="/registro-vendedor"
            className="inline-block bg-white text-purple-700 font-bold px-10 py-3 rounded-full hover:bg-purple-50 transition-colors shadow-lg text-base"
          >
            Quiero ser vendedor
          </a>
        </div>
      </div>

      {/* Benefits */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          ¿Por qué vender en Mundo Beat?
        </h2>
        <p className="text-gray-500 text-center mb-8 text-sm">
          Todo lo que necesitas para hacer crecer tu negocio musical.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 ${b.color}`}
              >
                {b.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{b.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {b.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Comisiones */}
      <section className="mb-14">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            💰 Comisiones y Pagos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="text-4xl font-extrabold text-green-600 mb-1">
                12%
              </div>
              <div className="text-gray-700 font-medium">Comisión por venta</div>
              <p className="text-gray-400 text-xs mt-1">
                Solo pagas cuando vendes
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="text-4xl font-extrabold text-blue-600 mb-1">
                📅
              </div>
              <div className="text-gray-700 font-medium">Pagos Semanales</div>
              <p className="text-gray-400 text-xs mt-1">
                Transferencia a tu cuenta bancaria
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="text-4xl font-extrabold text-purple-600 mb-1">
                $0
              </div>
              <div className="text-gray-700 font-medium">Sin monto mínimo</div>
              <p className="text-gray-400 text-xs mt-1">
                Retira cuando quieras
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Proceso */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Proceso de Aprobación
        </h2>
        <p className="text-gray-500 text-center mb-8 text-sm">
          En pocos pasos estarás listo para vender.
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          {steps.map((step, i) => (
            <div key={step.number} className="flex-1 flex flex-col items-center text-center">
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-2xl text-white shadow-md mb-3">
                {step.icon}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 w-full h-0.5 bg-purple-200" />
                )}
              </div>
              <div className="text-xs font-bold text-purple-500 mb-1">{step.number}</div>
              <div className="font-semibold text-gray-900 text-sm mb-1">{step.title}</div>
              <p className="text-gray-500 text-xs leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Requisitos + Políticas side by side */}
      <section className="mb-14 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📋</span> Requisitos para Vendedores
          </h2>
          <ul className="space-y-3">
            {requirements.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-blue-500 mt-0.5 shrink-0">✔</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📜</span> Políticas del Vendedor
          </h2>
          <ul className="space-y-3">
            {policies.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-amber-500 mt-0.5 shrink-0">✔</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Soporte */}
      <section className="mb-14">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            🤝 Soporte para Vendedores
          </h2>
          <p className="text-gray-500 text-center text-sm mb-7">
            Nuestro equipo está disponible para acompañarte en cada etapa.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {support.map((s) => (
              <div
                key={s.text}
                className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm"
              >
                <div className="text-3xl mb-2">{s.icon}</div>
                <p className="text-gray-700 text-xs font-medium leading-snug">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <div className="text-center bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-10 text-white shadow-xl">
        <div className="text-5xl mb-4">🚀</div>
        <h3 className="text-2xl font-bold mb-2">¿Listo para empezar a vender?</h3>
        <p className="text-white/80 mb-7 text-sm max-w-md mx-auto">
          Únete a los vendedores que ya hacen crecer su negocio musical en Mundo Beat.
        </p>
        <a
          href="/registro-vendedor"
          className="inline-block bg-white text-purple-700 font-bold px-10 py-3 rounded-full hover:bg-purple-50 transition-colors shadow-lg"
        >
          Registrarme como vendedor
        </a>
      </div>
    </div>
  );
}
