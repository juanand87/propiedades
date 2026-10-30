import { CreditCard, ShieldCheck, Truck } from 'lucide-react';

type BenefitIcon = 'truck' | 'shield' | 'payment';

export interface StoreBenefitItem {
  icon: BenefitIcon;
  title: string;
  description: string;
}

const DEFAULT_ITEMS: StoreBenefitItem[] = [
  { icon: 'truck', title: 'Envíos a todo Chile', description: 'Recibe tu compra donde estés.' },
  { icon: 'payment', title: 'Compra segura', description: 'Paga con medios de pago protegidos.' },
  { icon: 'shield', title: 'Productos protegidos', description: 'Preparamos cada pedido con cuidado.' },
];

const ICONS = {
  truck: Truck,
  shield: ShieldCheck,
  payment: CreditCard,
};

export default function StoreBenefits({ items = DEFAULT_ITEMS }: { items?: StoreBenefitItem[] }) {
  const visibleItems = items.slice(0, 3);

  return (
    <section className="grid grid-cols-1 overflow-hidden border-y border-gray-200 bg-white md:grid-cols-3">
      {visibleItems.map((item, index) => {
        const Icon = ICONS[item.icon] || ShieldCheck;
        return (
          <div
            key={`${item.title}-${index}`}
            className="flex min-h-36 items-center justify-center gap-4 px-6 py-7 text-center md:flex-col md:border-l md:first:border-l-0"
          >
            <Icon className="h-7 w-7 shrink-0 text-[var(--color-primary,#0f7496)]" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">{item.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{item.description}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
