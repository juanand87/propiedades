"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Disc3,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import InventoryCamera from "@/components/admin/InventoryCamera";
import InventoryPhoto from "@/components/admin/InventoryPhoto";
import {
  inventoryRequest as request,
  inventoryStatuses,
  inventoryButton as button,
  inventoryPrimary as primary,
  inventoryInput as input,
  inventoryWouldExceedStock,
} from "@/lib/inventory";

export default function InventoryDetail({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId: id } = use(params);
  const router = useRouter();
  const base = `sessions/${id}`;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("scan"),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(1),
    [listSearch, setListSearch] = useState("");
  const [term, setTerm] = useState(""),
    [matches, setMatches] = useState<any[] | null>(null);
  const [countedResults, setCountedResults] = useState<Set<string>>(new Set());
  const [unknown, setUnknown] = useState<{
    title: string;
    barcode: string;
    quantity: number;
    note: string;
    file?: File;
  } | null>(null);
  const [note, setNote] = useState<any>(null),
    [confirm, setConfirm] = useState("");
  const [linking, setLinking] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<Record<string, string>>({});
  const pending = useRef<{
    key: string;
    requestId: string;
    product: any;
    mode: "add" | "set" | "add-stock";
    amount: number;
  } | null>(null);
  const [hasPendingCount, setHasPendingCount] = useState(false);
  const foundRequest = useRef<string | null>(null);
  const createRequest = useRef<string | null>(null);
  const productsSearch = useRef<HTMLInputElement>(null);
  const loadVersion = useRef(0);
  const locked = useRef(false),
    returnHandled = useRef(false);
  const closed = data && !["counting", "review"].includes(data.session.status);
  const ready = !!data;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("review") === "1") {
      setTab("products");
      setFilter("differences");
    }
  }, []);
  useEffect(() => {
    if (tab !== "products" || !ready) return;
    setListSearch("");
    setPage(1);
    const frame = requestAnimationFrame(() => productsSearch.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [tab, ready]);
  function selectTab(next: string) {
    setTab(next);
    if (next === "products") {
      setListSearch("");
      setPage(1);
      requestAnimationFrame(() => productsSearch.current?.focus());
    }
  }
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`inventory-pending-${id}`);
      if (stored) {
        pending.current = JSON.parse(stored);
        setHasPendingCount(true);
      }
    } catch {
      /* Counting remains available if storage is disabled. */
    }
  }, [id]);
  function savePending(value: typeof pending.current) {
    pending.current = value;
    setHasPendingCount(!!value);
    try {
      if (value)
        sessionStorage.setItem(
          `inventory-pending-${id}`,
          JSON.stringify(value),
        );
      else sessionStorage.removeItem(`inventory-pending-${id}`);
    } catch {
      /* Server-side request identifiers still prevent retry duplication. */
    }
  }
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const result = await request(
      `${base}?${new URLSearchParams({ filter, page: String(page), search: listSearch })}`,
    );
    if (version === loadVersion.current) setData(result);
  }, [base, filter, page, listSearch]);
  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search),
      productId = query.get("createdProduct"),
      foundId = query.get("found");
    if (!productId || !foundId || returnHandled.current) return;
    returnHandled.current = true;
    request(`${base}/found/${foundId}`, "PATCH", { productId })
      .then(async () => {
        window.history.replaceState(null, "", window.location.pathname);
        setNotice(
          `Producto registrado y agregado al conteo.${query.get("gradeWarning") ? " Revisa la condición del disco y funda en su ficha: esa actualización no pudo guardarse." : ""}`,
        );
        await load();
      })
      .catch((e) => {
        setError(
          `${e.message}. Recarga para reintentar la vinculación; no vuelvas a crear el producto.`,
        );
        returnHandled.current = false;
      });
  }, [base, load]);
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e: any) {
      setError(e.message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function search(value = term) {
    if (!value.trim()) return;
    setTerm(value);
    await run(async () => {
      setMatches(
        await request(`${base}/search?term=${encodeURIComponent(value)}`),
      );
    });
  }
  async function count(product: any, mode: "add" | "set" | "add-stock", amount: number) {
    if (mode !== "set" && countedResults.has(product.id) && !pending.current) return;
    if (!Number.isSafeInteger(amount) || amount < 0) {
      setError("Ingresa una cantidad entera igual o mayor que cero.");
      return;
    }
    const key = `${product.id}:${mode}:${amount}`;
    if (pending.current && pending.current.key !== key) {
      setError(
        "Reintenta primero la lectura anterior para evitar duplicar el conteo.",
      );
      return;
    }
    await run(async () => {
      if (!pending.current)
        savePending({
          key,
          requestId: crypto.randomUUID(),
          product: { id: product.id, title: product.title },
          mode,
          amount,
        });
      try {
        const savedLine = await request(`${base}/count`, "POST", {
          productId: product.id,
          mode,
          quantity: amount,
          requestId: pending.current!.requestId,
        });
        if (mode !== "set")
          setCountedResults((current) => new Set(current).add(product.id));
        setMatches(
          (current) =>
            current?.map((item) =>
              item.id === product.id
                ? { ...item, inventoryCount: savedLine.counted, stock: savedLine.stock ?? item.stock }
                : item,
            ) ?? null,
        );
      } catch (e: any) {
        if (e.status >= 400 && e.status < 500) savePending(null);
        throw e;
      }
      savePending(null);
      setQuantity((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setNotice(
        `${product.title}: ${mode === "add-stock" ? "1 unidad contada y agregada al stock online." : mode === "add" ? `+${amount}` : `${amount} unidades contadas`}`,
      );
      await load();
    });
  }
  async function review(productId: string, values: any) {
    if (locked.current) return;
    if (typeof values.selected === "boolean")
      setData((current: any) => ({
        ...current,
        lines: current.lines.map((line: any) =>
          line.productId === productId
            ? { ...line, selected: values.selected }
            : line,
        ),
      }));
    await run(async () => {
      try {
        await request(`${base}/lines/${productId}`, "PATCH", values);
        if (values.apply) {
          setNotice("Diferencia aplicada al stock online. Sincronización de canales en segundo plano.");
          setMatches(null);
        }
      } finally {
        await load();
      }
    });
  }
  async function status(value: string) {
    await run(async () => {
      const result = await request(`${base}/status`, "PATCH", {
        status: value,
      });
      setConfirm("");
      setNotice(
        value === "completed"
          ? `Conteo finalizado. ${result.adjusted} ajustes aplicados.${result.queued ? " Sincronización de canales en segundo plano." : ""}`
          : "Estado actualizado.",
      );
      await load();
      if (value === "review") {
        setTab("products");
        setFilter("differences");
        setPage(1);
      }
    });
  }
  async function saveUnknown(e: React.FormEvent) {
    e.preventDefault();
    if (!unknown) return;
    await run(async () => {
      const body = new FormData();
      if (!foundRequest.current) foundRequest.current = crypto.randomUUID();
      body.append("requestId", foundRequest.current);
      body.append("title", unknown.title);
      body.append("barcode", unknown.barcode);
      body.append("quantity", String(unknown.quantity));
      body.append("note", unknown.note);
      if (unknown.file) body.append("photo", unknown.file);
      await request(`${base}/found`, "POST", body);
      foundRequest.current = null;
      setUnknown(null);
      setTab("found");
      await load();
    });
  }
  async function linkProduct(productId: string) {
    await run(async () => {
      await request(`${base}/found/${linking}`, "PATCH", { productId });
      setLinking(null);
      setMatches(null);
      setTab("found");
      await load();
    });
  }
  async function addProduct() {
    await run(async () => {
      if (!createRequest.current) createRequest.current = crypto.randomUUID();
      const barcode = /^\d{8,14}$/.test(term.trim()) ? term.trim() : "";
      const found = await request(`${base}/found`, "POST", {
        requestId: createRequest.current,
        quantity: 1,
        barcode,
        title: barcode
          ? "Producto sin identificar"
          : term.trim() || "Producto sin identificar",
        note: "Alta desde revisión de inventario",
      });
      router.push(
        `/dashboard/escanear?inventorySession=${id}&inventoryFound=${found.id}&barcode=${encodeURIComponent(barcode)}&entry=scan`,
      );
    });
  }
  if (!data)
    return (
      <div className="space-y-4">
        <Link href="/dashboard/inventario" className={button}>
          <ArrowLeft size={16} />
          Inventario
        </Link>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/inventario"
            className="mb-2 inline-flex items-center gap-1 text-sm text-cyan-700"
          >
            <ArrowLeft size={16} />
            Inventario
          </Link>
          <h1 className="break-words text-xl font-semibold">
            {data.session.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {inventoryStatuses[data.session.status]} ·{" "}
            {new Date(data.session.createdAt).toLocaleString("es-CL")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={button}
            title="Actualizar"
            disabled={busy}
            onClick={() => run(load)}
          >
            <RefreshCw size={17} />
          </button>
          {!closed && (
            <>
              <button
                className={`${primary} h-11 w-11 p-0`}
                title="Agregar producto"
                aria-label="Agregar producto"
                disabled={busy}
                onClick={addProduct}
              >
                <Plus size={23} />
              </button>
              {data.session.status === "review" && (
                <>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => status("counting")}
                  >
                    Seguir contando
                  </button>
                  <button
                    className={primary}
                    disabled={busy}
                    onClick={() => setConfirm("completed")}
                  >
                    <Check size={16} />
                    Finalizar conteo
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {hasPendingCount && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            Lectura pendiente de confirmación: {pending.current?.product.title}
          </span>
          <button
            className={button}
            disabled={busy}
            onClick={() => {
              const item = pending.current;
              if (item) count(item.product, item.mode, item.amount);
            }}
          >
            Reintentar lectura
          </button>
        </div>
      )}
      <dl className="grid grid-cols-4 gap-px overflow-hidden border border-slate-200 bg-slate-200">
        {[
          [
            "Contados",
            "Contados",
            `${data.summary.counted} / ${data.summary.total}`,
          ],
          ["Diferencias", "Diferencias", data.summary.differences],
          [
            "Cambios por revisar",
            "Por revisar",
            closed ? 0 : data.summary.conflicts,
          ],
          ["Ajustes seleccionados", "Ajustes", data.summary.selected],
        ].map(([label, shortLabel, value]) => (
          <div
            key={String(label)}
            className="min-w-0 bg-white px-2 py-2 sm:p-3"
          >
            <dt
              title={String(label)}
              className="text-[11px] leading-4 text-slate-500 sm:text-xs"
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </dt>
            <dd className="mt-0.5 break-words text-base font-semibold leading-6 tabular-nums sm:text-lg">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {closed && data.syncJobs?.length > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 bg-white p-3 text-sm">
          <span>
            Sincronización:{" "}
            {
              data.syncJobs.filter((job: any) => job.status === "processed")
                .length
            }{" "}
            procesados ·{" "}
            {
              data.syncJobs.filter((job: any) =>
                ["pending", "processing"].includes(job.status),
              ).length
            }{" "}
            pendientes ·{" "}
            {data.syncJobs.filter((job: any) => job.status === "failed").length}{" "}
            con error
          </span>
          {data.syncJobs.some((job: any) => job.status === "failed") && (
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await request(`${base}/sync-retry`, "POST", {});
                  await load();
                })
              }
            >
              <RefreshCw size={16} />
              Reintentar sincronización
            </button>
          )}
        </section>
      )}
      <nav
        className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-2 sm:flex"
        aria-label="Secciones del conteo"
      >
        {[
          ["scan", "Escanear y buscar"],
          ["products", "Productos"],
          [
            "found",
            `Sin ficha (${data.found.filter((f: any) => f.status === "pending").length})`,
          ],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            className={`h-14 min-w-0 rounded-md border px-2 py-2 text-sm font-semibold leading-5 transition-colors sm:h-11 sm:px-3 ${tab === key ? "border-cyan-700 bg-cyan-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-cyan-50"}`}
            onClick={() => selectTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "scan" && (
        <section className="space-y-4">
          {linking && (
            <div className="flex items-center justify-between border border-amber-200 bg-amber-50 p-3 text-sm">
              Selecciona el producto para vincular el registro sin ficha.
              <button
                title="Cancelar vinculación"
                className={button}
                onClick={() => setLinking(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <input
              aria-label="Código, SKU o título"
              autoFocus
              className={`${input} flex-1 basis-52`}
              placeholder="Código, SKU o título"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button type="submit" disabled={busy} className={primary}>
              <Search size={17} />
              Buscar
            </button>
          </form>
          {!closed && (
            <div className="grid grid-cols-2 items-start gap-3 sm:max-w-xl">
              <InventoryCamera onRead={(code) => {
                setCountedResults(new Set());
                search(code);
              }} />
              <InventoryPhoto
                sessionId={id}
                onSelect={(product) => {
                  setCountedResults(new Set());
                  setMatches([product]);
                }}
                onUnknown={(file) =>
                  setUnknown({
                    title: "",
                    barcode: term,
                    quantity: 1,
                    note: "",
                    file,
                  })
                }
              />
              <button
                className={`${button} col-span-2 min-h-11 justify-self-start`}
                onClick={() =>
                  setUnknown({
                    title: "",
                    barcode: term,
                    quantity: 1,
                    note: "",
                  })
                }
              >
                <Plus size={16} />
                Registrar sin ficha
              </button>
            </div>
          )}
          {matches?.length === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-4">
              <p className="text-sm text-slate-600">
                No hay coincidencias en esta tienda.
              </p>
              {!closed && (
                <button
                  className={primary}
                  disabled={busy}
                  onClick={addProduct}
                >
                  <Plus size={18} />
                  Crear producto
                </button>
              )}
            </div>
          )}
          <div className="divide-y divide-slate-200 border-slate-200">
            {matches?.map((product) => {
              const counted = Number(
                product.inventoryCount ??
                  data.lines.find((line: any) => line.productId === product.id)
                    ?.counted ??
                  0,
              );
              const needsStock = inventoryWouldExceedStock(
                product.stock,
                counted,
              );
              return (
                <article
                  key={product.id}
                  className="flex flex-wrap items-center gap-3 bg-white p-3"
                >
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt=""
                      className="h-16 w-16 shrink-0 object-cover"
                    />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center bg-slate-100 text-slate-400">
                      <Disc3 size={28} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 basis-40">
                    <h2 className="break-words text-sm font-semibold">
                      {product.title}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {product.sku} · {product.format} · {product.condition} ·{" "}
                      {product.mediaGrade}
                    </p>
                    <p className="text-xs text-slate-500">
                      Stock online: {product.stock}
                      {product.status !== "active" ? " · Inactivo" : ""}
                    </p>
                    <p
                      className={`text-xs ${counted > Number(product.stock) ? "font-medium text-red-700" : "text-slate-500"}`}
                    >
                      Contados: {counted}
                    </p>
                  </div>
                  {!closed &&
                    (linking ? (
                      <button
                        className={primary}
                        disabled={busy}
                        onClick={() => linkProduct(product.id)}
                      >
                        Vincular y contar
                      </button>
                    ) : (
                      <button
                        className={
                          needsStock
                            ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                            : `${primary} min-h-11`
                        }
                        disabled={busy || countedResults.has(product.id)}
                        onClick={() => count(product, needsStock ? "add-stock" : "add", 1)}
                      >
                        <Plus size={16} />
                        {countedResults.has(product.id) ? "Contado" : needsStock ? "Contar y agregar stock" : "Contar 1"}
                      </button>
                    ))}
                </article>
              );
            })}
          </div>
        </section>
      )}
      {tab === "products" && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Filtrar productos"
              ref={productsSearch}
              className={`${input} flex-1 basis-48`}
              placeholder="Título, código o SKU"
              value={listSearch}
              onChange={(e) => {
                setListSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Filtrar diferencias"
              className={`${input} sm:max-w-56`}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="uncounted">Sin contar</option>
              <option value="differences">Con diferencias</option>
              <option value="conflicts">Cambios por revisar</option>
            </select>
          </div>
          <div className="overflow-x-auto border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Producto",
                    "Stock inicial / actual",
                    "Contado",
                    "Diferencia",
                    "Ajustar",
                    "",
                  ].map((label, i) => (
                    <th key={i} className="p-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line: any) => (
                  <tr key={line.id} className="border-t border-slate-200">
                    <td className="min-w-52 p-3">
                      <div className="font-medium">
                        {line.product?.title || "Producto eliminado"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {line.product?.sku}
                      </div>
                      {!closed && line.counted !== null && line.conflict && (
                        <div className="mt-1 text-xs text-amber-800">
                          Cambió durante el conteo
                        </div>
                      )}
                      {line.note && (
                        <div className="mt-1 max-w-xs break-words text-xs text-slate-500">
                          {line.note}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3">
                      {line.snapshotStock} / {line.product?.stock ?? "—"}
                    </td>
                    <td className="p-3">
                      {closed || (line.appliedStock !== null && !line.difference && !line.conflict) ? (
                        (line.counted ?? "Sin contar")
                      ) : (
                        <form
                          className="flex items-center gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const value = quantity[line.productId];
                            if (value === undefined || value === "") return;
                            count(line.product, "set", Number(value));
                          }}
                        >
                          <input
                            aria-label={`Cantidad contada de ${line.product?.title}`}
                            type="number"
                            min="0"
                            max="1000000"
                            step="1"
                            placeholder={
                              line.counted === null
                                ? "Sin contar"
                                : String(line.counted)
                            }
                            value={quantity[line.productId] ?? ""}
                            className="w-24 rounded border border-slate-300 p-2"
                            disabled={busy || !line.product}
                            onChange={(e) =>
                              setQuantity({
                                ...quantity,
                                [line.productId]: e.target.value,
                              })
                            }
                          />
                          <button
                            title="Guardar cantidad"
                            className={button}
                            disabled={busy || !line.product}
                          >
                            <Check size={16} />
                          </button>
                        </form>
                      )}
                    </td>
                    <td
                      className={`p-3 font-medium ${line.difference ? "text-amber-800" : "text-slate-500"}`}
                    >
                      {line.difference === null
                        ? "—"
                        : `${line.difference > 0 ? "+" : ""}${line.difference}`}
                    </td>
                    <td className="p-3">
                      {closed ? (
                        line.appliedStock !== null ? (
                          "Aplicado"
                        ) : (
                          "Sin ajuste"
                        )
                      ) : (
                        <input
                          aria-label={`Aplicar ajuste de ${line.product?.title}`}
                          type="checkbox"
                          checked={false}
                          disabled={
                            busy ||
                            line.counted === null ||
                            line.conflict ||
                            !line.difference
                          }
                          onChange={() =>
                            review(line.productId, {
                              apply: true,
                            })
                          }
                          className="h-4 w-4 accent-cyan-700"
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {!closed && (
                          <button
                            title="Nota"
                            className={button}
                            disabled={busy || !line.product}
                            onClick={() =>
                              setNote({
                                productId: line.productId,
                                value: line.note || "",
                              })
                            }
                          >
                            <MessageSquare size={16} />
                          </button>
                        )}
                        {!closed && line.conflict && line.product && (
                          <button
                            title="Revisar cambio"
                            disabled={busy}
                            className={button}
                            onClick={() => setConfirm(line.productId)}
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.lines.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                No hay productos en este filtro.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{data.total} productos</span>
            <div className="flex items-center gap-3">
              <button
                title="Anterior"
                disabled={page <= 1 || busy}
                className={button}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              {page} / {Math.max(1, Math.ceil(data.total / 50))}
              <button
                title="Siguiente"
                disabled={page * 50 >= data.total || busy}
                className={button}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}
      {tab === "found" && (
        <section className="divide-y border-y border-slate-200 bg-white">
          {data.found.map((found: any) => (
            <article
              key={found.id}
              className="flex flex-wrap items-center gap-3 p-3"
            >
              {found.photoUrl && (
                <img
                  src={found.photoUrl}
                  alt=""
                  className="h-16 w-16 object-cover"
                />
              )}
              <div className="min-w-0 flex-1 basis-48">
                <h2 className="break-words text-sm font-semibold">
                  {found.title}
                </h2>
                <p className="text-xs text-slate-500">
                  {found.barcode} · {found.quantity} unidades ·{" "}
                  {
                    {
                      pending: "Sin ficha",
                      linked: "Vinculado",
                      dismissed: "Descartado",
                    }[found.status as string]
                  }
                </p>
                <p className="break-words text-xs text-slate-500">
                  {found.note}
                </p>
              </div>
              {!closed && found.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    className={primary}
                    href={`/dashboard/escanear?inventorySession=${id}&inventoryFound=${found.id}&barcode=${encodeURIComponent(found.barcode || "")}`}
                  >
                    Crear producto
                  </Link>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setLinking(found.id);
                      setTerm(found.barcode || found.title);
                      setMatches(null);
                      setTab("scan");
                    }}
                  >
                    Vincular existente
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => setNote({ foundId: found.id, value: "" })}
                  >
                    Descartar
                  </button>
                </div>
              )}
            </article>
          ))}
          {!data.found.length && (
            <p className="p-8 text-center text-sm text-slate-500">
              No hay productos sin ficha.
            </p>
          )}
        </section>
      )}
      {unknown && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="found-title"
            className="w-full max-w-lg rounded-lg bg-white p-5"
          >
            <header className="mb-4 flex items-center justify-between">
              <h2 id="found-title" className="font-semibold">
                Producto sin ficha
              </h2>
              <button
                title="Cerrar"
                disabled={busy}
                className={button}
                onClick={() => setUnknown(null)}
              >
                <X size={18} />
              </button>
            </header>
            <form onSubmit={saveUnknown} className="space-y-3">
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <label className="block text-sm">
                Título
                <input
                  className={input}
                  required
                  maxLength={255}
                  value={unknown.title}
                  onChange={(e) =>
                    setUnknown({ ...unknown, title: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                Código (opcional)
                <input
                  className={input}
                  maxLength={150}
                  value={unknown.barcode}
                  onChange={(e) =>
                    setUnknown({ ...unknown, barcode: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                Unidades
                <input
                  className={input}
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  required
                  value={unknown.quantity}
                  onChange={(e) =>
                    setUnknown({ ...unknown, quantity: Number(e.target.value) })
                  }
                />
              </label>
              <label className="block text-sm">
                Nota
                <textarea
                  className={input}
                  maxLength={1000}
                  value={unknown.note}
                  onChange={(e) =>
                    setUnknown({ ...unknown, note: e.target.value })
                  }
                />
              </label>
              <button className={`${primary} w-full`} disabled={busy}>
                Guardar registro
              </button>
            </form>
          </section>
        </div>
      )}
      {note && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              note.foundId ? "Motivo del descarte" : "Nota de inventario"
            }
            className="w-full max-w-lg rounded-lg bg-white p-5"
          >
            <h2 className="mb-3 font-semibold">
              {note.foundId ? "Motivo del descarte" : "Nota de inventario"}
            </h2>
            {error && (
              <p role="alert" className="mb-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <textarea
              aria-label="Nota"
              className={input}
              maxLength={1000}
              value={note.value}
              onChange={(e) => setNote({ ...note, value: e.target.value })}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                className={button}
                disabled={busy}
                onClick={() => setNote(null)}
              >
                Cancelar
              </button>
              <button
                className={primary}
                disabled={busy || (!!note.foundId && !note.value.trim())}
                onClick={() =>
                  run(async () => {
                    await request(
                      note.foundId
                        ? `${base}/found/${note.foundId}`
                        : `${base}/lines/${note.productId}`,
                      "PATCH",
                      note.foundId
                        ? { dismiss: true, note: note.value }
                        : { note: note.value },
                    );
                    setNote(null);
                    await load();
                  })
                }
              >
                Guardar
              </button>
            </div>
          </section>
        </div>
      )}
      {confirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar operación"
            className="w-full max-w-lg rounded-lg bg-white p-5"
          >
            <h2 className="font-semibold">
              {confirm === "completed"
                ? "Finalizar y aplicar ajustes"
                : confirm === "cancelled"
                  ? "Cancelar conteo"
                  : "Revisar cambio de stock"}
            </h2>
            <p className="my-4 text-sm text-slate-600">
              {confirm === "completed"
                ? `Se aplicarán ${data.summary.selected} ajustes seleccionados. Los productos sin contar o sin seleccionar no cambiarán. Los registros sin ficha deben estar resueltos.`
                : confirm === "cancelled"
                  ? "El conteo se cerrará sin aplicar ajustes al stock."
                  : "Confirma que volviste a contar físicamente este producto. El stock actual será la nueva referencia; luego guarda la cantidad y selecciona el ajuste."}
            </p>
            {error && (
              <p role="alert" className="mb-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                className={button}
                disabled={busy}
                onClick={() => setConfirm("")}
              >
                Volver
              </button>
              <button
                className={primary}
                disabled={busy}
                onClick={() =>
                  ["completed", "cancelled"].includes(confirm)
                    ? status(confirm)
                    : run(async () => {
                        await request(`${base}/lines/${confirm}`, "PATCH", {
                          recheck: true,
                        });
                        setConfirm("");
                        await load();
                      })
                }
              >
                {busy ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
