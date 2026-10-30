"use client";

const links = [
  { label: "Políticas de envío",         href: "/pagina/politicas-de-envio" },
  { label: "Términos y Condiciones",     href: "/pagina/terminos-y-condiciones" },
  { label: "Cómo comprar en Mundo Beat", href: "/pagina/como-comprar-en-mundo-beat" },
  { label: "Vende en Mundo Beat",        href: "/vendedores" },
  { label: "Escala de Goldmine",         href: "/escala-goldmine" },
  { label: "Devoluciones",               href: "/politicas-de-cambios-y-devoluciones" },
  { label: "Contactar",                  href: "/pagina/contacto" },
];

export default function BottomNavBar() {
  return (
    <div className="border-t border-gray-200 bg-white py-4 px-4">
      <nav className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {links.map((link, i, arr) => (
          <span key={link.href} className="flex items-center gap-x-5">
            <a
              href={link.href}
              className="text-xs text-gray-500 hover:text-gray-900 transition-colors whitespace-nowrap"
            >
              {link.label}
            </a>
            {i < arr.length - 1 && (
              <span className="text-gray-300 text-xs select-none">·</span>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}
