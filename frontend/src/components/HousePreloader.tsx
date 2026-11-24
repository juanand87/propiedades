import { House } from "lucide-react";
export function HousePreloader() {
  return (
    <main
      className="house-preloader"
      role="status"
      aria-live="polite"
      aria-label="Preparando tu panel de Proppix"
    >
      <div className="house-preloader-icon" aria-hidden="true">
        <House size={54} strokeWidth={1.5} />
        <span />
      </div>
      <strong>Proppix</strong>
      <span className="house-preloader-caption">Preparando tu espacio…</span>
    </main>
  );
}
