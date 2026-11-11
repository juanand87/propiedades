export function formatClpInput(value: string | number | null | undefined) {
  return String(value ?? "")
    .split(".")[0]
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
export function parseClpInput(value: string) {
  return value.replace(/[^0-9]/g, "");
}
