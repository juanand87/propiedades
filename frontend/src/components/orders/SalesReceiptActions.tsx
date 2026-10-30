"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, Loader2, QrCode, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SalesReceiptLink } from "./SalesReceiptLink";

export default function SalesReceiptActions({ order, onSaved }: {
  order: any;
  onSaved: (order: any, message: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const qrInput = useRef<HTMLInputElement>(null);
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [qrImage, setQrImage] = useState<Blob | null>(null);
  const [qrPreview, setQrPreview] = useState('');
  useEffect(() => {
    if (!qrImage) { setQrPreview(''); return; }
    const objectUrl = URL.createObjectURL(qrImage); setQrPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [qrImage]);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (e: any) { setError(e.message || "No se pudo procesar la boleta"); }
    finally { working.current = false; setBusy(false); }
  }
  function saved(updated: any) {
    const notice = updated.salesReceiptNotification === "sent"
      ? "Boleta guardada. Correo enviado al comprador."
      : updated.salesReceiptNotification === "unchanged"
        ? "La boleta ya estaba guardada."
        : "Boleta guardada, pero no se pudo enviar el correo al comprador.";
    onSaved(updated, updated.salesReceiptPdfSaved === false ? `${notice} No se pudo conservar una copia del PDF; se mantuvo el enlace original.` : notice);
    setOpen(false);
  }
  async function decode(blob: Blob) {
    setUrl("");
    setQrImage(null);
    if (!blob.type.startsWith("image/") || blob.size > 10 * 1024 * 1024)
      throw new Error("Selecciona una imagen de hasta 10 MB");
    const bitmap = await createImageBitmap(blob);
    try {
      const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("No se pudo leer la imagen");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const { default: jsQR } = await import("jsqr");
      const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
      if (!result) throw new Error("No se encontró un QR legible en la imagen");
      let parsed: URL;
      try { parsed = new URL(result.data.trim()); }
      catch { throw new Error("El QR no contiene un enlace web válido"); }
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.href.length > 4096)
        throw new Error("El QR no contiene un enlace web HTTP o HTTPS válido");
      setUrl(parsed.href);
      const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo guardar la imagen')), 'image/png'));
      setQrImage(image);
    } finally { bitmap.close(); }
  }
  async function paste() {
    setUrl("");
    if (!navigator.clipboard?.read) throw new Error("El navegador no permite leer el portapapeles. Puedes pegar con Ctrl+V o cargar la imagen del QR.");
    let items: ClipboardItems;
    try { items = await navigator.clipboard.read(); }
    catch { throw new Error("No se pudo acceder al portapapeles. Puedes pegar con Ctrl+V o cargar la imagen del QR."); }
    for (const item of items) {
      const type = item.types.find((value) => value.startsWith("image/"));
      if (type) { await decode(await item.getType(type)); return; }
    }
    throw new Error("No hay una imagen en el portapapeles");
  }
  return <div className="space-y-2 pt-2">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-600">Adjuntar boleta:</span>
      <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" aria-label="Archivo de boleta"
        onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (file) void run(async () => saved(await api.uploadOrderSalesReceipt(order.id, file)));
        }} />
      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Subir boleta PDF o imagen" aria-label="Subir boleta PDF o imagen" disabled={busy} onClick={() => fileInput.current?.click()}>
        {busy && !open ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      </Button>
      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Leer QR de la boleta" aria-label="Leer QR de la boleta" disabled={busy} onClick={() => { setUrl(""); setQrImage(null); setError(""); setOpen(true); }}><QrCode className="h-4 w-4" /></Button>
    </div>
    <SalesReceiptLink url={order.salesReceiptUrl} qrImageUrl={order.salesReceiptQrImageUrl} token={order.salesReceiptToken} />
    {!open && error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <Dialog open={open} onOpenChange={(value) => { if (!working.current) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" onPaste={(event) => {
        const file = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"))?.getAsFile();
        if (file) { event.preventDefault(); void run(() => decode(file)); }
      }}>
        <DialogHeader><DialogTitle>QR de la boleta</DialogTitle><DialogDescription>Enlace del comprobante de compra</DialogDescription></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void run(paste)}><ClipboardPaste className="mr-2 h-4 w-4" />Pegar imagen</Button>
          <Button variant="outline" disabled={busy} onClick={() => qrInput.current?.click()}><Upload className="mr-2 h-4 w-4" />Cargar imagen QR</Button>
          <input ref={qrInput} type="file" accept="image/*" className="hidden" aria-label="Imagen del QR" onChange={(event) => {
            const file = event.target.files?.[0]; event.target.value = "";
            if (file) void run(() => decode(file));
          }} />
        </div>
        {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Procesando...</p>}
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-sky-700 underline">{url}</a>}
        {qrPreview && <img src={qrPreview} alt="QR leído de la boleta" className="mx-auto h-40 w-40 object-contain" />}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button disabled={busy || !url || !qrImage} onClick={() => void run(async () => saved(await api.uploadQrSalesReceipt(order.id, url, qrImage!)))}>Guardar boleta y notificar</Button>
      </DialogContent>
    </Dialog>
  </div>;
}
