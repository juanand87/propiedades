"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>No pudimos cargar esta página.</h1>
      <p>Intenta nuevamente en unos momentos.</p>
      <button onClick={reset}>Reintentar</button>
    </main>
  );
}
