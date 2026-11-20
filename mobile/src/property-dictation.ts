export type DictationDraft = {
  transcript: string;
  fields: Record<string, string>;
  warnings: string[];
  review_required: true;
};
export const dictationLabels: Record<string, string> = {
  title: "Título",
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
  land_area: "Terreno (m²)",
  neighborhood: "Sector o barrio",
  address: "Dirección",
};
export function mergeDictatedFields(
  current: Record<string, string>,
  draft: Record<string, string>,
  selected: string[],
) {
  const patch = Object.fromEntries(
    selected
      .filter(
        (key) =>
          Object.prototype.hasOwnProperty.call(dictationLabels, key) &&
          typeof draft[key] === "string",
      )
      .map((key) => [key, draft[key]]),
  );
  if (
    patch.region_id &&
    patch.region_id !== current.region_id &&
    !patch.commune_id
  )
    patch.commune_id = "";
  if (
    patch.price_unit &&
    patch.price_unit !== current.price_unit &&
    !patch.price_amount
  )
    patch.price_amount = "";
  return { ...current, ...patch };
}
export function toggleDictationField(
  selected: string[],
  key: string,
  fields: Record<string, string>,
) {
  const group = ["price_amount", "price_unit"].includes(key)
    ? ["price_amount", "price_unit"]
    : ["commune_id", "region_id"].includes(key)
      ? ["commune_id", "region_id"]
      : [key];
  const keys = group.filter((k) => k in fields);
  return selected.includes(key)
    ? selected.filter((k) => !keys.includes(k))
    : [...new Set([...selected, ...keys])];
}
