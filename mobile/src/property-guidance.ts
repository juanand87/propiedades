export function missingPropertyData(form: Record<string, string>) {
  const missing: string[] = [];
  if ((form.title || "").trim().length < 8)
    missing.push("un título más descriptivo");
  if ((form.description || "").trim().length < 40)
    missing.push("la descripción");
  if (!Number(form.price_amount)) missing.push("el precio");
  if (!form.commune_id) missing.push("la comuna y región");
  if (["house", "apartment"].includes(form.type_id)) {
    if (!Number(form.built_area)) missing.push("la superficie construida");
    if (form.bedrooms == null || form.bedrooms === "")
      missing.push("los dormitorios");
    if (form.bathrooms == null || form.bathrooms === "")
      missing.push("los baños");
  }
  if (
    ["house", "land", "plot"].includes(form.type_id) &&
    !Number(form.land_area)
  )
    missing.push("la superficie de terreno");
  return missing;
}
export function previousPropertyContext(
  current: Record<string, string>,
  labels: Record<string, string>,
  display: (key: string, value: string) => string,
) {
  return Object.entries(current)
    .filter(
      ([k, v]) =>
        v !== "" && v != null && labels[k] && !k.startsWith("amenity:"),
    )
    .map(([k, v]) => labels[k] + ": " + display(k, v))
    .join("\n");
}
