import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <span className="eyebrow">404 · PROPIEDADES</span>
      <h1>Este lugar no está disponible.</h1>
      <p>La página pudo cambiar o la publicación fue retirada.</p>
      <Link className="button" href="/propiedades">
        Explorar propiedades
      </Link>
    </main>
  );
}
