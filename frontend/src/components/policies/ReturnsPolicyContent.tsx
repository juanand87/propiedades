import {
  BadgeCheck,
  BanknoteArrowDown,
  Box,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  PackageCheck,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";

type Props = {
  storeName: string;
  additionalConditions?: string;
  compact?: boolean;
};

const summaryItems = [
  { value: "10 días", label: "para retractarte", icon: RefreshCcw, color: "text-sky-700", bg: "bg-sky-50" },
  { value: "6 meses", label: "de garantía legal", icon: ShieldCheck, color: "text-emerald-700", bg: "bg-emerald-50" },
  { value: "45 días", label: "máximo para el reintegro", icon: CalendarClock, color: "text-amber-700", bg: "bg-amber-50" },
];

export default function ReturnsPolicyContent({ storeName, additionalConditions = "", compact = false }: Props) {
  return (
    <div className={compact ? "space-y-6" : "space-y-10"}>
      <section aria-label="Resumen de plazos" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryItems.map(({ value, label, icon: Icon, color, bg }) => (
          <div key={value} className={`flex min-h-24 items-center gap-3 border border-slate-200 p-4 ${bg}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center bg-white ${color}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-sm text-slate-600">{label}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="border-l-4 border-sky-600 bg-sky-50 px-5 py-4 text-sm leading-6 text-slate-700">
        Esta política establece los derechos mínimos aplicables a las compras realizadas en {storeName}.
        Las condiciones adicionales de la tienda pueden mejorar estos derechos, pero nunca limitarlos.
      </section>

      <PolicySection icon={RefreshCcw} title="Derecho a retracto">
        <p>
          En las compras realizadas por internet, puedes arrepentirte de la compra dentro de los <strong>10 días corridos</strong> siguientes a la recepción del producto, sin necesidad de indicar un motivo.
        </p>
        <p>
          Para ejercer este derecho, debes comunicarte con la tienda mediante alguno de sus canales de contacto e identificar la compra. Si no recibiste una confirmación escrita de las condiciones de compra, el plazo se extenderá a <strong>90 días</strong>.
        </p>
        <p>
          El retracto sólo podrá excluirse en los casos permitidos por la legislación vigente y cuando dicha exclusión haya sido informada claramente antes de la compra. Una vez comunicado el retracto y realizada la devolución, la tienda restituirá las sumas pagadas en un plazo máximo de <strong>45 días</strong>.
        </p>
      </PolicySection>

      <section>
        <SectionHeading icon={Truck} title="Quién paga la devolución" />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <CostPanel
            icon={CircleDollarSign}
            title="Retracto o preferencia personal"
            description="El costo directo de devolver el producto es pagado por el comprador."
            tone="buyer"
          />
          <CostPanel
            icon={Store}
            title="Falla, error o incumplimiento"
            description="La tienda paga la devolución cuando existe una falla, un error de despacho o un incumplimiento."
            tone="store"
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          El producto deberá devolverse en buen estado y con los elementos entregados junto con él, cuando corresponda. La tienda puede ofrecer una condición más favorable para el comprador.
        </p>
      </section>

      <PolicySection icon={ShieldCheck} title="Garantía legal para productos nuevos">
        <p>
          Si un producto nuevo presenta fallas, le faltan piezas, no sirve para el uso informado o no cumple con las características anunciadas, puedes ejercer la garantía legal durante los <strong>6 meses</strong> siguientes a su recepción.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Choice icon={ClipboardCheck} label="Reparación gratuita" />
          <Choice icon={PackageCheck} label="Cambio del producto" />
          <Choice icon={BanknoteArrowDown} label="Devolución del dinero" />
        </div>
        <p>
          La elección corresponde al comprador. La tienda no puede imponer una alternativa ni exigir la aprobación previa de un servicio técnico. No necesitas conservar el embalaje original y puedes acreditar la compra con boleta, factura, comprobante de pago u otro antecedente verificable. La gestión de la garantía no tendrá costo para el comprador.
        </p>
      </PolicySection>

      <PolicySection icon={Box} title="Productos usados, reacondicionados o de segunda selección">
        <p>
          Esta condición debe informarse claramente antes de la compra. Cuando haya sido debidamente informada, el producto no contará con la garantía legal aplicable a productos nuevos, sin perjuicio de las garantías voluntarias ofrecidas por la tienda.
        </p>
        <p>
          Esto no limita el derecho a reclamar si el producto recibido no corresponde a lo anunciado, tiene defectos que no fueron informados o existe otro incumplimiento de las condiciones ofrecidas.
        </p>
      </PolicySection>

      <PolicySection icon={BadgeCheck} title="Cambios voluntarios">
        <p>
          Los cambios por talla, color, preferencia u otras razones que no correspondan a una falla dependen de las condiciones adicionales ofrecidas por la tienda. Estas políticas voluntarias son independientes del retracto y de la garantía legal.
        </p>
      </PolicySection>

      <section>
        <SectionHeading icon={ReceiptText} title="Cómo realizar una solicitud" />
        <div className="mt-4 grid grid-cols-1 gap-0 border border-slate-200 md:grid-cols-4">
          {["Contacta a la tienda", "Identifica tu compra", "Describe la solicitud", "Recibe las instrucciones"].map((label, index) => (
            <div key={label} className="relative border-b border-slate-200 p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{index + 1}</span>
              <p className="text-sm font-semibold text-slate-800">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Informa el número o comprobante de compra, el producto involucrado y el motivo. Las fotografías sólo se solicitarán cuando sean necesarias para identificar el producto o la situación. La tienda no puede establecer requisitos que dificulten injustificadamente tus derechos.
        </p>
      </section>

      <section className="border border-slate-200 bg-white p-5 sm:p-6">
        <SectionHeading icon={BadgeCheck} title="Condiciones adicionales de la tienda" />
        {additionalConditions.trim() ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{additionalConditions.trim()}</p>
        ) : (
          <p className="mt-4 text-sm leading-6 text-slate-500">
            {storeName} no ha publicado condiciones adicionales. Se aplican íntegramente las reglas indicadas en esta página.
          </p>
        )}
      </section>
    </div>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: typeof ShieldCheck; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-900 text-white">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
    </div>
  );
}

function PolicySection({ icon, title, children }: { icon: typeof ShieldCheck; title: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionHeading icon={icon} title={title} />
      <div className="mt-4 space-y-4 text-sm leading-7 text-slate-700 sm:text-base">{children}</div>
    </section>
  );
}

function CostPanel({ icon: Icon, title, description, tone }: { icon: typeof Store; title: string; description: string; tone: "buyer" | "store" }) {
  const classes = tone === "buyer"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div className={`flex gap-3 border p-4 ${classes}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">{description}</p>
      </div>
    </div>
  );
}

function Choice({ icon: Icon, label }: { icon: typeof PackageCheck; label: string }) {
  return (
    <div className="flex min-h-20 items-center gap-3 border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {label}
    </div>
  );
}
