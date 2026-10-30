"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Disc3, Menu, X } from "lucide-react";
import { vendorApplicationHref, vendorLoginHref } from "./portal-content";

const navigation = [
  { href: "/vendedores", label: "Inicio" },
  { href: "/vendedores/herramientas", label: "Herramientas" },
  { href: "/vendedores/canales", label: "Canales" },
  { href: "/vendedores/envios-y-pagos", label: "Envíos y pagos" },
  { href: "/vendedores/comisiones", label: "Comisiones" },
  { href: "/vendedores/recursos", label: "Recursos" },
];

export function VendorPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09111f] text-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
          <Link href="/vendedores" className="flex shrink-0 items-center gap-2" aria-label="Portal de Vendedores MundoBeat">
            <span className="grid h-9 w-9 place-items-center bg-cyan-500 text-[#09111f]"><Disc3 className="h-5 w-5" /></span>
            <span className="leading-tight"><strong className="block text-base">MundoBeat</strong><span className="block text-[11px] text-slate-400">Portal de Vendedores</span></span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación del portal de vendedores">
            {navigation.map((item) => {
              const active = item.href === "/vendedores" ? pathname === item.href : pathname.startsWith(item.href);
              return <Link key={item.href} href={item.href} className={`px-3 py-2 text-sm font-medium transition-colors ${active ? "text-cyan-300" : "text-slate-300 hover:text-white"}`}>{item.label}</Link>;
            })}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link href={vendorLoginHref} className="text-sm font-semibold text-slate-200 hover:text-white">Ingresar</Link>
            <Link href={vendorApplicationHref} className="inline-flex h-10 items-center gap-2 bg-cyan-500 px-4 text-sm font-bold text-[#07111e] hover:bg-cyan-400">Crear mi tienda <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="grid h-10 w-10 place-items-center border border-white/15 text-slate-100 lg:hidden" aria-expanded={menuOpen} aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 px-4 pb-5 pt-3 lg:hidden">
            <nav className="mx-auto grid max-w-7xl" aria-label="Navegación móvil del portal de vendedores">
              {navigation.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`border-b border-white/10 px-2 py-3 text-sm font-semibold ${pathname === item.href ? "text-cyan-300" : "text-slate-200"}`}>{item.label}</Link>)}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link href={vendorLoginHref} className="border border-white/20 px-4 py-3 text-center text-sm font-semibold">Ingresar</Link>
                <Link href={vendorApplicationHref} className="bg-cyan-500 px-4 py-3 text-center text-sm font-bold text-[#07111e]">Crear mi tienda</Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-800 bg-[#09111f] text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.3fr_1fr_1fr]">
          <div><div className="flex items-center gap-2 text-white"><Disc3 className="h-6 w-6 text-cyan-400" /><strong>MundoBeat Vendedores</strong></div><p className="mt-4 max-w-md text-sm leading-6 text-slate-400">Herramientas para publicar, vender, despachar y administrar tu negocio de música física desde un solo lugar.</p></div>
          <div><p className="text-sm font-bold text-white">Portal</p><div className="mt-4 grid gap-2 text-sm">{navigation.slice(1).map((item) => <Link key={item.href} href={item.href} className="hover:text-cyan-300">{item.label}</Link>)}</div></div>
          <div><p className="text-sm font-bold text-white">Acceso</p><div className="mt-4 grid gap-2 text-sm"><Link href={vendorApplicationHref} className="hover:text-cyan-300">Solicitar una tienda</Link><Link href={vendorLoginHref} className="hover:text-cyan-300">Ingresar al dashboard</Link><Link href="/" className="hover:text-cyan-300">Ir a MundoBeat</Link></div></div>
        </div>
        <div className="border-t border-white/10 px-6 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} MundoBeat. Marketplace de música física en Chile.</div>
      </footer>
    </div>
  );
}
