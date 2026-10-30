"use client";

import { useEffect, useRef, useState } from "react";
import { ScanBarcode, X } from "lucide-react";
import { playScanBeep, prepareScanSound } from "@/lib/scan-feedback";
import {
  inventoryButton as button,
  inventoryCaptureButton,
} from "@/lib/inventory";

export default function InventoryCamera({
  onRead,
}: {
  onRead: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onRead);
  callback.current = onRead;
  useEffect(() => {
    if (!open) return;
    let active = true,
      stream: MediaStream | undefined,
      timer: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        if (!(window as any).BarcodeDetector)
          throw new Error(
            "Este navegador no admite lectura de códigos. Ingresa el código en el buscador.",
          );
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current!.srcObject = stream;
        await video.current!.play();
        const detector = new (window as any).BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
        });
        const read = async () => {
          if (!active || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes[0]?.rawValue) {
              playScanBeep();
              callback.current(codes[0].rawValue);
              setOpen(false);
              return;
            }
          } catch {
            /* The next frame may be ready. */
          }
          if (active) timer = setTimeout(read, 250);
        };
        read();
      } catch (e: any) {
        if (active) {
          setError(e.message || "No se pudo abrir la cámara");
          setOpen(false);
        }
      }
    })();
    return () => {
      active = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);
  return (
    <>
      <button
        className={inventoryCaptureButton}
        onClick={() => {
          prepareScanSound();
          setError("");
          setOpen(true);
        }}
        title="Leer código con cámara"
      >
        <ScanBarcode size={28} className="shrink-0" />
        <span>Escanear</span>
      </button>
      {error && (
        <p
          role="alert"
          className="order-last col-span-2 w-full text-sm text-amber-800"
        >
          {error}
        </p>
      )}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Escanear código"
            className="w-full max-w-lg rounded-lg bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Escanear código</h2>
              <button
                className={button}
                title="Cerrar cámara"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <video
              ref={video}
              muted
              playsInline
              className="aspect-[4/3] w-full bg-black object-cover"
            />
          </section>
        </div>
      )}
    </>
  );
}
