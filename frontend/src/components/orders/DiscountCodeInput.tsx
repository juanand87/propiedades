"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TicketPercent, X } from "lucide-react";

export type AppliedDiscount = {
  code: string;
  discountAmount: number;
  fingerprint: string;
};
export function discountFingerprint(
  vendorId: string,
  email: string,
  items: any[],
) {
  return JSON.stringify([
    vendorId,
    email.trim().toLowerCase(),
    items
      .map((i) => [i.productId, i.quantity, i.price])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ]);
}
export function DiscountCodeInput({
  vendorId,
  email,
  items,
  applied,
  excludedCodes = [],
  onChange,
}: {
  vendorId: string;
  email: string;
  items: any[];
  applied?: AppliedDiscount;
  excludedCodes?: string[];
  onChange: (value: AppliedDiscount | undefined) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fingerprint = discountFingerprint(vendorId, email, items);
  const active = applied?.fingerprint === fingerprint ? applied : undefined;
  async function apply() {
    setBusy(true);
    setError("");
    try {
      const quote = await api.post(
        "/discounts/validate",
        {
          code,
          email,
          vendorId,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
        false,
      );
      if (excludedCodes.includes(quote.code))
        throw new Error("Aplica este código en una sola tienda por compra.");
      onChange({
        code: quote.code,
        discountAmount: quote.discountAmount,
        fingerprint,
      });
    } catch (e: any) {
      setError(e.message);
      onChange(undefined);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 border-t pt-3">
      <Label
        htmlFor={`coupon-${vendorId}`}
        className="flex items-center gap-2 text-sm"
      >
        <TicketPercent className="h-4 w-4" />
        Código de descuento
      </Label>
      {active ? (
        <div className="flex items-center justify-between gap-2 text-sm text-emerald-700">
          <span>
            {active.code}: -${active.discountAmount.toLocaleString("es-CL")}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Quitar descuento"
            onClick={() => onChange(undefined)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            id={`coupon-${vendorId}`}
            value={code}
            maxLength={60}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || !code.trim() || !email.trim()}
            onClick={apply}
          >
            {busy ? "..." : "Aplicar"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
