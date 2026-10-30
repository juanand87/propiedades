"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Eye, EyeOff, Home } from "lucide-react";

interface Page {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  isHomepage: boolean;
  createdAt: string;
  updatedAt: string;
}

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

export default function PagesListPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      setLoading(true);
      // Cargar páginas del vendor marketplace usando endpoint público
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/vendors/${MARKETPLACE_VENDOR_ID}/pages`, {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        throw new Error('Failed to load pages');
      }
      
      const data = await response.json();
      setPages(data);
    } catch (error) {
      console.error("Error loading pages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pageId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta página?")) {
      return;
    }

    try {
      setDeleting(pageId);
      await api.deletePage(pageId);
      setPages(pages.filter((p) => p.id !== pageId));
    } catch (error) {
      console.error("Error deleting page:", error);
      alert("Error al eliminar la página");
    } finally {
      setDeleting(null);
    }
  };

  const handleTogglePublish = async (page: Page) => {
    try {
      const updated = await api.updatePage(page.id, {
        isPublished: !page.isPublished,
      });
      setPages(pages.map((p) => (p.id === page.id ? updated : p)));
    } catch (error) {
      console.error("Error updating page:", error);
    }
  };

  const handleSetHomepage = async (page: Page) => {
    try {
      // Si ya es homepage, la desmarcamos
      const newHomepageState = !page.isHomepage;
      const updated = await api.updatePage(page.id, {
        isHomepage: newHomepageState,
      });
      
      if (newHomepageState) {
        // Si la marcamos como homepage, desmarcamos las otras
        setPages(pages.map((p) => ({
          ...p,
          isHomepage: p.id === page.id,
        })));
      } else {
        setPages(pages.map((p) => (p.id === page.id ? updated : p)));
      }
    } catch (error) {
      console.error("Error setting homepage:", error);
      alert("Error al establecer la página de inicio");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Páginas</h1>
          <p className="text-gray-600 mt-1">Crea y gestiona las páginas de tu tienda</p>
        </div>
        <Link href="/panel/pages/new">
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Página
          </Button>
        </Link>
      </div>

      {/* Pages List */}
      {pages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No hay páginas aún</p>
            <Link href="/panel/pages/new">
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Crear tu primera página
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pages.map((page) => (
            <Card key={page.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{page.title}</h3>
                      {page.isHomepage && (
                        <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded">
                          Inicio
                        </span>
                      )}
                      {page.isPublished ? (
                        <span className="inline-block px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded">
                          Publicada
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded">
                          Borrador
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">/{page.slug}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Actualizado hace {new Date(page.updatedAt).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetHomepage(page)}
                      title={page.isHomepage ? "Desmarcar como página de inicio" : "Marcar como página de inicio"}
                      className={page.isHomepage ? "text-purple-600" : "text-gray-400"}
                    >
                      <Home className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTogglePublish(page)}
                      title={page.isPublished ? "Despublicar" : "Publicar"}
                    >
                      {page.isPublished ? (
                        <Eye className="w-4 h-4 text-green-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                    <Link href={`/panel/pages/${page.id}`}>
                      <Button variant="ghost" size="sm">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(page.id)}
                      disabled={deleting === page.id}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


