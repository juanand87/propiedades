"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, LogOut, ScanBarcode, ShoppingCart, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getImageUrl } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import PosSessionGate, { PosContext } from "@/components/pos/PosSessionGate";

interface Product {
  id: string;
  title: string;
  artist?: string;
  price: number;
  stock: number;
  sku?: string;
  barcode?: string;
  images?: string[];
  imagen?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

type PaymentMethod = "efectivo" | "debito" | "credito" | "transferencia";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  debito: "Débito",
  credito: "Crédito",
  transferencia: "Transferencia",
};

export function PosWorkspace({ pos }: { pos: PosContext }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const paymentRefs = useRef<Record<PaymentMethod, HTMLButtonElement | null>>({
    efectivo: null,
    debito: null,
    credito: null,
    transferencia: null,
  });
  const barcodeBuffer = useRef("");
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
    setHasBarcodeDetector("BarcodeDetector" in window);
    if (new URLSearchParams(window.location.search).get("scan") === "1") {
      setScannerOpen(true);
    }
    const openScanner = () => setScannerOpen(true);
    window.addEventListener("open-pos-scanner", openScanner);
    return () => window.removeEventListener("open-pos-scanner", openScanner);
  }, []);

  useEffect(() => {
    if (!scannerOpen) return;
    startCamera();
    return stopCamera;
  }, [scannerOpen]);

  // Load products when search changes (debounced)
  const activeVendorId = user?.vendorId || pos.store?.id;

  useEffect(() => {
    if (!activeVendorId) return;
    const timer = setTimeout(() => {
      loadProducts(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, activeVendorId]);

  async function loadProducts(query: string) {
    if (!activeVendorId) return;
    setSearchLoading(true);
    try {
      const data = await api.getProducts({
        vendorId: activeVendorId,
        search: query || undefined,
        limit: 30,
      });
      const list = Array.isArray(data) ? data : (data.products || data.data || []);
      setProducts(list.filter((p: Product) => p.stock > 0));
    } catch {
      // silently fail
    } finally {
      setSearchLoading(false);
    }
  }

  // Barcode scanner: most scanners send chars rapidly then Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        paymentRefs.current[paymentMethod]?.focus();
        return;
      }
      if (e.key === "Enter") {
        const buf = barcodeBuffer.current.trim();
        if (buf.length >= 4 && buf !== search) {
          // Try barcode lookup
          handleBarcodeSearch(buf);
        }
        barcodeBuffer.current = "";
        return;
      }
      // Accumulate
      barcodeBuffer.current += e.key;
      if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
      barcodeTimer.current = setTimeout(() => {
        barcodeBuffer.current = "";
      }, 100);
    },
    [cart.length, paymentMethod, search]
  );

  function handlePaymentKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, method: PaymentMethod) {
    const methods = Object.keys(PAYMENT_LABELS) as PaymentMethod[];
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const currentIndex = methods.indexOf(method);
    let nextIndex = currentIndex;
    if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = methods.length - 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextIndex = (currentIndex - 1 + methods.length) % methods.length;
    else nextIndex = (currentIndex + 1) % methods.length;
    const nextMethod = methods[nextIndex];
    setPaymentMethod(nextMethod);
    paymentRefs.current[nextMethod]?.focus();
  }

  async function handleBarcodeSearch(barcode: string) {
    if (!activeVendorId) return false;
    try {
      const data = await api.getProducts({
        vendorId: activeVendorId,
        barcode,
        limit: 5,
      });
      const list = Array.isArray(data) ? data : (data.products || data.data || []);
      if (list.length === 1) {
        addToCart(list[0]);
        setSearch("");
        return true;
      } else if (list.length > 1) {
        setProducts(list);
        return true;
      }
    } catch {
      // silently fail
    }
    return false;
  }

  async function startCamera() {
    setScanError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError("La cámara no está disponible en este navegador. Ingresa el código manualmente.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScannerActive(true);
      if ("BarcodeDetector" in window) detectBarcode();
    } catch {
      setScanError("No fue posible abrir la cámara. Revisa el permiso o ingresa el código manualmente.");
    }
  }

  function stopCamera() {
    if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
    scanFrameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScannerActive(false);
  }

  async function detectBarcode() {
    if (!videoRef.current || !streamRef.current) return;
    try {
      const detector = new (window as any).BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
      });
      const codes = await detector.detect(videoRef.current);
      if (codes.length > 0) {
        const found = await handleBarcodeSearch(codes[0].rawValue);
        if (found) {
          closeScanner();
          return;
        }
        setScanError(`No encontramos el código ${codes[0].rawValue} en los productos de tu tienda.`);
      }
    } catch {
      // Continue scanning; some frames cannot be decoded.
    }
    scanFrameRef.current = requestAnimationFrame(detectBarcode);
  }

  function closeScanner() {
    stopCamera();
    setScannerOpen(false);
    setManualBarcode("");
    window.history.replaceState({}, "", "/dashboard/pos");
  }

  async function submitManualBarcode() {
    const code = manualBarcode.trim();
    if (!code) return;
    setScanError("");
    const found = await handleBarcodeSearch(code);
    if (found) closeScanner();
    else setScanError(`No encontramos el código ${code} en los productos de tu tienda.`);
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    searchRef.current?.focus();
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product.id !== productId) return i;
          const newQty = i.quantity + delta;
          if (newQty <= 0) return null as any;
          if (newQty > i.product.stock) return i;
          return { ...i, quantity: newQty };
        })
        .filter(Boolean)
    );
  }

  const subtotal = cart.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );
  const total = subtotal;
  const change =
    paymentMethod === "efectivo" && receivedAmount
      ? Number(receivedAmount) - total
      : null;

  async function handleCheckout() {
    if (cart.length === 0) return;
    setError("");
    setLoading(true);
    try {
      const order = await api.createPosOrder({
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: Number(i.quantity),
          price: Number(i.product.price),
        })),
        paymentMethod,
        subtotal: Number(subtotal),
        total: Number(total),
        receivedAmount: receivedAmount ? Number(receivedAmount) : undefined,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        notes: notes || undefined,
      }, pos.token, pos.shift.id);
      setCompletedOrder({
        ...order,
        change,
        paymentMethodLabel: PAYMENT_LABELS[paymentMethod],
        customerName,
        items: cart.map((i) => ({
          title: i.product.title,
          artist: i.product.artist,
          quantity: i.quantity,
          price: i.product.price,
        })),
      });
      setCart([]);
      setReceivedAmount("");
      setCustomerName("");
      setCustomerEmail("");
      setNotes("");
      setSearch("");
    } catch (err: any) {
      setError(err.message || "Error al procesar la venta");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    if (!completedOrder) return;
    const items = completedOrder.items
      .map(
        (i: any) =>
          `<tr>
            <td style="padding:2px 0;">${i.artist ? `${i.artist} — ${i.title}` : i.title} x${i.quantity}</td>
            <td style="padding:2px 0;text-align:right;">${formatPrice(i.price * i.quantity)}</td>
          </tr>`
      )
      .join("");
    const change =
      completedOrder.change !== null && completedOrder.change >= 0
        ? `<tr><td style="color:#16a34a;">Vuelto</td><td style="text-align:right;color:#16a34a;">${formatPrice(completedOrder.change)}</td></tr>`
        : "";
    const customer = completedOrder.customerName
      ? `<p style="margin:4px 0;"><b>Cliente:</b> ${completedOrder.customerName}</p>`
      : "";
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Boleta #${completedOrder.orderNumber}</title>
<style>
  body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 8px; }
  h2 { text-align: center; margin: 0 0 4px; font-size: 14px; }
  p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .total { font-weight: bold; font-size: 14px; }
  .right { text-align: right; }
