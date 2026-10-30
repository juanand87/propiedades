"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";

/* ─────────────────────────────────────────────
   HOOK: scroll-triggered visibility
───────────────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─────────────────────────────────────────────
   HOOK: animated counter
───────────────────────────────────────────── */
function useCounter(target: number, duration = 1800, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(start);
    }, 16);
    return () => clearInterval(timer);
  }, [active, target, duration]);
  return val;
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  dir = "up",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  dir?: "up" | "left" | "right";
  className?: string;
}) {
  const { ref, visible } = useReveal();
  const translate =
    dir === "up" ? "translateY(40px)" : dir === "left" ? "translateX(-50px)" : "translateX(50px)";
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : translate,
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const valueVisuals: Record<string, { src: string; alt: string }> = {
  store: {
    src: "http://localhost:3001/media/5719f26f-7e15-44cc-9658-83d2bcfe0d82.gif",
    alt: "Personalización de una tienda en Mundo Beat",
  },
  catalog: {
    src: "http://localhost:3001/media/72ebabd5-2e86-49ba-94b3-b2e32c74e4cd.gif",
    alt: "Carga inteligente de productos en Mundo Beat",
  },
  payments: {
    src: "http://localhost:3001/media/2d021c19-8119-4654-add0-7d3b9d1995e1.gif",
    alt: "Gestión de pagos en Mundo Beat",
  },
  shipping: {
    src: "http://localhost:3001/media/fb14e9c5-cad1-4b51-ac9d-40245bb342bf.gif",
    alt: "Generación y seguimiento de envíos en Mundo Beat",
  },
};

function ValueVisual({ kind }: { kind: string }) {
  const visual = valueVisuals[kind];

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
      <img
        src={visual.src}
        alt={visual.alt}
        className="h-full w-full object-contain"
        loading="lazy"
      />
    </div>
  );
}

