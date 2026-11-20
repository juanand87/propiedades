export type DictationDraft = {
  transcript: string;
  fields: Record<string, string>;
  warnings: string[];
  review_required: true;
};
export type DictationAmenity = { id: string; name: string };
export const dictationLabels: Record<string, string> = {
  title: "Título",
  summary: "Resumen",
  description: "Descripción",
  type_id: "Tipo de propiedad",
  operation_type: "Operación",
  price_amount: "Precio",
  price_unit: "Moneda",
  region_id: "Región",
  commune_id: "Comuna",
  bedrooms: "Dormitorios",
  bathrooms: "Baños",
  parking: "Estacionamientos",
  built_area: "Superficie construida (m²)",
  usable_area: "Superficie útil (m²)",
  land_area: "Terreno (m²)",
  neighborhood: "Sector o barrio",
  address: "Dirección",
  latitude: "Latitud privada",
  longitude: "Longitud privada",
  storage_rooms: "Bodegas",
  construction_year: "Año de construcción",
  floors: "Pisos de la propiedad",
  floor_number: "Piso de la unidad",
  condition_type: "Estado",
  common_expenses: "Gastos comunes mensuales",
  contributions: "Contribuciones",
  expense_unit: "Moneda de gastos",
  contributions_period: "Periodicidad de contribuciones",
};
export function dictationLabelsFor(amenities: DictationAmenity[] = []) {
  return {
    ...dictationLabels,
    ...Object.fromEntries(
      amenities.map((a) => ["amenity:" + a.id, "Característica: " + a.name]),
    ),
  };
}
export function dictatedPatch(
  current: Record<string, unknown>,
  draft: Record<string, string>,
  selected: string[],
  amenities: DictationAmenity[] = [],
) {
  const labels = dictationLabelsFor(amenities);
  const patch: Record<string, string> = Object.fromEntries(
    selected
      .filter(
        (k) =>
          Object.prototype.hasOwnProperty.call(labels, k) &&
          typeof draft[k] === "string" &&
          (!k.startsWith("amenity:") || ["true", "false"].includes(draft[k])),
      )
      .map((k) => [k, draft[k]]),
  );
  if (
    patch.region_id &&
    patch.region_id !== String(current.region_id || "") &&
    !patch.commune_id
  )
    patch.commune_id = "";
  if (
    patch.price_unit &&
    patch.price_unit !== current.price_unit &&
    !patch.price_amount
  )
    patch.price_amount = "";
  if (patch.expense_unit && patch.expense_unit !== current.expense_unit) {
    if (!patch.common_expenses) patch.common_expenses = "";
    if (!patch.contributions) patch.contributions = "";
  }
  if (
    patch.contributions_period &&
    patch.contributions_period !== current.contributions_period &&
    !patch.contributions
  )
    patch.contributions = "";
  if ("latitude" in patch !== "longitude" in patch) {
    delete patch.latitude;
    delete patch.longitude;
  }
  return patch;
}
export function mergeDictatedFields(
  current: Record<string, string>,
  draft: Record<string, string>,
  selected: string[],
) {
  const patch = dictatedPatch(current, draft, selected);
  return { ...current, ...patch };
}
export function mergeDictatedAmenities(
  current: string[],
  draft: Record<string, string>,
  selected: string[],
  amenities: DictationAmenity[],
) {
  const result = new Set(current);
  for (const a of amenities) {
    const k = "amenity:" + a.id;
    if (!selected.includes(k)) continue;
    if (draft[k] === "true") result.add(a.id);
    else if (draft[k] === "false") result.delete(a.id);
  }
  return [...result];
}
export function toggleDictationField(
  selected: string[],
  key: string,
  fields: Record<string, string>,
) {
  const groups = [
    ["price_amount", "price_unit"],
    ["region_id", "commune_id"],
    ["latitude", "longitude"],
    [
      "common_expenses",
      "contributions",
      "expense_unit",
      "contributions_period",
    ],
  ];
  const keys = (groups.find((g) => g.includes(key)) || [key]).filter((k) =>
    Object.prototype.hasOwnProperty.call(fields, k),
  );
  return selected.includes(key)
    ? selected.filter((k) => !keys.includes(k))
    : [...new Set([...selected, ...keys])];
}
export function dictationEnumLabel(key: string, value: string) {
  if (key.startsWith("amenity:")) return value === "true" ? "Sí" : "No";
  if (key === "condition_type")
    return (
      (
        {
          new: "Nueva",
          used: "Usada",
          renovated: "Remodelada",
          project: "En proyecto",
          unknown: "Sin especificar",
        } as Record<string, string>
      )[value] || value
    );
  if (key === "contributions_period")
    return (
      (
        {
          monthly: "Mensual",
          quarterly: "Trimestral",
          yearly: "Anual",
        } as Record<string, string>
      )[value] || value
    );
  return value;
}
