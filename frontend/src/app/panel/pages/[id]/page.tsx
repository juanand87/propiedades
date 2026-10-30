"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, ArrowLeft, AlertCircle } from "lucide-react";

const PageBlocksGridEditor = dynamic(
  () => import("@/components/admin/PageBlocksGridEditor"),
  { ssr: false }
);

interface PageBlock {
  id: string;
  type: "text" | "grid" | "slides" | "image" | "video" | "imageText";
  columns: number;
  row: number;
  column: number;
  [key: string]: any;
}

interface PageData {
  id?: string;
  title: string;
  slug: string;
  description?: string;
  blocks: PageBlock[];
  metaTitle?: string;
  metaDescription?: string;
  isPublished: boolean;
  isHomepage?: boolean;
  rowsConfig?: Array<{
    row: number;
    columns: number;
  }>;
}

export default function PageEditorPage() {
  const params = useParams();
  const router = useRouter();
  const pageId = params.id as string;
  const isNew = pageId === "new";

  const [page, setPage] = useState<PageData>({
    title: "",
    slug: "",
    description: "",
    blocks: [],
    rowsConfig: [],
    isPublished: true,
    isHomepage: false,
  });

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [existingHomepage, setExistingHomepage] = useState<boolean>(false);
  const [vendorId, setVendorId] = useState<string>("00000000-0000-0000-0000-000000000001"); // Marketplace vendor ID

  useEffect(() => {
    if (!isNew) {
      loadPage();
    }
    loadCategories();
    checkExistingHomepage();
    // vendorId ya está configurado con el ID del marketplace
  }, [isNew, pageId]);

  // vendorId del marketplace está hardcodeado, no necesitamos cargarlo

  const checkExistingHomepage = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/vendors/00000000-0000-0000-0000-000000000001/pages`, {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        throw new Error('Failed to load pages');
      }
      
      const data = await response.json();
      const hasHomepage = data.some((p: any) => p.isHomepage && p.id !== pageId);
      setExistingHomepage(hasHomepage);
    } catch (error) {
      console.error("Error checking homepage:", error);
    }
  };

  const loadPage = async () => {
    try {
      setLoading(true);
      const data = await api.getPage(pageId);
      setPage(data);
    } catch (error) {
      console.error("Error loading page:", error);
      alert("Error al cargar la página");
      router.push("/panel/pages");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api.getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleSave = async () => {
    if (!page.title || !page.slug) {
      alert("Completa el título y el slug");
      return;
    }

    console.log(`[Frontend] 💾 Saving page with ${page.blocks?.length || 0} blocks`);
    const slidesBlocks = page.blocks.filter(b => b.type === 'slides');
    console.log(`[Frontend] 🎬 Slides blocks in state before save:`, slidesBlocks);

    try {
      setSaving(true);
      
      if (isNew) {
        const created = await api.createPage(page);
        router.push(`/panel/pages/${created.id}`);
      } else {
        console.log(`[Frontend] 📤 Sending to API:`, JSON.stringify(page, null, 2));
        const result = await api.updatePage(pageId, page);
        console.log(`[Frontend] ✅ Page updated successfully`);
        
        // Reload the page data from server to ensure everything is persisted correctly
        try {
          const updatedData = await api.getPage(pageId);
          console.log(`[Frontend] 🔄 Reloaded ${updatedData.blocks?.length || 0} blocks from server`);
          setPage(updatedData);
          alert("Página guardada correctamente");
        } catch (reloadError) {
          console.error("Failed to reload page:", reloadError);
          alert("Página guardada pero hubo un error al recargar");
        }
      }
    } catch (error) {
      console.error("Error saving page:", error);
      alert("Error al guardar la página");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlock = () => {
    const newBlock: PageBlock = {
      id: `block-${Date.now()}`,
      type: "text",
      columns: 1,
      row: Math.ceil(page.blocks.length / 4),
      column: (page.blocks.length % 4) + 1,
      text: "",
    };
    setPage({ ...page, blocks: [...page.blocks, newBlock] });
  };

  const handleUpdateBlocks = (updatedBlocks: PageBlock[]) => {
    console.log(`[Page Editor] 📦 Updating blocks: ${page.blocks?.length || 0} → ${updatedBlocks?.length || 0}`);
    const slidesBlocks = updatedBlocks.filter(b => b.type === 'slides');
    console.log(`[Page Editor] 🎬 Slides blocks in handleUpdateBlocks:`, slidesBlocks);
    setPage(prevPage => {
      console.log(`[Page Editor] 📦 Actual prev blocks: ${prevPage.blocks?.length || 0}, new: ${updatedBlocks?.length || 0}`);
      return { ...prevPage, blocks: updatedBlocks };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/panel/pages")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">
          {isNew ? "Nueva Página" : page.title}
        </h1>
      </div>

      {/* Page Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Página</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={page.title}
              onChange={(e) => setPage({ ...page, title: e.target.value })}
              placeholder="Título de la página"
            />
          </div>
          <div>
            <Label htmlFor="slug">Slug (URL) *</Label>
            <Input
              id="slug"
              value={page.slug}
              onChange={(e) => setPage({ ...page, slug: e.target.value })}
              placeholder="slug-de-la-pagina"
            />
          </div>
          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={page.description || ""}
              onChange={(e) => setPage({ ...page, description: e.target.value })}
              placeholder="Descripción de la página"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={page.isPublished}
                onChange={(e) => setPage({ ...page, isPublished: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">Publicar página</span>
            </label>
          </div>

          {/* Página de Inicio */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={page.isHomepage || false}
                  onChange={(e) => setPage({ ...page, isHomepage: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Usar como página de inicio</span>
              </label>
            </div>

            {existingHomepage && page.isHomepage === false && (
              <div className="p-3 mb-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Ya existe otra página marcada como página de inicio. Al marcar esta, la otra será desmarcada.</span>
              </div>
            )}

            {page.isHomepage && existingHomepage && !isNew && (
              <div className="p-3 mb-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 flex gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Esta es la página de inicio actual.</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Page Blocks Editor */}
      <PageBlocksGridEditor
        blocks={page.blocks}
        categories={categories}
        rowsConfig={page.rowsConfig}
        vendorId={vendorId}
        onBlocksChange={handleUpdateBlocks}
        onRowsConfigChange={(newRowsConfig) => {
          console.log(`[Page Editor] 📐 Updating rows config:`, newRowsConfig);
          setPage(prevPage => ({ ...prevPage, rowsConfig: newRowsConfig }));
        }}
        onBlockUpdate={(blockId: string, updated: Partial<PageBlock>) => {
          console.log(`[Page Editor] 📝 Updating block ${blockId}:`, updated);
          setPage(prevPage => {
            const updatedBlocks = prevPage.blocks.map((b) => (b.id === blockId ? { ...b, ...updated } : b));
            console.log(`[Page Editor] 📦 Updated blocks:`, updatedBlocks.find(b => b.id === blockId));
            return {
              ...prevPage,
              blocks: updatedBlocks,
            };
          });
        }}
        onBlockDelete={(blockId: string) =>
          setPage(prevPage => ({
            ...prevPage,
            blocks: prevPage.blocks.filter((b) => b.id !== blockId),
          }))
        }
      />

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push("/panel/pages")}
        >
          Cerrar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-purple-600 to-blue-600"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Guardando..." : "Guardar Página"}
        </Button>
      </div>
    </div>
  );
}
