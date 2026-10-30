"use client";

type Values = { assistedCommissionType: string; assistedCommissionPercentage: number; assistedCommissionFixedAmount: number };

export default function AssistedCommissionFields({ value, onChange }: { value: Values; onChange: (value: Values) => void }) {
  const fixed = value.assistedCommissionType === 'fixed';
  return <fieldset className="space-y-3 border-t pt-4">
    <legend className="text-sm font-semibold">Comisión por venta asistida</legend>
    <label className="block text-sm">Tipo de cobro
      <select className="mt-1 h-10 w-full rounded-md border bg-white px-3" value={value.assistedCommissionType} onChange={event => onChange({ ...value, assistedCommissionType: event.target.value })}>
        <option value="percentage">Porcentaje</option><option value="fixed">Monto fijo por venta</option>
      </select>
    </label>
    <label className="block text-sm">{fixed ? 'Monto fijo por venta (CLP)' : 'Porcentaje (%)'}
      <input className="mt-1 h-10 w-full rounded-md border px-3" type="number" min="0" max={fixed ? 9999999999 : 100} step={fixed ? 1 : 0.01} required value={fixed ? value.assistedCommissionFixedAmount : value.assistedCommissionPercentage} onChange={event => onChange({ ...value, [fixed ? 'assistedCommissionFixedAmount' : 'assistedCommissionPercentage']: event.target.valueAsNumber })} />
    </label>
  </fieldset>;
}
