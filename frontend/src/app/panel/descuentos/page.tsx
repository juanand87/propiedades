"use client";

import { useEffect, useState } from "react";
import { Plus, TicketPercent } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const initial = {
  name: "",
  code: "",
  percentage: 10,
  vendorId: "",
  categoryIds: [] as string[],
  genreIds: [] as string[],
  minPurchase: 0,
  maxDiscount: "",
  maxUses: 100,
  startsAt: "",
  expiresAt: "",
  status: "active",
};
export default function DiscountsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = () => api.get("/discounts/admin").then(setRows);
  useEffect(() => {
    Promise.all([
      load(),
      api.getCategories().then(setCategories),
      api
        .getGenres()
        .then((data) =>
          setGenres(
            data.map((genre: any) => ({ ...genre, id: String(genre.id) })),
          ),
        ),
      api.get("/vendors").then(setVendors),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.post("/discounts/admin", {
        ...form,
        startsAt: form.startsAt
          ? new Date(form.startsAt).toISOString()
          : undefined,
        expiresAt: new Date(form.expiresAt).toISOString(),
      });
      await load();
      setOpen(false);
      setForm(initial);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(row: any) {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/discounts/admin/${row.id}/status`, {
        status: row.status === "active" ? "disabled" : "active",
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const state = (row: any) =>
    row.status === "draft"
      ? "Borrador"
      : row.status !== "active"
        ? "Deshabilitado"
        : new Date(row.expiresAt) < new Date()
          ? "Vencido"
          : row.uses >= row.maxUses
            ? "Agotado"
            : new Date(row.startsAt) > new Date()
              ? "Programado"
              : "Activo";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <TicketPercent className="h-6 w-6" />
          Descuentos
        </h1>
        <Button
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Crear descuento
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              {[
                "Campaña / código",
                "Descuento",
                "Alcance",
                "Usos",
                "Vencimiento",
                "Estado",
                "Acción",
              ].map((label) => (
                <th key={label} className="p-4 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="p-4">
                  <p className="font-semibold">{row.name}</p>
                  <code className="text-xs text-slate-500">{row.code}</code>
                  {row.reviewId && (
                    <p className="text-xs text-cyan-700">
                      Compensación individual
                    </p>
                  )}
                </td>
                <td className="p-4">{row.percentage}%</td>
                <td className="p-4">
                  {vendors.find((v) => v.id === row.vendorId)?.storeName ||
                    "Todas las tiendas"}
                  <p className="text-xs text-slate-500">
                    {[
                      ...row.categoryIds.map(
                        (id: string) =>
                          categories.find((c) => c.id === id)?.name,
                      ),
                      ...row.genreIds.map(
                        (id: string) => genres.find((g) => g.id === id)?.name,
                      ),
                    ]
                      .filter(Boolean)
                      .join(", ") || "Todo el catálogo"}
                  </p>
                </td>
                <td className="p-4">
                  {row.uses} / {row.maxUses}
                </td>
                <td className="p-4">
                  {new Date(row.expiresAt).toLocaleDateString("es-CL")}
                </td>
                <td className="p-4">{state(row)}</td>
                <td className="p-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => changeStatus(row)}
                  >
                    {row.status === "active" ? "Deshabilitar" : "Activar"}
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-slate-500">
                  {loading
                    ? "Cargando descuentos..."
                    : "Aún no hay descuentos."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear descuento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discount-name">Nombre</Label>
              <Input
                id="discount-name"
                value={form.name}
                maxLength={150}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-code">Código (opcional)</Label>
              <Input
                id="discount-code"
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-percent">Porcentaje</Label>
              <select
                id="discount-percent"
                className="h-10 w-full rounded border px-3"
                value={form.percentage}
                onChange={(e) =>
                  setForm({ ...form, percentage: Number(e.target.value) })
                }
              >
                {[10, 20, 30, 40].map((n) => (
                  <option key={n} value={n}>
                    {n}%
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-vendor">Tienda que financia</Label>
              <select
                id="discount-vendor"
                className="h-10 w-full rounded border px-3"
                value={form.vendorId}
                onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
              >
                <option value="">Cada tienda participante</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.storeName}
                  </option>
                ))}
              </select>
            </div>
            {(
              [
                ["categoryIds", "Categorías", categories],
                ["genreIds", "Géneros", genres],
              ] as const
            ).map(([key, label, options]) => (
              <fieldset key={key} className="min-w-0 rounded border p-3">
                <legend className="px-1 text-sm font-medium">{label}</legend>
                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {options.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form[key].includes(option.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            [key]: e.target.checked
                              ? [...form[key], option.id]
                              : form[key].filter((id) => id !== option.id),
                          })
                        }
                      />
                      {option.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="space-y-2">
              <Label htmlFor="discount-min">Compra mínima ($)</Label>
              <Input
                id="discount-min"
                type="number"
                min={0}
                value={form.minPurchase}
                onChange={(e) =>
                  setForm({ ...form, minPurchase: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-max">
                Descuento máximo ($, opcional)
              </Label>
              <Input
                id="discount-max"
                type="number"
                min={1}
                value={form.maxDiscount}
                onChange={(e) =>
                  setForm({ ...form, maxDiscount: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-uses">Cantidad máxima de usos</Label>
              <Input
                id="discount-uses"
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) =>
                  setForm({ ...form, maxUses: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-status">Estado inicial</Label>
              <select
                id="discount-status"
                className="h-10 w-full rounded border px-3"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Activo</option>
                <option value="draft">Borrador</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-start">Inicio (opcional)</Label>
              <Input
                id="discount-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-end">Vencimiento</Label>
              <Input
                id="discount-end"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm({ ...form, expiresAt: e.target.value })
                }
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Un uso por comprador, sin incluir envío. Si seleccionas categoría y
            género, el producto debe cumplir ambos criterios. Los códigos se
            reservan al crear el pedido.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button
            disabled={busy || !form.name.trim() || !form.expiresAt}
            onClick={save}
          >
            {busy ? "Guardando..." : "Guardar descuento"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
