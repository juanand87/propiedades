"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/api";

type RatingSummary = {
  average: number;
  count: number;
};

type Props = {
  vendorId: string;
  initialAverage?: number;
  initialCount?: number;
  compact?: boolean;
  className?: string;
};

export default function StoreRatingSummary({
  vendorId,
  initialAverage = 0,
  initialCount = 0,
  compact = false,
  className = "",
}: Props) {
  const [summary, setSummary] = useState<RatingSummary>({
    average: Number(initialAverage || 0),
    count: Number(initialCount || 0),
  });

  useEffect(() => {
    if (!vendorId) return;
    api.get(`/reviews/vendor/${vendorId}/summary`, false)
      .then((result) => setSummary({
        average: Number(result.average || 0),
        count: Number(result.count || 0),
      }))
      .catch(() => undefined);
  }, [vendorId]);

  if (!summary.count) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-500 ${className}`}>
        <Star className="h-4 w-4 text-slate-300" />
        <span>Aún sin calificaciones verificadas</span>
      </div>
    );
  }

  const label = `${summary.count} ${summary.count === 1 ? "calificación verificada" : "calificaciones verificadas"}`;

  return (
    <div className={`flex ${compact ? "items-center" : "items-start sm:items-center"} gap-3 ${className}`}>
      <div className="flex shrink-0" aria-label={`${summary.average.toFixed(1)} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Star
            key={value}
            className={`h-4 w-4 ${value <= Math.round(summary.average) ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}`}
          />
        ))}
      </div>
      <p className="text-sm text-slate-700">
        <strong className="font-semibold text-slate-950">{summary.average.toFixed(1)}</strong>
        <span className="mx-1.5 text-slate-300">·</span>
        {label}
      </p>
    </div>
  );
}
