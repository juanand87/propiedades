"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Search, X } from "lucide-react";
import {
  inventoryRequest as request,
  inventoryButton as button,
  inventoryCaptureButton,
  inventoryPrimary as primary,
} from "@/lib/inventory";

export default function InventoryPhoto({
  sessionId,
  onSelect,
  onUnknown,
}: {
  sessionId: string;
  onSelect: (product: any) => void;
  onUnknown: (file: File) => void;
}) {
  const [source, setSource] = useState("");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!source) return;
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active) setImage(img);
    };
    img.onerror = () => {
      if (active)
        setError(
          "No se pudo abrir esta imagen. Adjunta una foto JPG, PNG o WebP.",
        );
    };
    img.src = source;
    return () => {
      active = false;
      URL.revokeObjectURL(source);
    };
  }, [source]);
  useEffect(() => {
    if (!image || !canvas.current) return;
    const size = Math.min(image.width, image.height) / zoom;
    const left = ((image.width - size) * x) / 100,
      top = ((image.height - size) * y) / 100;
    const ctx = canvas.current.getContext("2d");
    ctx?.drawImage(image, left, top, size, size, 0, 0, 512, 512);
  }, [image, zoom, x, y]);
  async function cropped() {
    if (!canvas.current) throw new Error("No se pudo preparar la foto");
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.current?.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("No se pudo preparar la foto")),
        "image/jpeg",
        0.9,
      ),
    );
    return new File([blob], "portada.jpg", { type: "image/jpeg" });
  }
  async function search() {
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("photo", await cropped());
      const result = await request(
        `sessions/${sessionId}/photo-search`,
        "POST",
        data,
      );
      setResults(result.matches);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className={inventoryCaptureButton}
        onClick={() => fileInput.current?.click()}
      >
        <Camera size={28} className="shrink-0" />
        <span>Buscar por portada</span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 8 * 1024 * 1024) {
            setError("La foto no debe superar 8 MB");
            return;
          }
          setImage(null);
          setSource(URL.createObjectURL(file));
          setZoom(1);
          setX(50);
          setY(50);
          setResults(null);
          setError("");
          e.target.value = "";
        }}
      />
      {!source && error && (
        <p role="alert" className="order-last col-span-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {source && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-3">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cover-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4"
          >
            <header className="mb-3 flex items-center justify-between">
              <h2 id="cover-title" className="font-semibold">
                Identificar portada
              </h2>
              <button
                className={button}
                disabled={busy}
                title="Cerrar"
                onClick={() => setSource("")}
              >
                <X size={18} />
              </button>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <canvas
                  ref={canvas}
                  width={512}
                  height={512}
                  className="aspect-square w-full bg-slate-100"
                />
                {[
                  ["Acercamiento", zoom, setZoom, 1, 3, 0.05],
                  ["Horizontal", x, setX, 0, 100, 1],
                  ["Vertical", y, setY, 0, 100, 1],
                ].map(([label, value, setter, min, max, step]) => (
                  <label key={String(label)} className="mt-2 block text-xs">
                    {String(label)}
                    <input
                      type="range"
                      className="mt-1 w-full"
                      min={Number(min)}
                      max={Number(max)}
                      step={Number(step)}
                      value={Number(value)}
                      onChange={(e) =>
                        (setter as (v: number) => void)(Number(e.target.value))
                      }
                    />
                  </label>
                ))}
                <button
                  className={`${primary} mt-3 w-full`}
                  disabled={busy || !image}
                  onClick={search}
                >
                  <Search size={16} />
                  {busy ? "Buscando..." : "Buscar coincidencias"}
                </button>
              </div>
              <div className="space-y-3">
                {error && (
                  <p role="alert" className="text-sm text-red-700">
                    {error}
                  </p>
                )}
                {results?.map((result) => (
                  <button
                    key={result.product.id}
                    className="flex w-full items-start gap-3 border-b p-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      onSelect(result.product);
                      setSource("");
                    }}
                  >
                    <img
                      alt=""
                      src={result.product.images?.[0]}
                      className="h-16 w-16 shrink-0 object-cover"
                    />
                    <span className="min-w-0 text-sm">
                      <strong className="block break-words">
                        {result.product.title}
                      </strong>
                      <span className="block text-xs text-slate-500">
                        {result.product.format} · {result.product.year} ·{" "}
                        {result.product.condition}
                      </span>
                      <span className="text-xs">{result.product.sku}</span>
                    </span>
                  </button>
                ))}
                {results?.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No se encontraron portadas indexadas disponibles.
                  </p>
                )}
                <button
                  disabled={busy || !image}
                  className={`${button} w-full`}
                  onClick={async () => {
                    try {
                      onUnknown(await cropped());
                      setSource("");
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  No corresponde: registrar sin ficha
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
