import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";
import { vendorApplicationHref } from "./portal-content";

export function PortalHero({ eyebrow, title, description, image, titleClassName, children }: { eyebrow: string; title: string; description: string; image: string; titleClassName?: string; children?: React.ReactNode }) {
  return (
    <section className="relative min-h-[560px] overflow-hidden bg-[#09111f] text-white md:min-h-[640px]">
      <Image src={image} alt="" fill priority sizes="100vw" className="object-cover object-center opacity-55" />
      <div className="absolute inset-0 bg-[#09111f]/75" />
      <div className="relative mx-auto flex min-h-[560px] max-w-7xl items-center px-6 py-20 md:min-h-[640px] lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
          <h1 className={`mt-5 font-black leading-[1.02] ${titleClassName || "text-5xl sm:text-6xl lg:text-7xl"}`}>{title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">{description}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={vendorApplicationHref} className="inline-flex h-12 items-center gap-2 bg-cyan-400 px-6 font-bold text-[#07111e] hover:bg-cyan-300">Crear mi tienda <ArrowRight className="h-4 w-4" /></Link>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, description, align = "left" }: { eyebrow: string; title: string; description?: string; align?: "left" | "center" }) {
  return <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{eyebrow}</p><h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">{title}</h2>{description && <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{description}</p>}</div>;
}

export function FeatureGrid({ items }: { items: Array<{ icon: LucideIcon; title: string; description: string; accent?: string }> }) {
  return <div className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">{items.map(({ icon: Icon, title, description, accent }) => <article key={title} className="bg-white p-6"><span className={`grid h-10 w-10 place-items-center ${accent || "bg-cyan-50 text-cyan-700"}`}><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}</div>;
}

export function VisualFeature({ image, alt, eyebrow, title, description, bullets, reverse = false }: { image: string; alt: string; eyebrow: string; title: string; description: string; bullets: string[]; reverse?: boolean }) {
  return <section className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"><div className={reverse ? "lg:order-2" : ""}><div className="relative aspect-[4/3] overflow-hidden border border-slate-200 bg-white shadow-lg"><Image src={image} alt={alt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain" unoptimized={image.endsWith(".gif")} /></div></div><div className={reverse ? "lg:order-1" : ""}><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{eyebrow}</p><h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{title}</h2><p className="mt-5 text-lg leading-8 text-slate-600">{description}</p><ul className="mt-7 grid gap-3">{bullets.map((bullet) => <li key={bullet} className="flex items-start gap-3 text-sm font-medium text-slate-700"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />{bullet}</li>)}</ul></div></section>;
}

export function PortalCta({ title, description }: { title: string; description: string }) {
  return <section className="bg-[#101b2d] px-6 py-16 text-white"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center"><div><h2 className="text-3xl font-black sm:text-4xl">{title}</h2><p className="mt-3 max-w-2xl text-slate-300">{description}</p></div><Link href={vendorApplicationHref} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 bg-amber-400 px-6 font-bold text-slate-950 hover:bg-amber-300">Solicitar mi tienda <ArrowRight className="h-4 w-4" /></Link></div></section>;
}
