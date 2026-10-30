"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, Eye, EyeOff, Smartphone, Tablet, Monitor, Upload, Image as ImageIcon, LayoutGrid, Type, BadgePercent, Check } from "lucide-react";
import { api, API_URL } from "@/lib/api";
import Banner from "@/components/Banner";

interface BannerConfig {
  id: string;
  name: string;
  type: 'grid' | 'image' | 'title' | 'offers';
  position: 'top' | 'middle' | 'bottom';
  order: number;
  isActive: boolean;
  usePageMargins?: boolean;
  config: any;
  visibility: {
    mode: 'all' | 'specific' | 'home';
    showInHome: boolean;
    customPages?: { enabled: boolean; pages: string[] };
    categories?: { mode: 'all' | 'specific'; selected: string[] };
    genres?: { mode: 'all' | 'specific'; selected: string[] };
    conditions?: { mode: 'all' | 'specific'; selected: string[] };
  };
  deviceVisibility?: {
    mobile: boolean;
    tablet: boolean;
    desktop: boolean;
  };
}

interface BannerConfigUIProps {
  vendorId: string;
  categories?: any[];
  genres?: any[];
  menuLinks?: string[];
}

export default function BannerConfigUI({ vendorId, categories = [], genres = [], menuLinks = [] }: BannerConfigUIProps) {
  const [banners, setBanners] = useState<BannerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerConfig | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadBanners();
  }, [vendorId]);

  const loadBanners = async () => {
    try {
      const settings = await api.getVendorSettings(vendorId);
      console.log('📦 Settings loaded:', settings);
      console.log('🎨 Banners from settings:', settings?.banners);
      setBanners(settings?.banners || []);
    } catch (error) {
      console.error("Error loading banners:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBanner = () => {
    const newBanner: BannerConfig = {
      id: `banner-${Date.now()}`,
      name: "Nuevo Banner",
      type: "image",
      position: "top",
      order: banners.length,
      isActive: true,
      usePageMargins: true,
      config: {},
      visibility: {
        mode: "all",
        showInHome: true,
      },
      deviceVisibility: {
        mobile: true,
        tablet: true,
        desktop: true,
      },
    };
    setEditingBanner(newBanner);
    setShowModal(true);
  };

  const handleEditBanner = (banner: BannerConfig) => {
    setEditingBanner({ ...banner });
    setShowModal(true);
  };

  const handleDeleteBanner = (bannerId: string) => {
    if (!confirm("¿Estás seguro de eliminar este banner?")) return;
    setBanners(banners.filter(b => b.id !== bannerId));
  };

  const handleSaveBanner = async () => {
    if (!editingBanner) return;

    const existing = banners.find(b => b.id === editingBanner.id);
    const nextBanners = existing ? banners.map(b => b.id === editingBanner.id ? editingBanner : b) : [...banners, editingBanner];
    setSaving(true);
    try {
      await api.updateVendorSettings(vendorId, { banners: nextBanners }, true);
      setBanners(nextBanners);
      setShowModal(false);
      setEditingBanner(null);
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('No se pudo guardar el banner. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      console.log('💾 Saving banners:', banners);
      await api.updateVendorSettings(vendorId, {
        banners,
      }, true); // requireAuth = true
      alert("✅ Banners guardados exitosamente");
      // Recargar para sincronizar con el servidor
      await loadBanners();
    } catch (error) {
      console.error("Error saving banners:", error);
      alert("❌ Error al guardar los banners");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Cargando configuración de banners...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Banners</CardTitle>
              <CardDescription>
                Configura banners personalizados que se mostrarán en diferentes secciones de tu tienda.
                <br />
                <span className="text-xs text-blue-600 mt-1 inline-block">
                  💡 Usa los iconos 📱 💻 🖥️ para controlar en qué dispositivos se muestra cada banner
                </span>
              </CardDescription>
            </div>
            <Button onClick={handleAddBanner} className="bg-sky-600 hover:bg-sky-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Banner
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {banners.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No hay banners configurados</p>
              <p className="text-sm mt-2">Haz clic en "Nuevo Banner" para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {banners.sort((a, b) => a.order - b.order).map((banner, index) => (
                <div
                  key={banner.id}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:border-sky-400 transition-colors"
                >
                  <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{banner.name}</span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">{{ grid: 'Productos', image: 'Imagen', title: 'Título', offers: 'Ofertas' }[banner.type]}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{banner.position}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Visibilidad: {banner.visibility.mode === 'all' ? 'Todo el sitio' : banner.visibility.mode === 'home' ? 'Solo inicio' : 'Páginas específicas'}
                    </p>
                  </div>

                  {/* Device Visibility Icons */}
                  <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded border border-gray-200">
                    <button
                      onClick={() => {
                        const updated = [...banners];
                        if (!updated[index].deviceVisibility) {
                          updated[index].deviceVisibility = { mobile: true, tablet: true, desktop: true };
                        }
                        updated[index].deviceVisibility!.mobile = !updated[index].deviceVisibility!.mobile;
                        setBanners(updated);
                      }}
                      className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                        banner.deviceVisibility?.mobile !== false ? 'text-blue-600' : 'text-gray-300'
                      }`}
                      title={banner.deviceVisibility?.mobile !== false ? 'Visible en móvil' : 'Oculto en móvil'}
                    >
                      <Smartphone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const updated = [...banners];
                        if (!updated[index].deviceVisibility) {
                          updated[index].deviceVisibility = { mobile: true, tablet: true, desktop: true };
                        }
                        updated[index].deviceVisibility!.tablet = !updated[index].deviceVisibility!.tablet;
                        setBanners(updated);
                      }}
                      className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                        banner.deviceVisibility?.tablet !== false ? 'text-blue-600' : 'text-gray-300'
                      }`}
                      title={banner.deviceVisibility?.tablet !== false ? 'Visible en tablet' : 'Oculto en tablet'}
                    >
                      <Tablet className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const updated = [...banners];
                        if (!updated[index].deviceVisibility) {
                          updated[index].deviceVisibility = { mobile: true, tablet: true, desktop: true };
                        }
                        updated[index].deviceVisibility!.desktop = !updated[index].deviceVisibility!.desktop;
                        setBanners(updated);
                      }}
                      className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                        banner.deviceVisibility?.desktop !== false ? 'text-blue-600' : 'text-gray-300'
                      }`}
                      title={banner.deviceVisibility?.desktop !== false ? 'Visible en desktop' : 'Oculto en desktop'}
                    >
                      <Monitor className="w-4 h-4" />
                    </button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const updated = [...banners];
                      updated[index].isActive = !updated[index].isActive;
                      setBanners(updated);
                    }}
                  >
                    {banner.isActive ? (
                      <Eye className="w-4 h-4 text-green-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEditBanner(banner)}>
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteBanner(banner.id)} className="text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {banners.length > 0 && (
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleSaveAll}
                disabled={saving}
                className="bg-sky-600 hover:bg-sky-700"
              >
                {saving ? "Guardando..." : "Guardar Configuración"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edición */}
      {showModal && editingBanner && (
        <BannerEditorModal
          banner={editingBanner}
          onSave={handleSaveBanner}
          onCancel={() => {
            setShowModal(false);
            setEditingBanner(null);
          }}
          onChange={setEditingBanner}
          menuLinks={menuLinks}
          categories={categories}
          vendorId={vendorId}
          uploadingImage={uploadingImage}
          setUploadingImage={setUploadingImage}
          saving={saving}
        />
      )}
    </div>
  );
}

// Modal de Edición de Banner
function BannerEditorModal({
  banner,
  onSave,
  onCancel,
  onChange,
  menuLinks,
  categories,
  vendorId,
  uploadingImage,
  setUploadingImage,
  saving,
}: {
  banner: BannerConfig;
  onSave: () => void;
  onCancel: () => void;
  onChange: (banner: BannerConfig) => void;
  menuLinks: string[];
  categories: any[];
  vendorId: string;
  uploadingImage: boolean;
  setUploadingImage: (value: boolean) => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full my-8">
        <div className="p-6 border-b bg-slate-50 rounded-t-lg">
          <p className="text-xs font-bold uppercase text-sky-600">Diseño de contenido</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Configurar banner</h3>
          <p className="mt-1 text-sm text-slate-500">Elige el formato que mejor comunica tu contenido y revisa el resultado antes de guardarlo.</p>
        </div>
        
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Información Básica */}
          <div className="space-y-4">
            <div>
              <Label>Nombre del Banner</Label>
              <Input
                value={banner.name}
                onChange={(e) => onChange({ ...banner, name: e.target.value })}
                placeholder="Ej: Banner Principal"
              />
            </div>

            <div>
              <Label className="mb-2 block text-base">1. ¿Qué tipo de banner quieres crear?</Label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  { type: 'grid', label: 'Productos', description: 'Mosaico o carrusel automático', icon: LayoutGrid },
                  { type: 'image', label: 'Imagen', description: 'Una pieza gráfica enlazable', icon: ImageIcon },
                  { type: 'title', label: 'Título', description: 'Mensaje sobre color o imagen', icon: Type },
                  { type: 'offers', label: 'Ofertas', description: 'Tarjetas con precios promocionales', icon: BadgePercent },
                ] as const).map((option) => {
                  const Icon = option.icon;
                  const selected = banner.type === option.type;
                  return <button key={option.type} type="button" onClick={() => onChange({ ...banner, type: option.type, config: option.type === banner.type ? banner.config : option.type === 'offers' ? { backgroundColor: '#ef1017', columns: 3, imageHeight: '420px', offers: Array.from({ length: 3 }, () => ({ imageUrl: '', brand: '', title: '', salePrice: '', normalPrice: '', badge: '', linkUrl: '' })) } : {} })} className={`relative rounded-lg border p-3 text-left transition-all ${selected ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-100' : 'border-slate-200 hover:border-sky-300 hover:bg-slate-50'}`}>
                    {selected && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white"><Check className="h-3 w-3" /></span>}
                    <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${selected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-5 w-5" /></span>
                    <span className="block text-sm font-bold text-slate-900">{option.label}</span><span className="mt-1 block text-xs leading-4 text-slate-500">{option.description}</span>
                  </button>;
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>2. Ubicación</Label>
                <select
                  value={banner.position}
                  onChange={(e) => onChange({ ...banner, position: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="top">Superior</option>
                  <option value="middle">Medio</option>
                  <option value="bottom">Inferior</option>
                </select>
              </div>

              <div>
                <Label>Estado</Label>
                <div className="flex items-center gap-2 h-[42px]">
                  <input
                    type="checkbox"
                    checked={banner.isActive}
                    onChange={(e) => onChange({ ...banner, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{banner.isActive ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <span className="block text-sm font-semibold text-slate-900">Margen exterior</span>
                <span className="block text-xs text-slate-500">Deja separación alrededor del banner y limita su ancho.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600">{(banner.usePageMargins ?? (banner.position !== 'top')) ? 'Con margen' : 'Sin margen'}</span>
                <input type="checkbox" checked={banner.usePageMargins ?? (banner.position !== 'top')} onChange={(e) => onChange({ ...banner, usePageMargins: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
              </div>
            </label>
          </div>

          {/* Configuración según tipo */}
          <BannerTypeConfig 
            banner={banner} 
            onChange={onChange} 
            vendorId={vendorId}
            categories={categories}
            uploadingImage={uploadingImage}
            setUploadingImage={setUploadingImage}
          />

          {/* Configuración de Visibilidad */}
          <VisibilityConfig
            banner={banner}
            onChange={onChange}
            menuLinks={menuLinks}
          />

          {/* Vista Previa */}
          <div>
            <Label className="mb-2 block">Vista Previa</Label>
            <div className="border rounded-lg overflow-hidden">
              <Banner type={banner.type} config={banner.config} />
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving || uploadingImage} className="bg-sky-600 hover:bg-sky-700">
            {saving ? 'Guardando...' : 'Guardar banner'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Configuración específica según tipo de banner
function BannerTypeConfig({
  banner,
  onChange,
  vendorId,
  categories,
  uploadingImage,
  setUploadingImage,
}: {
  banner: BannerConfig;
  onChange: (banner: BannerConfig) => void;
  vendorId: string;
  categories: any[];
  uploadingImage: boolean;
  setUploadingImage: (value: boolean) => void;
}) {
  const config = banner.config || {};
  const uploadFile = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`${API_URL}/vendors/${vendorId}/upload-files`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      return data.files?.[0]?.url as string | undefined;
    } finally {
      setUploadingImage(false);
    }
  };

  if (banner.type === 'grid') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración del Grid</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 cursor-pointer">
            <div>
              <span className="block text-sm font-semibold text-gray-900">Transformar en Slide</span>
              <span className="block text-xs text-gray-500">Muestra el grid como carrusel horizontal con flechas laterales.</span>
            </div>
            <input
              type="checkbox"
              checked={Boolean(config.transformToSlide)}
              onChange={(e) => onChange({
                ...banner,
                config: { ...config, transformToSlide: e.target.checked },
              })}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Columnas</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={config.columns || 4}
                onChange={(e) => onChange({
                  ...banner,
                  config: { ...config, columns: parseInt(e.target.value) },
                })}
              />
              <p className="text-xs text-gray-500 mt-1">Máximo: 30 columnas</p>
            </div>
            <div>
              <Label>Filas</Label>
              <Input
                type="number"
                min="1"
                max="70"
                value={config.rows || 2}
                onChange={(e) => onChange({
                  ...banner,
                  config: { ...config, rows: parseInt(e.target.value) },
                })}
              />
              <p className="text-xs text-gray-500 mt-1">Máximo: 70 filas</p>
            </div>
          </div>

          {/* Filtro de Productos */}
          <div className="border-t pt-4">
            <Label className="text-base mb-3 block">Filtro de Productos</Label>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Mostrar productos:</Label>
                <select
                  value={config.productFilter?.type || 'all'}
                  onChange={(e) => onChange({
                    ...banner,
                    config: { 
                      ...config, 
                      productFilter: { 
                        ...config.productFilter, 
                        type: e.target.value,
                        categories: e.target.value === 'category' ? (config.productFilter?.categories || []) : undefined
                      } 
                    },
                  })}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                >
                  <option value="all">Todos los productos</option>
                  <option value="new">Solo productos nuevos</option>
                  <option value="used">Solo productos usados</option>
                  <option value="category">Por categoría</option>
                </select>
              </div>

              {/* Selector de Categorías */}
              {config.productFilter?.type === 'category' && (
                <div className="pl-4 border-l-2 border-purple-200 space-y-2">
                  <Label className="text-sm font-medium">Selecciona categorías:</Label>
                  {categories.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No hay categorías disponibles</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {categories.map((category) => (
                        <div key={category.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`category-${category.id}`}
                            checked={(config.productFilter?.categories || []).includes(category.id)}
                            onChange={(e) => {
                              const currentCategories = config.productFilter?.categories || [];
                              const newCategories = e.target.checked
                                ? [...currentCategories, category.id]
                                : currentCategories.filter((id: string) => id !== category.id);
                              onChange({
                                ...banner,
                                config: { 
                                  ...config, 
                                  productFilter: { 
                                    ...config.productFilter, 
                                    categories: newCategories 
                                  } 
                                },
                              });
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <Label 
                            htmlFor={`category-${category.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {category.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Las imágenes se cargarán automáticamente desde los productos según el filtro seleccionado
          </p>
        </CardContent>
      </Card>
    );
  }

  if (banner.type === 'offers') {
    const offers = Array.isArray(config.offers) ? config.offers : [];
    const updateOffer = (index: number, changes: any) => onChange({ ...banner, config: { ...config, offers: offers.map((offer: any, offerIndex: number) => offerIndex === index ? { ...offer, ...changes } : offer) } });
    const addOffer = () => onChange({ ...banner, config: { ...config, offers: [...offers, { imageUrl: '', brand: '', title: '', salePrice: '', normalPrice: '', badge: '', linkUrl: '' }] } });
    return <Card className="border-sky-100">
      <CardHeader><CardTitle className="text-base">Configuración de ofertas</CardTitle><CardDescription>Crea tarjetas promocionales con imagen, precio y enlace. En móvil se podrán deslizar horizontalmente.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Color del área</Label><Input type="color" value={config.backgroundColor || '#ef1017'} onChange={e => onChange({ ...banner, config: { ...config, backgroundColor: e.target.value } })} className="h-10" /></div>
          <div><Label>Columnas en escritorio</Label><Input type="number" min="1" max="5" value={config.columns || 3} onChange={e => onChange({ ...banner, config: { ...config, columns: Number(e.target.value) || 3 } })} /></div>
          <div><Label>Altura de imagen</Label><Input value={config.imageHeight || '420px'} onChange={e => onChange({ ...banner, config: { ...config, imageHeight: e.target.value } })} /></div>
        </div>
        <div className="space-y-4">
          {offers.map((offer: any, index: number) => <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-bold text-slate-900">Oferta {index + 1}</p><p className="text-xs text-slate-500">Producto o promoción destacada</p></div><Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...banner, config: { ...config, offers: offers.filter((_: any, i: number) => i !== index) } })} className="text-red-600"><Trash2 className="h-4 w-4" /></Button></div>
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div><div className="aspect-square overflow-hidden rounded-lg border bg-white">{offer.imageUrl ? <img src={offer.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><ImageIcon className="h-8 w-8" /></div>}</div><label className="mt-2 flex cursor-pointer items-center justify-center rounded-md border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-sky-400"><Upload className="mr-2 h-4 w-4" />{uploadingImage ? 'Subiendo...' : 'Cargar imagen'}<input type="file" accept="image/*" className="hidden" disabled={uploadingImage} onChange={async e => { const file=e.target.files?.[0]; if(!file)return; try { const url=await uploadFile(file); if(url)updateOffer(index,{imageUrl:url}); } catch { alert('No se pudo subir la imagen'); } e.target.value=''; }} /></label></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><Label>Marca o artista</Label><Input value={offer.brand || ''} onChange={e => updateOffer(index,{brand:e.target.value})} placeholder="Ej: MundoBeat" /></div><div><Label>Nombre de la oferta</Label><Input value={offer.title || ''} onChange={e => updateOffer(index,{title:e.target.value})} placeholder="Ej: Vinilos seleccionados" /></div><div><Label>Precio oferta</Label><Input type="number" min="0" value={offer.salePrice || ''} onChange={e => updateOffer(index,{salePrice:e.target.value})} placeholder="19990" /></div><div><Label>Precio normal</Label><Input type="number" min="0" value={offer.normalPrice || ''} onChange={e => updateOffer(index,{normalPrice:e.target.value})} placeholder="29990" /></div><div><Label>Distintivo (opcional)</Label><Input value={offer.badge || ''} onChange={e => updateOffer(index,{badge:e.target.value})} placeholder="Solo esta semana" /></div><div><Label>Enlace</Label><Input value={offer.linkUrl || ''} onChange={e => updateOffer(index,{linkUrl:e.target.value})} placeholder="/productos/..." /></div></div>
            </div>
          </div>)}
        </div>
        <Button type="button" variant="outline" onClick={addOffer} className="w-full border-dashed border-sky-300 text-sky-700"><Plus className="mr-2 h-4 w-4" />Agregar oferta</Button>
      </CardContent>
    </Card>;
  }

  if (banner.type === 'image') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración de Imagen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Imagen del Banner</Label>
            
            {/* Preview de la imagen */}
            {config.imageUrl && (
              <div className="mb-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
                <img 
                  src={config.imageUrl} 
                  alt="Banner preview" 
                  className="max-h-32 object-contain rounded"
                />
              </div>
            )}

            {/* Botón para cargar archivo */}
            <div className="flex gap-2 mb-2">
              <input
                type="file"
                accept="image/*"
                id={`banner-image-upload-${banner.id}`}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    console.log('⚠️ No file selected');
                    return;
                  }

                  console.log('📤 Starting upload:', file.name, file.type, file.size);
                  setUploadingImage(true);
                  try {
                    const formData = new FormData();
                    formData.append("files", file);

                    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                    const headers: HeadersInit = {};
                    if (token) {
                      headers['Authorization'] = `Bearer ${token}`;
                    }

                    const uploadUrl = `${API_URL}/vendors/${vendorId}/upload-files`;
                    console.log('🌐 Uploading to:', uploadUrl);
                    
                    const response = await fetch(uploadUrl, {
                      method: "POST",
                      headers,
                      body: formData,
                    });

                    console.log('📥 Response status:', response.status, response.statusText);

                    if (!response.ok) {
                      const errorText = await response.text();
                      console.error('❌ Upload failed:', errorText);
                      throw new Error(`Upload failed: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('✅ Image uploaded successfully:', data);

                    // Actualizar la URL de la imagen
                    if (data.files && data.files.length > 0) {
                      const newImageUrl = data.files[0].url;
                      console.log('🖼️ Setting new image URL:', newImageUrl);
                      onChange({
                        ...banner,
                        config: { ...config, imageUrl: newImageUrl },
                      });
                      console.log('✅ Banner config updated');
                    } else {
                      console.warn('⚠️ No files in response:', data);
                    }
                  } catch (error) {
                    console.error('❌ Error uploading image:', error);
                    alert('Error al subir la imagen. Por favor intenta de nuevo.');
                  } finally {
                    setUploadingImage(false);
                    // Reset input para permitir subir la misma imagen de nuevo
                    e.target.value = '';
                  }
                }}
              />
              <label
                htmlFor={`banner-image-upload-${banner.id}`}
                className="flex-1"
              >
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={uploadingImage}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`banner-image-upload-${banner.id}`)?.click();
                  }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingImage ? 'Subiendo...' : 'Subir Imagen'}
                </Button>
              </label>
            </div>

            {/* Input manual de URL (opcional) */}
            <Input
              value={config.imageUrl || ''}
              onChange={(e) => onChange({
                ...banner,
                config: { ...config, imageUrl: e.target.value },
              })}
              placeholder="O pega una URL: https://ejemplo.com/imagen.jpg"
            />
          </div>
          <div>
            <Label>Link (opcional)</Label>
            <Input
              value={config.linkUrl || ''}
              onChange={(e) => onChange({
                ...banner,
                config: { ...config, linkUrl: e.target.value },
              })}
              placeholder="/pagina-destino"
            />
          </div>
          <div>
            <Label>Altura</Label>
            <Input
              value={config.height || '400px'}
              onChange={(e) => onChange({
                ...banner,
                config: { ...config, height: e.target.value },
              })}
              placeholder="400px"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (banner.type === 'title') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración de Título</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input
              value={config.title || ''}
              onChange={(e) => onChange({
                ...banner,
                config: { ...config, title: e.target.value },
              })}
              placeholder="Título principal"
            />
          </div>
          <div>
            <Label>Subtítulo (opcional)</Label>
            <Input
              value={config.subtitle || ''}
              onChange={(e) => onChange({
                ...banner,
                config: { ...config, subtitle: e.target.value },
              })}
              placeholder="Texto secundario"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Color de Fondo</Label>
              <Input
                type="color"
                value={config.backgroundColor || '#9333ea'}
                onChange={(e) => onChange({
                  ...banner,
                  config: { ...config, backgroundColor: e.target.value },
                })}
              />
            </div>
            <div>
              <Label>Color de Texto</Label>
              <Input
                type="color"
                value={config.textColor || '#ffffff'}
                onChange={(e) => onChange({
                  ...banner,
                  config: { ...config, textColor: e.target.value },
                })}
              />
            </div>
          </div>
          <div>
            <Label>Imagen de Fondo (opcional)</Label>
            <Input
              value={config.backgroundImage || ''}
              onChange={(e) => onChange({
                ...banner,
                config: { ...config, backgroundImage: e.target.value },
              })}
              placeholder="URL de imagen de fondo"
            />
          </div>
          <div>
            <Label>Altura</Label>
            <Input
              value={config.height || '300px'}
              onChange={(e) => onChange({
                ...banner,
                config: { ...config, height: e.target.value },
              })}
              placeholder="300px"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// Configuración de visibilidad (similar a menú lateral)
function VisibilityConfig({
  banner,
  onChange,
  menuLinks,
}: {
  banner: BannerConfig;
  onChange: (banner: BannerConfig) => void;
  menuLinks: string[];
}) {
  const visibility = banner.visibility;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">¿Dónde se mostrará este banner?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              checked={visibility.mode === 'all'}
              onChange={() => onChange({
                ...banner,
                visibility: { ...visibility, mode: 'all' },
              })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">🌐 Todo el sitio web</div>
              <div className="text-sm text-gray-600">Aparecerá en todas las páginas de la tienda</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              checked={visibility.mode === 'home'}
              onChange={() => onChange({
                ...banner,
                visibility: { ...visibility, mode: 'home', showInHome: true },
              })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">🏠 Solo página de inicio</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              checked={visibility.mode === 'specific'}
              onChange={() => onChange({
                ...banner,
                visibility: { ...visibility, mode: 'specific', showInHome: false },
              })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">📍 Secciones específicas</div>
              <div className="text-sm text-gray-600">Selecciona en qué páginas del menú aparecerá</div>
            </div>
          </label>
        </div>

        {visibility.mode === 'specific' && (
          <div className="ml-7 border-l-2 border-purple-200 pl-4">
            {/* Checkbox para incluir página de inicio */}
            <label className="flex items-center gap-2 cursor-pointer mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <input
                type="checkbox"
                checked={visibility.showInHome || false}
                onChange={(e) => onChange({
                  ...banner,
                  visibility: {
                    ...visibility,
                    showInHome: e.target.checked
                  },
                })}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-900">✨ También mostrar en página de inicio</span>
            </label>
            {menuLinks.length > 0 ? (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 mb-3">
                  Selecciona las secciones donde aparecerá el banner:
                </div>
                {menuLinks.map((link, idx) => (
                  <label key={idx} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={visibility.customPages?.pages?.includes(link) || false}
                      onChange={(e) => {
                        const currentPages = visibility.customPages?.pages || [];
                        const newPages = e.target.checked
                          ? [...currentPages, link]
                          : currentPages.filter(p => p !== link);
                        onChange({
                          ...banner,
                          visibility: {
                            ...visibility,
                            customPages: {
                              enabled: newPages.length > 0,
                              pages: newPages
                            }
                          },
                        });
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm">{link}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic p-3 bg-gray-50 rounded">
                No hay páginas en el menú. Configura tu menú primero en la sección "Menú" de configuración.
              </div>
            )}
          </div>
        )}

        {/* Visibilidad por Dispositivos */}
        <div className="pt-4 border-t">
          <Label className="text-sm font-semibold mb-3 block">📱 Visibilidad por Dispositivos</Label>
          <div className="grid grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-purple-400 transition-colors">
              <input
                type="checkbox"
                checked={banner.deviceVisibility?.mobile !== false}
                onChange={(e) => onChange({
                  ...banner,
                  deviceVisibility: {
                    mobile: e.target.checked,
                    tablet: banner.deviceVisibility?.tablet !== false,
                    desktop: banner.deviceVisibility?.desktop !== false,
                  },
                })}
                className="w-4 h-4"
              />
              <Smartphone className={`w-5 h-5 ${banner.deviceVisibility?.mobile !== false ? 'text-blue-600' : 'text-gray-400'}`} />
              <div>
                <div className="font-medium text-sm">Móvil</div>
                <div className="text-xs text-gray-500">&lt; 768px</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-purple-400 transition-colors">
              <input
                type="checkbox"
                checked={banner.deviceVisibility?.tablet !== false}
                onChange={(e) => onChange({
                  ...banner,
                  deviceVisibility: {
                    mobile: banner.deviceVisibility?.mobile !== false,
                    tablet: e.target.checked,
                    desktop: banner.deviceVisibility?.desktop !== false,
                  },
                })}
                className="w-4 h-4"
              />
              <Tablet className={`w-5 h-5 ${banner.deviceVisibility?.tablet !== false ? 'text-blue-600' : 'text-gray-400'}`} />
              <div>
                <div className="font-medium text-sm">Tablet</div>
                <div className="text-xs text-gray-500">768px - 1024px</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:border-purple-400 transition-colors">
              <input
                type="checkbox"
                checked={banner.deviceVisibility?.desktop !== false}
                onChange={(e) => onChange({
                  ...banner,
                  deviceVisibility: {
                    mobile: banner.deviceVisibility?.mobile !== false,
                    tablet: banner.deviceVisibility?.tablet !== false,
                    desktop: e.target.checked,
                  },
                })}
                className="w-4 h-4"
              />
              <Monitor className={`w-5 h-5 ${banner.deviceVisibility?.desktop !== false ? 'text-blue-600' : 'text-gray-400'}`} />
              <div>
                <div className="font-medium text-sm">Desktop</div>
                <div className="text-xs text-gray-500">&gt; 1024px</div>
              </div>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
