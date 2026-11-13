export type SearchFilters = {
  search: string;
  type_id: string;
  operation_type: string;
  bedrooms: string;
  price_unit: string;
  min_price: string;
  max_price: string;
};
export const emptySearchFilters: SearchFilters = {
  search: "",
  type_id: "",
  operation_type: "",
  bedrooms: "",
  price_unit: "CLP",
  min_price: "",
  max_price: "",
};
export type SavedSearch = {
  id: string;
  name: string;
  filters: Partial<SearchFilters>;
  enabled: boolean;
};
export function searchDescription(filters: Partial<SearchFilters>) {
  const types: Record<string, string> = {
    house: "Casa",
    apartment: "Departamento",
    land: "Terreno",
  };
  const price = (value: string) =>
    filters.price_unit === "CLP"
      ? `$${Number(value).toLocaleString("es-CL")}`
      : `${Number(value).toLocaleString("es-CL")} UF`;
  return [
    filters.search,
    filters.type_id && (types[filters.type_id] || filters.type_id),
    filters.operation_type &&
      (filters.operation_type === "rent" ? "Arriendo" : "Venta"),
    filters.bedrooms && `${filters.bedrooms}+ dormitorios`,
    filters.min_price && `Desde ${price(filters.min_price)}`,
    filters.max_price && `Hasta ${price(filters.max_price)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
