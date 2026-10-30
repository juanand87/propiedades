"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Images, RectangleHorizontal } from "lucide-react";
import { api } from "@/lib/api";

interface PromotionsOverviewProps {
  vendorId: string;
  onOpenCarousels: (carouselId?: number | string) => void;
  onOpenBanners: () => void;
}

const positionNames: Record<string, string> = {
  top: "Superior",
  middle: "Medio",
  bottom: "Inferior",
};
const positionRank: Record<string, number> = { top: 0, middle: 1, bottom: 2 };
const positions = ["top", "middle", "bottom"] as const;

export default function PromotionsOverview({ vendorId, onOpenCarousels, onOpenBanners }: PromotionsOverviewProps) {
  const [slides, setSlides] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<string | null>(null);

  useEffect(() => {
    api.getVendorSettings(vendorId).then((settings) => {
      setSlides(settings?.slides || []);
      setBanners(settings?.banners || []);
    }).finally(() => setLoading(false));
  }, [vendorId]);

  const items = useMemo(() => [
    ...slides.map((item, sourceIndex) => ({ ...item, contentType: "carousel", sourceIndex, position: item.position || "top" })),
    ...banners.map((item, sourceIndex) => ({ ...item, contentType: "banner", sourceIndex, position: item.position || "top" })),
  ].map((item, index) => ({ ...item, promotionOrder: item.promotionOrder ?? index })).sort((a, b) => (positionRank[a.position] ?? 3) - (positionRank[b.position] ?? 3) || Number(a.promotionOrder) - Number(b.promotionOrder)), [slides, banners]);

  const persist = async (nextSlides: any[], nextBanners: any[], successMessage = "Cambios guardados") => {
    setSlides(nextSlides);
    setBanners(nextBanners);
    setSaving(true);
    try {
      await api.updateVendorSettings(vendorId, { slides: nextSlides, banners: nextBanners }, true);
      setNotice(successMessage);
      window.setTimeout(() => setNotice(null), 2500);
    } catch (error: any) {
      alert(error.message || "No se pudo actualizar el bloque de contenido");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (item: any) => {
    if (item.contentType === "carousel") {
      const next = slides.map((entry, index) => index === item.sourceIndex ? { ...entry, showInHomepage: !entry.showInHomepage } : entry);
      persist(next, banners, "Estado guardado");
    } else {
      const next = banners.map((entry, index) => index === item.sourceIndex ? { ...entry, isActive: !entry.isActive } : entry);
      persist(slides, next, "Estado guardado");
    }
  };

  const move = (item: any, direction: -1 | 1) => {
    const samePosition = items.filter((entry) => entry.position === item.position);
    const current = samePosition.findIndex((entry) => entry.contentType === item.contentType && entry.id === item.id);
    const target = samePosition[current + direction];
    if (!target) return;
    const firstOrder = item.promotionOrder;
    const secondOrder = target.promotionOrder;
    const updateCollection = (collection: any[], contentType: string) => collection.map((entry) => {
      if (contentType === item.contentType && entry.id === item.id) return { ...entry, promotionOrder: secondOrder };
      if (contentType === target.contentType && entry.id === target.id) return { ...entry, promotionOrder: firstOrder };
      return entry;
    });
    persist(updateCollection(slides, "carousel"), updateCollection(banners, "banner"), "Posición guardada");
  };

  const changePosition = (item: any, position: string) => {
    const lastOrder = items.filter((entry) => entry.position === position).reduce((maximum, entry) => Math.max(maximum, Number(entry.promotionOrder)), -1) + 1;
    if (item.contentType === "carousel") {
      persist(slides.map((entry, index) => index === item.sourceIndex ? { ...entry, position, promotionOrder: lastOrder } : entry), banners, "Ubicación guardada");
    } else {
      persist(slides, banners.map((entry, index) => index === item.sourceIndex ? { ...entry, position, promotionOrder: lastOrder } : entry), "Ubicación guardada");
    }
  };

  const itemKey = (item: any) => `${item.contentType}:${item.id}`;

  const dropItem = (targetPosition: string, targetKey?: string) => {
    if (!draggedKey) return;
    const draggedItem = items.find((item) => itemKey(item) === draggedKey);
    if (!draggedItem) return;

    const orderedByPosition = Object.fromEntries(positions.map((position) => [position, items.filter((item) => item.position === position && itemKey(item) !== draggedKey)])) as Record<string, any[]>;
    const destination = orderedByPosition[targetPosition] || [];
    const targetIndex = targetKey ? destination.findIndex((item) => itemKey(item) === targetKey) : -1;
    destination.splice(targetIndex >= 0 ? targetIndex : destination.length, 0, { ...draggedItem, position: targetPosition });

    const updates = new Map<string, { position: string; promotionOrder: number }>();
    positions.forEach((position) => orderedByPosition[position].forEach((item, index) => updates.set(itemKey(item), { position, promotionOrder: index })));
    const nextSlides = slides.map((entry) => ({ ...entry, ...(updates.get(`carousel:${entry.id}`) || {}) }));
    const nextBanners = banners.map((entry) => ({ ...entry, ...(updates.get(`banner:${entry.id}`) || {}) }));
    setDraggedKey(null);
    setDragOverPosition(null);
    persist(nextSlides, nextBanners, draggedItem.position === targetPosition ? "Posición guardada" : "Ubicación guardada");
  };

  if (loading) return <div className="p-8 text-sm text-slate-500">Cargando promociones...</div>;

  return <div className="rounded-lg border border-slate-200 bg-white">
    <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-bold text-slate-900">Bloques de contenido</h2><p className="text-sm text-slate-500">Organiza banners y carruseles en distintas ubicaciones de tu tienda.</p></div>
      <div className="flex gap-2"><button onClick={onOpenBanners} className="inline-flex items-center gap-2 rounded-md border border-sky-200 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"><RectangleHorizontal className="h-4 w-4" />Crear banner</button><button onClick={() => onOpenCarousels()} className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"><Images className="h-4 w-4" />Crear carrusel</button></div>
    </div>
    {notice && <div role="status" className="mx-5 mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">✓</span>{notice}</div>}
    <div className="space-y-5 p-5">
      {items.length === 0 ? <div className="py-12 text-center text-sm text-slate-500">Aún no hay bloques de contenido configurados.</div> : positions.map((position) => {
        const positionItems = items.filter((item) => item.position === position);
        return <section key={position} onDragOver={(event) => { event.preventDefault(); setDragOverPosition(position); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverPosition(null); }} onDrop={(event) => { event.preventDefault(); dropItem(position); }} className={`overflow-hidden rounded-lg border transition-colors ${dragOverPosition === position ? "border-sky-400 bg-sky-50/30" : "border-slate-200"}`}>
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><div><h3 className="text-sm font-bold text-slate-900">{positionNames[position]}</h3><p className="text-xs text-slate-500">{position === "top" ? "Después de la cabecera" : position === "middle" ? "Después del contenido principal" : "Después del pie de página"}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">{positionItems.length}</span></div>
          <div className="space-y-2 p-3">
            {positionItems.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">No hay bloques en esta ubicación</div> : positionItems.map((item, positionIndex) => {
              const active = item.contentType === "carousel" ? item.showInHomepage === true : item.isActive === true;
              return <div key={`${item.contentType}-${item.id}`} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDragOverPosition(position); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); dropItem(position, itemKey(item)); }} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 lg:flex-row lg:items-center">
                <span draggable={!saving} onDragStart={(event) => { setDraggedKey(itemKey(item)); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", itemKey(item)); }} onDragEnd={() => { setDraggedKey(null); setDragOverPosition(null); }} className="cursor-grab touch-none rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing" title="Arrastrar bloque"><GripVertical className="h-5 w-5" /></span>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${item.contentType === "carousel" ? "bg-sky-100 text-sky-700" : "bg-cyan-100 text-cyan-700"}`}>{item.contentType === "carousel" ? <Images className="h-5 w-5" /> : <RectangleHorizontal className="h-5 w-5" />}</span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm text-slate-900">{item.name || (item.contentType === "carousel" ? "Carrusel" : "Banner")}</strong><span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.contentType === "carousel" ? `Carrusel · ${item.items?.length || 0} diapositivas` : "Banner"}</span></div></div>
                <select aria-label={`Ubicación de ${item.name || "bloque"}`} value={item.position} disabled={saving} onChange={(event) => changePosition(item, event.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700"><option value="top">Superior</option><option value="middle">Medio</option><option value="bottom">Inferior</option></select>
                <div className="flex items-center gap-2"><button disabled={positionIndex === 0 || saving} onClick={() => move(item, -1)} className="rounded border p-2 disabled:opacity-30" title="Subir"><ChevronUp className="h-4 w-4" /></button><button disabled={positionIndex === positionItems.length - 1 || saving} onClick={() => move(item, 1)} className="rounded border p-2 disabled:opacity-30" title="Bajar"><ChevronDown className="h-4 w-4" /></button><button role="switch" aria-label={active ? "Desactivar" : "Activar"} aria-checked={active} disabled={saving} onClick={() => toggle(item)} className={`relative h-6 w-11 rounded-full ${active ? "bg-sky-600" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-5" : "translate-x-0.5"}`} /></button><button onClick={() => item.contentType === "carousel" ? onOpenCarousels(item.id) : onOpenBanners()} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Editar</button></div>
              </div>;
            })}
          </div>
        </section>;
      })}
    </div>
  </div>;
}
