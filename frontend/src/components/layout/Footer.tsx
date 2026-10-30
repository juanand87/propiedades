import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="font-bold text-lg mb-4">MusicMarket</h3>
            <p className="text-gray-400 text-sm">
              El marketplace líder en música física. Vinilos, CDs, cassettes y más.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Comprar</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="/products?type=vinyl" className="hover:text-white">Vinilos</Link></li>
              <li><Link href="/products?type=cd" className="hover:text-white">CDs</Link></li>
              <li><Link href="/products?type=cassette" className="hover:text-white">Cassettes</Link></li>
              <li><Link href="/products?type=merch" className="hover:text-white">Merchandising</Link></li>
            </ul>
          </div>

          {/* Vendors */}
          <div>
            <h4 className="font-semibold mb-4">Vendedores</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="/vendors" className="hover:text-white">Explorar tiendas</Link></li>
              <li><Link href="/vendedores" className="hover:text-white">Vender en Mundobeat.cl</Link></li>
              <li><Link href="/dashboard" className="hover:text-white">Panel vendedor</Link></li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="font-semibold mb-4">Ayuda</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="/help" className="hover:text-white">Centro de ayuda</Link></li>
              <li><Link href="/shipping" className="hover:text-white">Envíos</Link></li>
              <li><Link href="/returns" className="hover:text-white">Devoluciones</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contacto</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; 2025 MusicMarket. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
