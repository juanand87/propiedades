"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { ClipboardList, TicketPercent } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Si estamos en login, no verificar autenticación
    if (pathname === "/panel/login") {
      setIsLoading(false);
      return;
    }

    // Verificar autenticación inmediatamente
    const authToken = localStorage.getItem("panel_auth");
    
    if (authToken === "true") {
      // Verificar que el token JWT exista también
      const jwtToken = localStorage.getItem("token");
      if (jwtToken) {
        setIsAuthenticated(true);
        setIsLoading(false);
      } else {
        // Token JWT no existe, ir a login
        localStorage.removeItem("panel_auth");
        router.push("/panel/login");
      }
    } else {
      // No hay autenticación de panel, ir a login
      router.push("/panel/login");
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem("panel_auth");
    localStorage.removeItem("panel_user");
    localStorage.removeItem("token");
    api.removeToken();
    router.push("/panel/login");
  };

  // Mostrar página de login sin layout
  if (pathname === "/panel/login") {
    return <>{children}</>;
  }

  // Mostrar loading mientras verifica autenticación
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, no renderizar nada (se redirigirá)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      {/* Sidebar */}
      <aside className="hidden md:block w-64 glass-effect border-r border-gray-200/50 p-6 backdrop-blur-xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">Panel Admin</h2>
          <p className="text-sm text-gray-600 mt-1">Marketplace</p>
        </div>

        <nav className="space-y-1.5">
          <Link href="/panel" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">📊</span> Dashboard
            </Button>
          </Link>
          <Link href="/panel/products" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">📦</span> Productos
            </Button>
          </Link>
          <Link href="/panel/escanear" className="cursor-pointer md:hidden">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">📱</span> Productos Teléfono
            </Button>
          </Link>
          <Link href="/panel/orders" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">🛒</span> Órdenes
            </Button>
          </Link>
          <Link href="/panel/preguntas" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">💬</span> Preguntas
            </Button>
          </Link>
          <Link href="/panel/descuentos" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start"><TicketPercent className="mr-2 h-5 w-5" />Descuentos</Button>
          </Link>
          <Link href="/panel/inventario" className="cursor-pointer"><Button variant="ghost" className="w-full justify-start"><ClipboardList className="mr-2 h-5 w-5" />Inventario físico</Button></Link>
          <Link href="/panel/calificaciones" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">★</span> Calificaciones
            </Button>
          </Link>
          <Link href="/panel/pages" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">📄</span> Páginas
            </Button>
          </Link>
          <Link href="/panel/biblioteca" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">🖼️</span> Biblioteca
            </Button>
          </Link>
          <Link href="/panel/liquidaciones" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">💰</span> Liquidaciones
            </Button>
          </Link>
          <Link href="/panel/facturacion" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">🧾</span> Facturación
            </Button>
          </Link>
          <Link href="/panel/settings" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">⚙️</span> Configuración
            </Button>
          </Link>
          <Link href="/panel/settings/email-templates" className="cursor-pointer">
            <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
              <span className="text-lg mr-2">✉️</span> Plantillas Email
            </Button>
          </Link>

          {/* Vendedores Section */}
          <div className="pt-4 mt-4 border-t border-gray-200/50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
              Vendedores
            </p>
            <Link href="/panel/vendedores/listar" className="cursor-pointer">
              <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
                <span className="text-lg mr-2">👥</span> Listar
              </Button>
            </Link>
            <Link href="/panel/vendedores/solicitudes" className="cursor-pointer">
              <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
                <span className="text-lg mr-2">📝</span> Solicitudes
              </Button>
            </Link>
            <Link href="/panel/vendedores/configuracion" className="cursor-pointer">
              <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
                <span className="text-lg mr-2">🔧</span> Configuración
              </Button>
            </Link>
            <Link href="/panel/vendedores/envia" className="cursor-pointer">
              <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
                <span className="text-lg mr-2">📦</span> Envia.com
              </Button>
            </Link>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-200/50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
              Manuales
            </p>
            <Link href="/panel/manuales/tutoriales" className="cursor-pointer">
              <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
                <span className="text-lg mr-2">📘</span> Tutoriales
              </Button>
            </Link>
            <Link href="/panel/manuales/presentacion" className="cursor-pointer">
              <Button variant="ghost" className="w-full justify-start hover:bg-primary/10 hover:text-primary transition-all duration-300">
                <span className="text-lg mr-2">📊</span> Presentación
              </Button>
            </Link>
          </div>
        </nav>

        <div className="mt-8 pt-8 border-t border-gray-200/50 space-y-2">
          <Link href="/" className="cursor-pointer block">
            <Button variant="ghost" className="w-full justify-start hover:bg-gray-100/50 transition-all duration-300">
              <span className="mr-2">←</span> Volver al marketplace
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-red-100 hover:text-red-600 transition-all duration-300"
            onClick={handleLogout}
          >
            <span className="mr-2">🚪</span> Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — solo visible en mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200 flex items-center justify-around px-2 py-2 shadow-lg">
        <Link href="/panel" className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500 hover:text-purple-600">
          <span className="text-xl">📊</span>
          <span className="text-[10px]">Dashboard</span>
        </Link>
        <Link href="/panel/products" className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500 hover:text-purple-600">
          <span className="text-xl">📦</span>
          <span className="text-[10px]">Productos</span>
        </Link>
        <Link href="/panel/escanear" className="flex flex-col items-center gap-0.5 px-3 py-1 -mt-4 bg-green-500 rounded-full shadow-lg shadow-green-500/40 text-white min-w-[60px]">
          <span className="text-2xl">📷</span>
          <span className="text-[10px] font-bold">Escanear</span>
        </Link>
        <Link href="/panel/orders" className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500 hover:text-purple-600">
          <span className="text-xl">🛒</span>
          <span className="text-[10px]">Órdenes</span>
        </Link>
        <Link href="/panel/settings" className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500 hover:text-purple-600">
          <span className="text-xl">⚙️</span>
          <span className="text-[10px]">Config</span>
        </Link>
      </nav>
    </div>
  );
}