function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, visible } = useReveal();
  const count = useCounter(value, 1600, visible);
  return (
    <div ref={ref} className="text-center">
      <div className="text-5xl md:text-6xl font-black text-white leading-none mb-2">
        {count.toLocaleString("es-CL")}
        <span style={{ color: "var(--color-primary)" }}>{suffix}</span>
      </div>
      <div className="text-white/60 text-sm font-medium uppercase tracking-widest">{label}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   VALUES DATA
───────────────────────────────────────────── */
const values = [
  {
    kind: "store",
    tag: "TU TIENDA",
    headline: "Tu marca,\ntu identidad.",
    body: "Personaliza cada detalle de tu tienda: logo, colores, descripción, y más. Mundo Beat te da el espacio para que tu negocio musical brille con personalidad propia.",
    features: ["Logo y colores propios", "Dominio personalizado", "Diseño adaptable"],
    action: "Crear mi tienda",
  },
  {
    kind: "catalog",
    tag: "TECNOLOGÍA",
    headline: "Carga inteligente\nde productos.",
    body: "Ingresa el número de serie o catálogo y nosotros importamos toda la información: artista, año, tracklist, condición y más. Menos tiempo en datos, más tiempo en música.",
    features: ["Datos automáticos", "Ahorra tiempo de carga", "Información completa"],
    action: "Conocer la carga inteligente",
  },
  {
    kind: "payments",
    tag: "PAGOS",
    headline: "Cobra sin\ncomplicaciones.",
    body: "Integraciones con Payku y transferencias bancarias. Recibe pagos seguros y seguimiento de cada transacción desde tu panel.",
    features: ["Pagos seguros", "Seguimiento de transacciones", "Liquidaciones claras"],
    action: "Configurar métodos de pago",
  },
  {
    kind: "shipping",
    tag: "ENVÍOS",
    headline: "Despacha\ndesde casa.",
    body: "Conexión directa con empresas de transporte. Genera etiquetas y coordina retiro de encomiendas sin salir de tu casa.",
    features: ["Genera etiquetas", "Coordina retiros", "Seguimiento en línea"],
    action: "Ver opciones de envío",
  },
];

const formats = [
  { icon: "💿", label: "Vinilos", desc: 'El formato rey. LPs, EPs, 7", 10", 12".' },
  { icon: "📀", label: "CDs", desc: "Álbumes, singles y ediciones especiales." },
  { icon: "📼", label: "Cassettes", desc: "El revival analógico que no para." },
  { icon: "�", label: "DVD", desc: "Conciertos, documentales y ediciones especiales." },
  { icon: "🎞️", label: "VHS", desc: "El clásico analógico que vuelve con fuerza." },
  { icon: "💽", label: "Blu-ray", desc: "Alta definición para coleccionistas exigentes." },
  { icon: "🎵", label: "Otros Formatos", desc: "Minidisc, SACD, LaserDisc y más." },
  { icon: "🎛️", label: "Equipos de Música", desc: "Tornamesas, amplificadores, reproductores y accesorios." },
  { icon: "�👕", label: "Merchandising", desc: "Ropa y accesorios de bandas y artistas." },
];

const integrations = [
  {
    name: "Mercado Libre",
    mark: "ML",
    markClass: "bg-yellow-400 text-blue-900",
    eyebrow: "Marketplace conectado",
    description: "Publica tu catálogo y administra desde Mundo Beat las ventas que llegan desde Mercado Libre.",
    features: [
      "Sincronización de publicaciones, precios y stock",
      "Ventas y etiquetas de envío en un solo panel",
      "Preguntas y cancelaciones conectadas con Mercado Libre",
    ],
  },
  {
    name: "WooCommerce",
    mark: "Woo",
    markClass: "bg-violet-600 text-white",
    eyebrow: "Tu tienda conectada",
    description: "Conecta tu sitio WordPress mediante el plugin oficial de Mundo Beat y centraliza su operación.",
    features: [
      "Productos y stock sincronizados automáticamente",
      "Tarifas de envío de Mundo Beat durante el checkout",
      "Pedidos y etiquetas gestionados desde Mundo Beat",
    ],
  },
];

const ticker = "💿 VINILOS  &nbsp;•&nbsp;  📀 CDs  &nbsp;•&nbsp;  📼 CASSETTES  &nbsp;•&nbsp;  🎵 MÚSICA FÍSICA  &nbsp;•&nbsp;  🚚 ENVÍOS A TODO CHILE  &nbsp;•&nbsp;  💳 PAGOS SEGUROS  &nbsp;•&nbsp;  ⭐ VENDEDORES VERIFICADOS  &nbsp;•&nbsp;  ";

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function SellWithUsHero() {
  const [heroLoaded, setHeroLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* ── Keyframe styles ── */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 40%, transparent); }
          70% { transform: scale(1); box-shadow: 0 0 0 20px transparent; }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 transparent; }
        }
        .swh-btn-primary {
          background-color: var(--color-primary);
          color: #fff;
        }
        .swh-btn-primary:hover {
          background-color: var(--color-secondary);
        }
        .swh-step-line {
          background-color: var(--color-primary);
          opacity: 0.2;
        }
        .swh-format-card:hover {
          border-color: var(--color-primary) !important;
        }
      `}</style>

      <div className="overflow-hidden">

        {/* ══════════ 1. HERO ══════════ */}
        <section
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: "16/7", minHeight: "420px" }}
        >
          {/* Hero image — upload to /public/images/hero-sell.jpg */}
          <img
            src="http://localhost:3001/media/e09d13e4-5047-462b-a793-63b45f3ccf6e.jpg"
            alt="La adrenalina de vender lo que amas — Mundo Beat"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />

          {/* Subtle dark gradient at bottom for button legibility */}
          <div
            className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)" }}
          />

          {/* CTA buttons — centered at bottom */}
          <div
            className="absolute inset-x-0 bottom-8 flex flex-wrap items-center justify-center gap-4 px-6"
            style={{
              opacity: heroLoaded ? 1 : 0,
              transform: heroLoaded ? "none" : "translateY(20px)",
              transition: "opacity 0.7s ease 0.3s, transform 0.7s ease 0.3s",
            }}
          >
            <a
              href="/registro-vendedor"
              style={{ animation: "pulse-ring 2.5s ease-in-out 2s infinite" }}
              className="swh-btn-primary inline-block font-bold px-10 py-4 rounded-full text-base shadow-xl"
            >
              Quiero ser vendedor →
            </a>
            <a
              href="#como-funciona"
              className="inline-block font-medium px-8 py-4 rounded-full text-base bg-white/10 backdrop-blur-sm text-white border border-white/40 hover:bg-white/20 transition-all"
            >
              Ver cómo funciona
            </a>
          </div>
        </section>

        {/* ══════════ 2. TICKER ══════════ */}
        <div className="py-4 overflow-hidden" style={{ backgroundColor: "var(--color-primary)" }}>
          <div
            className="flex whitespace-nowrap text-white font-bold text-sm uppercase tracking-wider"
            style={{ animation: "marquee 22s linear infinite" }}
          >
            {[0, 1].map((i) => (
              <span key={i} className="mr-0 pr-0" dangerouslySetInnerHTML={{ __html: ticker.repeat(3) }} />
            ))}
          </div>
        </div>

        {/* ══════════ 3. VALUES (alternating panels) ══════════ */}
        <section className="bg-white py-24">
          <div className="max-w-5xl mx-auto px-6">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3 text-center" style={{ color: "var(--color-primary)" }}>
                Por qué Mundo Beat
              </p>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 text-center mb-20 leading-tight">
                Todo lo que necesitas<br />para vender música.
              </h2>
            </Reveal>

            <div className="space-y-24">
              {values.map((v, i) => (
                <div key={v.tag} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
                  <Reveal
                    dir={i % 2 === 0 ? "left" : "right"}
                    className={i % 2 === 0 ? "md:order-2" : "md:order-1"}
                  >
                    <ValueVisual kind={v.kind} />
                  </Reveal>
                  <Reveal
                    dir={i % 2 === 0 ? "right" : "left"}
                    delay={120}
                    className={i % 2 === 0 ? "md:order-1" : "md:order-2"}
                  >
                    <div>
                      <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>{v.tag}</span>
                      <h3 className="mt-3 mb-5 whitespace-pre-line text-4xl font-black leading-[1.05] text-slate-950 md:text-5xl">
                        {v.headline}
                      </h3>
                      <p className="text-lg leading-relaxed text-slate-500">{v.body}</p>
                      <div className="mt-7 grid gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
                        {v.features.map((feature) => (
                          <div key={feature} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <Check className="h-4 w-4 shrink-0" style={{ color: "var(--color-primary)" }} />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                      <a href="/registro-vendedor" className="swh-btn-primary mt-8 inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5">
                        {v.action}<ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </Reveal>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ 4. INTEGRATIONS ══════════ */}
        <section className="border-y border-gray-200 bg-gray-50 py-24 px-6">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
                Integraciones
              </p>
              <h2 className="text-center text-4xl font-black leading-tight text-gray-900 md:text-5xl">
                Todos tus canales,<br />un solo inventario.
              </h2>
              <p className="mx-auto mt-5 mb-12 max-w-2xl text-center text-lg leading-relaxed text-gray-500">
                Conecta los canales donde ya vendes y administra catálogo, stock, pedidos y envíos desde Mundo Beat.
              </p>
            </Reveal>

            <div className="grid gap-6 md:grid-cols-2">
              {integrations.map((integration, index) => (
                <Reveal key={integration.name} delay={index * 120} dir={index === 0 ? "left" : "right"}>
                  <article className="h-full rounded-2xl border border-gray-200 bg-white p-7 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div className="mb-6 flex items-center gap-4">
                      <div className={`flex h-12 min-w-12 items-center justify-center rounded-lg px-3 text-sm font-black ${integration.markClass}`}>
                        {integration.mark}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{integration.eyebrow}</p>
                        <h3 className="text-2xl font-black text-gray-900">{integration.name}</h3>
                      </div>
                    </div>
                    <p className="mb-6 leading-relaxed text-gray-500">{integration.description}</p>
                    <ul className="space-y-3">
                      {integration.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm font-medium text-gray-700">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ backgroundColor: "var(--color-primary)" }}>✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ 5. STATS ══════════ */}
        <section
          className="py-24 px-6"
          style={{ background: "linear-gradient(135deg, #0d0d0d 0%, color-mix(in srgb, var(--color-primary) 15%, #0d0d0d) 100%)" }}
        >
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3 text-center" style={{ color: "var(--color-primary)" }}>
                Mundo Beat en números
              </p>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mt-10">
              <StatCard value={12} suffix="%" label="Comisión por venta" />
              <StatCard value={2} suffix=" días" label="Pago máximo en hábiles" />
              <StatCard value={0} suffix=" CLP" label="Costo de entrada" />
              <StatCard value={16} suffix="" label="Regiones de Chile" />
            </div>
          </div>
        </section>

        {/* ══════════ 5. HOW IT WORKS ══════════ */}
        <section id="como-funciona" className="bg-gray-50 py-24 px-6">
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3 text-center" style={{ color: "var(--color-primary)" }}>
                Proceso
              </p>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 text-center mb-16 leading-tight">
                De cero a vender<br />en 4 pasos.
              </h2>
            </Reveal>

            {[
              { n: "01", title: "Solicita tu cuenta", body: "Completa el formulario de registro. Es gratis y toma menos de 5 minutos.", icon: "📝" },
              { n: "02", title: "Aprobación en 1–3 días", body: "Nuestro equipo revisa tu solicitud y te envía las credenciales por email.", icon: "✅" },
              { n: "03", title: "Configura tu tienda", body: "Personaliza tu logo, colores y sube tus primeros productos con un clic.", icon: "🛠️" },
              { n: "04", title: "¡Empieza a vender!", body: "Tu tienda queda activa y visible para miles de compradores en todo Chile.", icon: "🚀" },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 100}>
                <div className="flex gap-6 mb-10 group">
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0 group-hover:scale-110 transition-transform" style={{ backgroundColor: "var(--color-primary)" }}>
                      {step.icon}
                    </div>
                    {i < 3 && <div className="swh-step-line w-px flex-1 mt-2 mb-0 min-h-[3rem]" />}
                  </div>
                  <div className="pb-8">
                    <span className="text-xs font-bold" style={{ color: "var(--color-primary)" }}>{step.n}</span>
                    <h3 className="text-xl font-bold text-gray-900 mb-1 mt-0.5">{step.title}</h3>
                    <p className="text-gray-500">{step.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ══════════ 6. QUOTE ══════════ */}
        <section
          className="py-24 px-6"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 15%, #0d0d0d) 0%, #0d0d0d 100%)" }}
        >
          <Reveal>
            <div className="max-w-3xl mx-auto text-center">
              <div className="text-7xl font-black leading-none mb-6 opacity-30" style={{ color: "var(--color-primary)" }}>"</div>
              <blockquote className="text-2xl md:text-3xl font-bold text-white leading-relaxed mb-8 -mt-10">
                No importa si tienes 10 discos o 10.000. En Mundo Beat tienes
                el mismo acceso a herramientas profesionales para vender más.
              </blockquote>
              <div className="font-semibold" style={{ color: "var(--color-primary)" }}>Equipo Mundo Beat</div>
              <div className="text-white/40 text-sm mt-1">Santiago, Chile</div>
            </div>
          </Reveal>
        </section>

        {/* ══════════ 7. FORMATS ══════════ */}
        <section className="bg-white py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3 text-center" style={{ color: "var(--color-primary)" }}>
                Formatos
              </p>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 text-center mb-14 leading-tight">
                ¿Qué puedes vender?
              </h2>
            </Reveal>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-5">
              {formats.map((f, i) => (
                <Reveal key={f.label} delay={i * 80}>
                  <div className="swh-format-card group border-2 border-gray-100 rounded-2xl p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-default">
                    <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">
                      {f.icon}
                    </div>
                    <div className="font-bold text-gray-900 mb-1">{f.label}</div>
                    <div className="text-gray-400 text-xs leading-snug">{f.desc}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ 8. CTA FINAL ══════════ */}
        <section
          className="relative py-32 px-6 overflow-hidden"
          style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 60%, #0f0f0f 100%)" }}
        >
          {/* decorative */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {["♫", "♪", "♬", "♩"].map((n, i) => (
              <span
                key={i}
                className="absolute text-white/5 font-black"
                style={{
                  fontSize: `${8 + i * 4}rem`,
                  right: `${5 + i * 20}%`,
                  bottom: `${-10 + i * 15}%`,
                  animation: `float ${4 + i}s ease-in-out infinite`,
                  animationDelay: `${i * 0.6}s`,
                }}
              >
                {n}
              </span>
            ))}
          </div>

          <Reveal>
            <div className="relative z-10 max-w-3xl mx-auto text-center">
              <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6">
                ¿Listo para<br />hacer historia?
              </h2>
              <p className="text-white/70 text-lg mb-10 max-w-xl mx-auto">
                Únete a los vendedores que ya hacen crecer su negocio musical en
                el marketplace de música más grande de Chile.
              </p>
              <a
                href="/registro-vendedor"
                className="inline-block bg-white font-black px-12 py-5 rounded-full text-lg hover:opacity-90 transition-opacity shadow-2xl"
                style={{ color: "var(--color-primary)" }}
              >
                Registrarme ahora →
              </a>
            </div>
          </Reveal>
        </section>

      </div>
    </>
  );
}
