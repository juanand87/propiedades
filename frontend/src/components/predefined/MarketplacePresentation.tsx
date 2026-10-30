"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Album,
  BadgeCheck,
  BarChart3,
  Box,
  CreditCard,
  Headphones,
  HelpCircle,
  LayoutDashboard,
  Link2,
  ListMusic,
  Package,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tags,
  Truck,
  X,
  ZoomIn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  MarketplacePresentationConfig,
  parseMarketplacePresentation,
} from "@/lib/marketplacePresentation";
import { getImageUrl } from "@/lib/utils";

const sectionIcons = [Box, BadgeCheck, Store, Search, ShoppingBag, PackageCheck, Truck, Headphones];
const featureIcons = [Search, Album, Tags, ShieldCheck, ListMusic, Package, CreditCard, Link2, BarChart3, HelpCircle, LayoutDashboard, BadgeCheck];

function DemoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-8 text-center">
      <div>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-sky-600 shadow-sm">
          <Box className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="mt-1 text-xs text-slate-500">Imagen configurable desde el panel</p>
      </div>
    </div>
  );
}

function SlideContainer({
  children,
  accent = "cyan",
  className = "",
}: {
  children: ReactNode;
  accent?: "cyan" | "rose";
  className?: string;
}) {
  return (
    <section className={`relative h-[100dvh] overflow-hidden border-t-4 bg-[#f7f9fc] pb-[76px] ${accent === "cyan" ? "border-sky-500" : "border-rose-500"} ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(226,241,252,0.55),transparent)]" aria-hidden="true" />
      {children}
    </section>
  );
}

function SectionBadge({ icon: Icon, phase, eyebrow }: { icon: LucideIcon; phase: string; eyebrow: string }) {
  return (
    <div className="relative z-10 flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#07172f] text-cyan-300 shadow-sm"><Icon className="h-5 w-5" /></span>
      <div className="leading-tight">
        <p className="text-[12px] font-extrabold uppercase text-rose-600">{phase}</p>
        <p className="mt-1 text-[12px] font-bold uppercase text-slate-500">{eyebrow}</p>
      </div>
    </div>
  );
}

function FeatureGrid({ bullets, offset = 0 }: { bullets: string[]; offset?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {bullets.map((bullet, index) => {
        const FeatureIcon = featureIcons[(offset + index) % featureIcons.length];
        return (
          <li key={bullet} className="flex min-h-[76px] items-start gap-3 rounded-xl border border-[#e2eaf3] bg-white px-4 py-3.5 shadow-[0_10px_28px_rgba(15,35,65,0.045)]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><FeatureIcon className="h-[18px] w-[18px]" /></span>
            <span className="text-[13px] font-medium leading-5 text-slate-700">{bullet}</span>
          </li>
        );
      })}
    </ul>
  );
}

function PresentationImage({
  src,
  alt,
  onOpen,
  priority = false,
}: {
  src: string;
  alt: string;
  onOpen: () => void;
  priority?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full cursor-zoom-in overflow-hidden rounded-[14px] bg-slate-100 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400"
      aria-label={`Ampliar imagen: ${alt}`}
    >
      <img
        src={getImageUrl(src)}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        className="aspect-[16/10] w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.015]"
      />
      <span className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-end bg-slate-950/80 px-4 py-3 text-xs font-bold text-white transition-transform duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0">
        <ZoomIn className="mr-2 h-4 w-4 text-cyan-300" /> Ver imagen completa
      </span>
    </button>
  );
}

export default function MarketplacePresentation({
  config,
  configJson,
  logoUrl,
}: {
  config?: MarketplacePresentationConfig;
  configJson?: string;
  logoUrl?: string;
}) {
  const content = config || parseMarketplacePresentation(configJson);
  const totalSlides = content.sections.length + 3;
  const [currentSlide, setCurrentSlide] = useState(0);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    setCurrentSlide((current) => Math.min(current, totalSlides - 1));
  }, [totalSlides]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && lightbox) {
        setLightbox(null);
        return;
      }
      if (lightbox) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        setCurrentSlide((current) => Math.min(current + 1, totalSlides - 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setCurrentSlide((current) => Math.max(current - 1, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalSlides, lightbox]);

  useEffect(() => {
    if (!lightbox) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lightbox]);

  const goTo = (index: number) => setCurrentSlide(Math.max(0, Math.min(index, totalSlides - 1)));
  const sectionIndex = currentSlide - 2;
  const activeSection = sectionIndex >= 0 && sectionIndex < content.sections.length
    ? content.sections[sectionIndex]
    : null;
  const ActiveIcon = activeSection ? sectionIcons[sectionIndex % sectionIcons.length] : Box;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-white text-slate-950">
      {currentSlide === 0 && (
      <SlideContainer>
        <div className="relative mx-auto grid h-full w-full max-w-[1600px] grid-cols-[0.78fr_1.22fr] items-center gap-16 px-[clamp(48px,5vw,96px)] py-10">
          <div className="relative z-10">
            {logoUrl && (
              <div className="mb-8 inline-flex rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <img src={getImageUrl(logoUrl)} alt="MundoBeat" className="max-h-14 w-auto max-w-[220px] object-contain" />
              </div>
            )}
            <div className="mb-5 flex items-center gap-3"><span className="h-px w-10 bg-sky-500" /><p className="text-xs font-extrabold uppercase text-sky-700">{content.badge}</p></div>
            <h1 className="max-w-3xl text-[clamp(42px,3.3vw,54px)] font-extrabold leading-[1.08] text-[#07172f]">{content.title}</h1>
            <p className="mt-6 max-w-2xl text-[18px] leading-8 text-slate-600">{content.subtitle}</p>
            <a href={content.ctaLink} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_26px_rgba(2,132,199,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-700">
              {content.ctaText}<ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="relative rounded-[20px] border border-[#dce6f0] bg-white p-2.5 shadow-[0_22px_60px_rgba(15,35,65,0.12)]">
            <div className="flex h-9 items-center gap-1.5 border-b border-slate-200 px-3" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-rose-400" /><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="ml-4 h-4 flex-1 rounded bg-slate-100" /></div>
            {content.heroImageUrl ? (
              <PresentationImage src={content.heroImageUrl} alt={content.heroImageAlt} priority onOpen={() => setLightbox({ src: content.heroImageUrl, alt: content.heroImageAlt })} />
            ) : <DemoPlaceholder label="Vista general del marketplace" />}
          </div>
        </div>
      </SlideContainer>
      )}

      {currentSlide === 1 && (
      <SlideContainer>
        <div className="relative mx-auto flex h-full w-full max-w-[1600px] flex-col justify-center px-[clamp(48px,5vw,96px)] py-6">
          <div className="mb-5 max-w-5xl"><p className="text-xs font-extrabold uppercase text-rose-600">Cómo funciona</p><h2 className="mt-2 text-[clamp(34px,2.6vw,46px)] font-extrabold leading-[1.08] text-[#07172f]">Un recorrido completo, desde la publicación hasta la entrega.</h2><p className="mt-3 max-w-3xl text-[16px] leading-6 text-slate-600">12 áreas conectadas para mantener catálogo, ventas, operación y atención bajo control.</p></div>
          <div className="grid grid-cols-4 gap-3">
            {content.sections.map((section, index) => {
              const FlowIcon = sectionIcons[index % sectionIcons.length];
              const number = String(index + 1).padStart(2, "0");
              return (
                <button key={section.id} type="button" onClick={() => goTo(index + 2)} className="group flex min-h-[116px] flex-col justify-between rounded-xl border border-[#dfe9f3] bg-white p-4 text-left shadow-[0_10px_28px_rgba(15,35,65,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_14px_34px_rgba(15,35,65,0.09)]">
                  <div className="flex items-start justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700 transition-colors group-hover:bg-sky-600 group-hover:text-white"><FlowIcon className="h-[18px] w-[18px]" /></span><span className="text-2xl font-extrabold text-sky-100">{number}</span></div>
                  <div className="mt-3 min-w-0"><p className="truncate text-[10px] font-extrabold uppercase text-rose-600">{section.phase}</p><h2 className="mt-1 truncate text-sm font-extrabold text-[#07172f]">{section.eyebrow}</h2><p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{section.title}</p></div>
                </button>
              );
            })}
          </div>
        </div>
      </SlideContainer>
      )}

      {activeSection && (
          <SlideContainer accent={sectionIndex % 3 === 1 ? "rose" : "cyan"}>
            <div className={`relative mx-auto grid h-full w-full max-w-[1600px] items-center gap-[clamp(40px,4vw,72px)] px-[clamp(48px,5vw,96px)] py-8 ${sectionIndex % 2 === 1 ? "grid-cols-[1.08fr_0.92fr]" : "grid-cols-[0.92fr_1.08fr]"}`}>
              <div className={`relative z-10 ${sectionIndex % 2 === 1 ? "order-2" : ""}`}>
                <span className="absolute -top-12 right-0 select-none text-[96px] font-extrabold leading-none text-[#e9f0f7]" aria-hidden="true">{String(sectionIndex + 1).padStart(2, "0")}</span>
                <SectionBadge icon={ActiveIcon} phase={activeSection.phase} eyebrow={activeSection.eyebrow} />
                <h2 className="relative mt-6 max-w-2xl text-[clamp(38px,3vw,52px)] font-extrabold leading-[1.08] text-[#07172f]">{activeSection.title}</h2>
                <p className="mt-5 max-w-2xl text-[17px] leading-7 text-slate-600">{activeSection.description}</p>
                <div className="mt-7">
                  <FeatureGrid bullets={activeSection.bullets} offset={sectionIndex} />
                </div>
              </div>
              <div className={`relative rounded-[20px] border border-[#dce6f0] bg-white p-2.5 shadow-[0_22px_60px_rgba(15,35,65,0.11)] ${sectionIndex % 2 === 1 ? "order-1" : ""}`}>
                <div className="flex h-9 items-center justify-between border-b border-slate-200 px-3 text-[10px] font-bold uppercase text-slate-400"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" /><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="ml-2">Vista de demostración</span></span><ZoomIn className="h-3.5 w-3.5" /></div>
                {activeSection.imageUrl ? <PresentationImage src={activeSection.imageUrl} alt={activeSection.imageAlt} onOpen={() => setLightbox({ src: activeSection.imageUrl, alt: activeSection.imageAlt })} /> : <DemoPlaceholder label={activeSection.imageAlt} />}
              </div>
            </div>
          </SlideContainer>
      )}

      {currentSlide === totalSlides - 1 && (
      <SlideContainer accent="rose">
        <div className="relative mx-auto flex h-full w-full max-w-[1600px] flex-col justify-center px-[clamp(48px,5vw,96px)] py-8">
          <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div><p className="text-xs font-extrabold uppercase text-rose-600">UNA OPERACIÓN CONECTADA</p><h2 className="mt-3 text-[clamp(38px,3vw,52px)] font-extrabold leading-[1.08] text-[#07172f]">Del catálogo a la entrega, con trazabilidad.</h2><p className="mt-5 max-w-xl text-[17px] leading-7 text-slate-600">Cada etapa conserva la información necesaria para que la tienda sepa qué vender, qué preparar y cómo despachar.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[["Producto", "Precio, stock y condición"], ["Pedido", "Pago y datos del comprador"], ["Despacho", "Courier, etiqueta y guía"], ["Entrega", "Seguimiento y cierre"]].map(([title, text]) => (
                <div key={title} className="min-h-28 rounded-xl border border-[#e2eaf3] bg-white p-5 shadow-[0_12px_30px_rgba(15,35,65,0.05)]"><p className="font-extrabold text-[#07172f]">{title}</p><p className="mt-2 text-sm leading-5 text-slate-600">{text}</p></div>
              ))}
            </div>
          </div>
          <div className="mt-10 border-t border-slate-200 pt-7">
            <p className="text-xs font-extrabold uppercase text-rose-600">Empieza con tu catálogo</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-5">
              <h2 className="max-w-3xl text-3xl font-extrabold text-[#07172f] sm:text-4xl">Tu tienda lista para vender música en línea.</h2>
              <a href={content.ctaLink} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_26px_rgba(2,132,199,0.2)] hover:bg-sky-700">{content.ctaText}<ArrowRight className="h-4 w-4" /></a>
            </div>
          </div>
        </div>
      </SlideContainer>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex animate-in fade-in items-center justify-center bg-slate-950/95 p-4 duration-200 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
          onClick={() => setLightbox(null)}
        >
          <button type="button" onClick={() => setLightbox(null)} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center border border-white/30 bg-slate-900 text-white transition-colors hover:border-cyan-300 hover:text-cyan-300 sm:right-7 sm:top-7" aria-label="Cerrar imagen"><X className="h-5 w-5" /></button>
          <figure className="flex max-h-full max-w-7xl animate-in zoom-in-95 flex-col items-center duration-300" onClick={(event) => event.stopPropagation()}>
            <img src={getImageUrl(lightbox.src)} alt={lightbox.alt} className="max-h-[82vh] max-w-full object-contain shadow-2xl" />
            <figcaption className="mt-4 max-w-3xl text-center text-sm text-slate-300">{lightbox.alt}</figcaption>
          </figure>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur" aria-label="Navegación de la presentación">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button type="button" onClick={() => goTo(currentSlide - 1)} disabled={currentSlide === 0} className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-300 text-slate-800 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Diapositiva anterior"><ArrowLeft className="h-4 w-4" /></button>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600"><span>Diapositiva {currentSlide + 1} de {totalSlides}</span><span className="hidden truncate pl-4 sm:block">{activeSection?.title || (currentSlide === 0 ? content.title : currentSlide === 1 ? "Cómo funciona" : "Resumen")}</span></div>
            <div className="h-1.5 overflow-hidden bg-slate-200"><div className="h-full bg-cyan-600 transition-all duration-300" style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }} /></div>
          </div>
          <button type="button" onClick={() => goTo(currentSlide + 1)} disabled={currentSlide === totalSlides - 1} className="flex h-10 items-center justify-center gap-2 bg-slate-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-30">Siguiente<ArrowRight className="h-4 w-4" /></button>
        </div>
      </nav>
    </main>
  );
}
