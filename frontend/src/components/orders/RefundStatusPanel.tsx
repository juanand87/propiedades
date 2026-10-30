import { CircleDollarSign } from 'lucide-react';

const labels: Record<string, string> = {
  pending_submission: 'Pendiente de enviar a Payku',
  submitted: 'Solicitud registrada',
  processing: 'Procesando en Payku',
  awaiting_funds: 'Esperando fondos en Payku',
  waiting_bank_details: 'Payku espera información del comprador',
  refunded: 'Reembolso completado',
  failed: 'Reembolso requiere atención',
  manual_review: 'Revisión manual requerida',
  not_required: 'No requiere reembolso',
};

export function RefundStatusPanel({ refund }: { refund?: any }) {
  if (!refund) return null;
  const amount = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(refund.amount || 0));
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-950">
      <div className="flex items-start gap-2">
        <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        <div>
          <p className="font-semibold">Reembolso al comprador</p>
          <p>{labels[refund.status] || refund.status} · {amount}</p>
          {refund.paykuStatus && <p className="mt-1 text-xs text-blue-800">Estado Payku: {refund.paykuStatus}</p>}
          {refund.status !== 'refunded' && refund.status !== 'not_required' && (
            <p className="mt-1 text-xs text-blue-800">MundoBeat gestiona directamente esta devolución. La venta no será pagada a la tienda.</p>
          )}
          {refund.errorMessage && <p className="mt-1 text-xs text-red-700">{refund.errorMessage}</p>}
        </div>
      </div>
    </div>
  );
}