</style>
</head><body>
<h2>Boleta de Venta</h2>
<p style="text-align:center;">#${completedOrder.orderNumber}</p>
<p style="text-align:center;">${new Date().toLocaleString("es-CL")}</p>
${customer}
<hr/>
<table>${items}</table>
<hr/>
<table>
  <tr><td>Pago:</td><td class="right">${completedOrder.paymentMethodLabel}</td></tr>
  <tr class="total"><td>Total</td><td class="right">${formatPrice(completedOrder.total)}</td></tr>
  ${change}
</table>
<hr/>
<p style="text-align:center;">¡Gracias por su compra!</p>
</body></html>`;
    const win = window.open("", "_blank", "width=320,height=600");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  function closeModal() {
    setCompletedOrder(null);
    searchRef.current?.focus();
    loadProducts("");
  }

  const productImage = (p: Product) => {
    const raw = p.images?.[0] || p.imagen;
    return raw ? getImageUrl(raw) : null;
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col bg-slate-100 md:h-screen md:min-h-0">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-500 text-slate-950">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold sm:text-xl">Punto de Venta</h1>
              <span className="hidden rounded bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 sm:inline">Venta presencial</span>
            </div>
            <p className="text-xs text-slate-400">Caja de la tienda</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden text-right md:block"><p className="text-xs font-semibold">{pos.shift.register?.name} · {pos.staff.name}</p><p className="text-[11px] text-slate-400">Turno abierto</p></div>
          <button type="button" onClick={pos.requestClose} className="rounded-md border border-rose-400/60 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10">Cerrar caja</button>
          <button type="button" onClick={pos.logout} title="Cambiar cajero" className="grid h-9 w-9 place-items-center rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800"><LogOut className="h-4 w-4" /></button>
          <Link href="/dashboard" className="hidden items-center gap-2 rounded-md border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 sm:flex">
            <ArrowLeft className="h-4 w-4" /><span>Dashboard</span>
          </Link>
        </div>
      </div>

      {scannerOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-emerald-600" />
                <h2 className="font-semibold text-gray-900">Escanear para la venta</h2>
              </div>
              <button type="button" onClick={closeScanner} aria-label="Cerrar escáner" className="grid h-9 w-9 place-items-center rounded-md text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-900">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                {scannerActive && hasBarcodeDetector && (
                  <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                )}
                {!scannerActive && (
                  <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-white">Preparando cámara...</div>
                )}
              </div>
              <p className="text-center text-sm text-gray-600">
                Apunta al código de barras. El producto se agregará directamente a la venta.
              </p>
              {!hasBarcodeDetector && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Este navegador no detecta códigos automáticamente. Puedes escribir el número debajo.
                </p>
              )}
              {scanError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{scanError}</p>}
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualBarcode}
                  onChange={(event) => setManualBarcode(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && submitManualBarcode()}
                  placeholder="Código de barras"
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
                <button type="button" onClick={submitManualBarcode} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-visible lg:flex-row lg:overflow-hidden">
        {/* LEFT — Product search */}
        <div className="flex max-h-[58vh] w-full flex-col overflow-hidden border-b border-slate-300 bg-slate-50 lg:max-h-none lg:w-3/5 lg:border-b-0 lg:border-r">
          {/* Search bar */}
          <div className="border-b border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar producto o escanear código de barras..."
                className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <button type="button" onClick={() => setScannerOpen(true)} className="hidden items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 sm:flex">
              <ScanBarcode className="h-5 w-5" />
              Escanear
            </button>
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {products.length === 0 && !searchLoading && (
              <p className="text-center text-gray-400 mt-12 text-sm">
                {search ? "No se encontraron productos" : "Busca un producto para comenzar"}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
              {products.map((p) => {
                const img = productImage(p);
                const inCart = cart.find((i) => i.product.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={inCart ? inCart.quantity >= p.stock : false}
                    className="flex flex-col rounded-md border border-slate-200 bg-white p-2 text-left transition-all hover:border-emerald-500 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:p-3"
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={p.title}
                        className="mb-2 aspect-square w-full rounded object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex aspect-square w-full items-center justify-center rounded bg-gray-100 text-gray-300">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight mb-1">
                      {p.artist || p.title}
                      {p.artist && <span className="block text-gray-500 font-normal">{p.title}</span>}
                    </p>
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatPrice(p.price)}
                      </span>
                      <span className="text-xs text-gray-400">Stock: {p.stock}</span>
                    </div>
                    {inCart && (
                      <div className="mt-1 text-xs font-medium text-emerald-700">
                        En carrito: {inCart.quantity}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT — Cart */}
        <div className="flex w-full flex-col bg-white lg:w-2/5 lg:overflow-hidden">
          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Venta actual
              {cart.length > 0 && (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                  {cart.reduce((s, i) => s + i.quantity, 0)} items
                </span>
              )}
            </h2>

            {cart.length === 0 ? (
              <p className="text-center text-gray-400 text-sm mt-8">
                Agrega productos desde la lista
              </p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center gap-2 border-b border-gray-100 py-2 sm:gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.product.artist || item.product.title}
                      </p>
                      {item.product.artist && (
                        <p className="text-xs text-gray-500 truncate">{item.product.title}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {formatPrice(item.product.price)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock}
                        className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-16 text-right sm:w-20">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatPrice(item.product.price * item.quantity)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom panel: totals + payment */}
          <div className="space-y-4 border-t border-gray-200 bg-slate-50 p-3 sm:p-4">
            {/* Customer (optional) */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                tabIndex={-1}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre cliente (opcional)"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                tabIndex={-1}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Email (opcional)"
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="text-base font-semibold text-gray-700">Total</span>
              <span className="text-2xl font-bold text-gray-900">{formatPrice(total)}</span>
            </div>

            {/* Payment method */}
            <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  ref={(element) => { paymentRefs.current[m] = element; }}
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === m}
                  tabIndex={paymentMethod === m ? 0 : -1}
                  onClick={() => setPaymentMethod(m)}
                  onKeyDown={(e) => handlePaymentKeyDown(e, m)}
                  className={`rounded-lg border py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                    paymentMethod === m
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:border-emerald-400"
                  }`}
                >
                  {PAYMENT_LABELS[m]}
                </button>
              ))}
            </div>

            {/* Received amount (only for cash) */}
            {paymentMethod === "efectivo" && (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder="Monto recibido"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  />
                </div>
                {change !== null && change >= 0 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Vuelto</p>
                    <p className="text-lg font-bold text-green-600">{formatPrice(change)}</p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Cobrar button */}
            <button
              type="button"
              onClick={handleCheckout}
              onKeyDown={(e) => {
                if (e.key === "Tab" && !e.shiftKey) {
                  e.preventDefault();
                  searchRef.current?.focus();
                }
              }}
              disabled={cart.length === 0 || loading}
              className="w-full rounded-md bg-emerald-600 py-3.5 text-base font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:bg-gray-300"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Procesando...
                </span>
              ) : (
                `Cobrar ${cart.length > 0 ? formatPrice(total) : ""}`
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
            <div className="p-6 print:p-4">
              {/* Success icon */}
              <div className="flex flex-col items-center mb-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-900">¡Venta completada!</p>
                <p className="text-sm text-gray-500">Orden #{completedOrder.orderNumber}</p>
              </div>

              {/* Receipt */}
              <div className="border-t border-dashed border-gray-300 pt-4">
                <p className="text-center text-xs text-gray-400 mb-3">
                  {new Date().toLocaleString("es-CL")}
                </p>
                {completedOrder.customerName && (
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Cliente:</span> {completedOrder.customerName}
                  </p>
                )}
                <div className="space-y-1.5 mb-4">
                  {completedOrder.items.map((i: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-700 flex-1 mr-2 truncate">
                        {i.artist || i.title}
                        {i.artist && ` — ${i.title}`}
                        {" "}× {i.quantity}
                      </span>
                      <span className="text-gray-900 font-medium whitespace-nowrap">
                        {formatPrice(i.price * i.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-dashed border-gray-300 pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pago:</span>
                    <span className="text-gray-900">{completedOrder.paymentMethodLabel}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>{formatPrice(completedOrder.total)}</span>
                  </div>
                  {completedOrder.change !== null && completedOrder.change >= 0 && (
                    <div className="flex justify-between text-sm text-green-700 font-medium">
                      <span>Vuelto</span>
                      <span>{formatPrice(completedOrder.change)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Imprimir
                </button>
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Nueva venta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

export default function PosPage() {
  return <PosSessionGate>{(pos) => <PosWorkspace pos={pos} />}</PosSessionGate>;
}
