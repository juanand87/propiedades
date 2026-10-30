"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Image as ImageIcon, Loader2, Save, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MarketplacePresentation from "@/components/predefined/MarketplacePresentation";
import { getImageUrl } from "@/lib/utils";
import {
  defaultMarketplacePresentation,
  MarketplacePresentationConfig,
  PRESENTATION_SLUG,
  parseMarketplacePresentation,
} from "@/lib/marketplacePresentation";

interface StoredPage {
  id: string;
  slug: string;
  blocks?: Array<{ type: string; componentName?: string; text?: string }>;
}

const MARKETPLACE_VENDOR_ID = "00000000-0000-0000-0000-000000000001";

export default function PresentationEditorPage() {
  const [pageId, setPageId] = useState<string | null>(null);
  const [config, setConfig] = useState<MarketplacePresentationConfig>(defaultMarketplacePresentation);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [pages, settings] = await Promise.all([
          api.getPages() as Promise<StoredPage[]>,
          api.getVendorSettings(MARKETPLACE_VENDOR_ID).catch(() => null),
        ]);
        setLogoUrl(settings?.headerConfig?.logo || "");
        const presentation = pages.find((page) => page.slug === PRESENTATION_SLUG);
        if (presentation) {
          setPageId(presentation.id);
          const block = presentation.blocks?.find((item) => item.componentName === "marketplace-presentation");
          setConfig(parseMarketplacePresentation(block?.text));
        }
      } catch (error) {
        console.error("Error loading marketplace presentation:", error);
        setMessage("No se pudo cargar la presentación.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateSection = (index: number, field: string, value: string | string[]) => {
    setConfig((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, [field]: value } : section,
      ),
    }));
  };

  const uploadImage = async (file: File, target: "hero" | "section", sectionIndex?: number) => {
    if (!file.type.startsWith("image/")) {
      setMessage("Selecciona un archivo de imagen válido.");
      return;
    }

    const uploadKey = target === "hero" ? "hero" : `section-${sectionIndex}`;
    setUploadingImage(uploadKey);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploaded = await api.uploadMediaFiles(MARKETPLACE_VENDOR_ID, formData);
      const imageUrl = uploaded?.[0]?.url;
      if (!imageUrl) throw new Error("La carga no devolvió una URL de imagen");

      if (target === "hero") {
        setConfig((current) => ({ ...current, heroImageUrl: imageUrl }));
      } else if (sectionIndex !== undefined) {
        updateSection(sectionIndex, "imageUrl", imageUrl);
      }
      setMessage("Imagen cargada. Guarda y publica para aplicar el cambio.");
    } catch (error) {
      console.error("Error uploading presentation image:", error);
      setMessage("No se pudo cargar la imagen.");
    } finally {
      setUploadingImage(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    const payload = {
      title: "Presentación Marketplace",
      slug: PRESENTATION_SLUG,
      description: "Conoce cómo funciona MundoBeat para tiendas de música.",
      isPublished: true,
      isHomepage: false,
      rowsConfig: [{ row: 0, columns: 1 }],
      blocks: [{
        id: "marketplace-presentation",
        type: "component",
        componentName: "marketplace-presentation",
        text: JSON.stringify(config),
        row: 0,
        column: 1,
      }],
    };

    try {
      const saved = pageId ? await api.updatePage(pageId, payload) : await api.createPage(payload);
      setPageId(saved.id);
      setMessage("Presentación guardada y publicada correctamente.");
    } catch (error) {
      console.error("Error saving marketplace presentation:", error);
      setMessage("No se pudo guardar la presentación.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-sm text-slate-500">Cargando presentación...</div>;

  if (preview) {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-white">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
          <p className="font-semibold">Vista previa sin guardar</p>
          <Button variant="outline" onClick={() => setPreview(false)}>Volver al editor</Button>
        </div>
        <MarketplacePresentation config={config} logoUrl={logoUrl} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-sky-700">Manuales</p>
          <h1 className="text-3xl font-bold text-slate-900">Presentación del marketplace</h1>
          <p className="mt-1 text-slate-600">Edita el contenido comercial y las imágenes de demostración.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreview(true)}>Vista previa</Button>
          <Link href="/presentacion-marketplace" target="_blank"><Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Abrir página</Button></Link>
          <Button onClick={save} disabled={saving || uploadingImage !== null} className="bg-slate-900 hover:bg-slate-800"><Save className="mr-2 h-4 w-4" />{saving ? "Guardando..." : uploadingImage ? "Subiendo imagen..." : "Guardar y publicar"}</Button>
        </div>
      </div>

      {message && <div className="border border-slate-200 bg-white px-4 py-3 text-sm">{message}</div>}

      <Card>
        <CardHeader><CardTitle>Portada</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Logo del header</Label>
            <div className="mt-2 flex flex-wrap items-center gap-4 border bg-slate-50 p-4">
              {logoUrl ? (
                <div className="flex h-20 min-w-52 items-center justify-center bg-white px-4">
                  <img src={getImageUrl(logoUrl)} alt="Logo del marketplace" className="max-h-14 max-w-48 object-contain" />
                </div>
              ) : (
                <div className="flex h-20 min-w-52 items-center justify-center border border-dashed bg-white px-4 text-sm text-slate-500">Sin logo configurado</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-600">La presentación utiliza automáticamente el mismo logo configurado para el header.</p>
                <Link href="/panel/settings"><Button type="button" variant="outline" className="mt-3">Configurar logo del header</Button></Link>
              </div>
            </div>
          </div>
          <div><Label>Etiqueta superior</Label><Input value={config.badge} onChange={(e) => setConfig({ ...config, badge: e.target.value })} /></div>
          <div><Label>Título del botón</Label><Input value={config.ctaText} onChange={(e) => setConfig({ ...config, ctaText: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Título principal</Label><Input value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Introducción</Label><Textarea rows={3} value={config.subtitle} onChange={(e) => setConfig({ ...config, subtitle: e.target.value })} /></div>
          <div><Label>URL del botón</Label><Input value={config.ctaLink} onChange={(e) => setConfig({ ...config, ctaLink: e.target.value })} /></div>
          <div>
            <Label>Imagen principal</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                id="presentation-hero-image"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingImage !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage(file, "hero");
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" asChild disabled={uploadingImage !== null}>
                <label htmlFor="presentation-hero-image" className="cursor-pointer">
                  {uploadingImage === "hero" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {uploadingImage === "hero" ? "Subiendo..." : config.heroImageUrl ? "Cambiar imagen" : "Cargar imagen"}
                </label>
              </Button>
              {config.heroImageUrl && (
                <Button type="button" variant="outline" onClick={() => setConfig((current) => ({ ...current, heroImageUrl: "" }))} disabled={uploadingImage !== null}>
                  <Trash2 className="mr-2 h-4 w-4" />Quitar
                </Button>
              )}
            </div>
          </div>
          <div className="md:col-span-2"><Label>Descripción de la imagen</Label><Input value={config.heroImageAlt} onChange={(e) => setConfig({ ...config, heroImageAlt: e.target.value })} /></div>
          <div className="md:col-span-2">
            {config.heroImageUrl ? <img src={getImageUrl(config.heroImageUrl)} alt={config.heroImageAlt} className="max-h-64 w-full border bg-slate-50 object-contain" /> : <div className="flex h-28 items-center justify-center gap-2 border border-dashed bg-slate-50 text-sm text-slate-500"><ImageIcon className="h-5 w-5" />Sin imagen principal</div>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {config.sections.map((section, index) => (
          <Card key={section.id}>
            <CardHeader className="border-b bg-slate-50"><CardTitle className="flex items-center gap-3 text-lg"><span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm text-white">{index + 1}</span>{section.title}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
              <div><Label>Etapa</Label><Input value={section.phase} onChange={(e) => updateSection(index, "phase", e.target.value)} /></div>
              <div><Label>Categoría</Label><Input value={section.eyebrow} onChange={(e) => updateSection(index, "eyebrow", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Título</Label><Input value={section.title} onChange={(e) => updateSection(index, "title", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Descripción</Label><Textarea rows={3} value={section.description} onChange={(e) => updateSection(index, "description", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Puntos destacados (uno por línea)</Label><Textarea rows={6} value={section.bullets.join("\n")} onChange={(e) => updateSection(index, "bullets", e.target.value.split("\n").filter(Boolean))} /></div>
              <div>
                <Label>Imagen</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input
                    id={`presentation-section-image-${index}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingImage !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadImage(file, "section", index);
                      e.target.value = "";
                    }}
                  />
                  <Button type="button" variant="outline" asChild disabled={uploadingImage !== null}>
                    <label htmlFor={`presentation-section-image-${index}`} className="cursor-pointer">
                      {uploadingImage === `section-${index}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {uploadingImage === `section-${index}` ? "Subiendo..." : section.imageUrl ? "Cambiar imagen" : "Cargar imagen"}
                    </label>
                  </Button>
                  {section.imageUrl && (
                    <Button type="button" variant="outline" onClick={() => updateSection(index, "imageUrl", "")} disabled={uploadingImage !== null}>
                      <Trash2 className="mr-2 h-4 w-4" />Quitar
                    </Button>
                  )}
                </div>
              </div>
              <div><Label>Descripción de imagen</Label><Input value={section.imageAlt} onChange={(e) => updateSection(index, "imageAlt", e.target.value)} /></div>
              <div className="md:col-span-2">
                {section.imageUrl ? <img src={getImageUrl(section.imageUrl)} alt={section.imageAlt} className="max-h-64 w-full border bg-slate-50 object-contain" /> : <div className="flex h-28 items-center justify-center gap-2 border border-dashed bg-slate-50 text-sm text-slate-500"><ImageIcon className="h-5 w-5" />Espacio reservado para la imagen</div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end"><Button onClick={save} disabled={saving || uploadingImage !== null} className="bg-slate-900 hover:bg-slate-800"><Save className="mr-2 h-4 w-4" />{uploadingImage ? "Subiendo imagen..." : "Guardar y publicar"}</Button></div>
    </div>
  );
}
