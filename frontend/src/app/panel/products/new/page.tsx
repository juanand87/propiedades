"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import DiscogsSearch, { ProductImage } from "@/components/DiscogsSearch";
import ImageGallery from "@/components/ImageGallery";

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [vendorId, setVendorId] = useState<string>("");
  const [isWholesaleEnabled, setIsWholesaleEnabled] = useState(false);
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [shortDescriptionTemplate, setShortDescriptionTemplate] = useState<string>("");
  const [technicalSpecsTemplate, setTechnicalSpecsTemplate] = useState<string>("");
  
  // Estado para el modal de activar categorías
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [allMarketplaceCategories, setAllMarketplaceCategories] = useState<any[]>([]);
  const [categoriesToActivate, setCategoriesToActivate] = useState<string[]>([]);
  const [activatingCategories, setActivatingCategories] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    shortDescription: "",
    description: "",
    descriptionGeneratedByAI: false,
    condition: "",
    mediaGrade: "",
    sleeveGrade: "",
    artist: "",
    album: "",
    label: "",
    year: "",
    genre: "",
    format: "",
    country: "",
    tracklist: "",
    technicalSpecs: "",
    price: "",
    salePrice: "",
    isOnSale: false,
    wholesalePrice: "",
    stock: "",
    sku: "",
    categoryId: "",
    spotifyAlbumId: "",
    spotifyEnabled: true,
  });

  useEffect(() => {
    loadVendorProfile();
  }, []);

  const loadVendorProfile = async () => {
    try {
      console.log("Loading vendor profile...");
      const vendor = await api.getMyVendor();
      console.log("Vendor response:", vendor);
      console.log("Vendor ID:", vendor.id);
      
      if (vendor.id) {
        setVendorId(vendor.id);
        console.log("VendorId set to:", vendor.id);
      } else {
        console.error("Vendor ID is undefined!");
      }
      
      // Cargar configuración del vendor
      const settings = await api.getVendorSettings(vendor.id);
      console.log("Settings loaded:", settings);
      console.log("Gemini enabled:", settings.geminiEnabled);
      setGeminiEnabled(settings.geminiEnabled || false);
      setShortDescriptionTemplate(settings.shortDescriptionTemplate || "");
      setTechnicalSpecsTemplate(settings.technicalSpecsTemplate || "");
      
      // Cargar categorías del vendor
      const vendorCategories = await api.getVendorCategories(vendor.id);
      const activeCategories = vendorCategories.filter((cat: any) => cat.isActive);
      setCategories(activeCategories);
      
      // Si no hay categorías activas, mostrar el modal para activar
      if (activeCategories.length === 0) {
        const allCategories = await api.getCategories();
        setAllMarketplaceCategories(allCategories);
        setShowCategoryModal(true);
      }
    } catch (error) {
      console.error("Error loading vendor profile:", error);
    }
  };

  const applyShortDescriptionTemplate = (release: any): string => {
    if (!shortDescriptionTemplate) return "";
    
    let result = shortDescriptionTemplate;
    
    // Reemplazar shortcodes con datos del release
    const replacements: Record<string, string> = {
      '[title]': release.title || '',
      '[artist]': release.artists?.map((a: any) => a.name).join(', ') || '',
      '[year]': release.year?.toString() || '',
      '[format]': release.formats?.map((f: any) => f.name).join(', ') || '',
      '[label]': release.labels?.[0]?.name || '',
      '[country]': release.country || '',
      '[genre]': release.genres?.join(', ') || '',
      '[style]': release.styles?.join(', ') || '',
      '[catalog]': release.labels?.[0]?.catno || '',
      '[barcode]': release.identifiers?.find((id: any) => id.type === 'Barcode')?.value || '',
      '[notes]': release.notes || '',
      '[released]': release.released || '',
      '[credits]': release.extraartists?.map((a: any) => `${a.name} (${a.role})`).join(', ') || '',
    };
    
    // Aplicar todos los reemplazos
    Object.entries(replacements).forEach(([shortcode, value]) => {
      result = result.replace(new RegExp(shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
    
    return result;
  };

  const applyTechnicalSpecsTemplate = (release: any): string => {
    if (!technicalSpecsTemplate) {
      // Si no hay template, usar construcción manual por defecto
      const techSpecs: string[] = [];
      if (release.country) techSpecs.push(`País: ${release.country}`);
      if (release.released) techSpecs.push(`Fecha de lanzamiento: ${release.released}`);
      if (release.formats) {
        release.formats.forEach((f: any) => {
          if (f.text) techSpecs.push(f.text);
        });
      }
      if (release.identifiers && release.identifiers.length > 0) {
        release.identifiers.forEach((id: any) => {
          techSpecs.push(`${id.type}: ${id.value}`);
        });
      }
      return techSpecs.join("\n");
    }
    
    let result = technicalSpecsTemplate;
    
    // Reemplazar shortcodes con datos del release
    const replacements: Record<string, string> = {
      '[title]': release.title || '',
      '[artist]': release.artists?.map((a: any) => a.name).join(', ') || '',
      '[year]': release.year?.toString() || '',
      '[format]': release.formats?.map((f: any) => {
        let str = f.name;
        if (f.descriptions && f.descriptions.length > 0) {
          str += ` (${f.descriptions.join(", ")})`;
        }
        return str;
      }).join(', ') || '',
      '[label]': release.labels?.[0]?.name || '',
      '[country]': release.country || '',
      '[genre]': release.genres?.join(', ') || '',
      '[style]': release.styles?.join(', ') || '',
      '[catalog]': release.labels?.[0]?.catno || '',
      '[barcode]': release.identifiers?.find((id: any) => id.type === 'Barcode')?.value || '',
      '[notes]': release.notes || '',
      '[released]': release.released || '',
      '[credits]': release.extraartists?.map((a: any) => `${a.name} (${a.role})`).join(', ') || '',
    };
    
    // Aplicar todos los reemplazos
    Object.entries(replacements).forEach(([shortcode, value]) => {
      result = result.replace(new RegExp(shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
    
    return result;
  };

  const handleDiscogsSelect = async (release: any) => {
    console.log("Release data from Discogs:", release);
    
    // Procesar imágenes si vienen del release
    if (release.images && release.images.length > 0) {
      try {
        // Subir imágenes al servidor
        const imageUrls = release.images.map((img: ProductImage) => img.url);
        const uploadedUrls = await api.uploadImages(vendorId, imageUrls);
        
        // Crear array de ProductImage con las URLs locales
        const uploadedImages: ProductImage[] = uploadedUrls.map((url, index) => ({
          url,
          isPrimary: release.images[index].isPrimary,
          order: release.images[index].order,
        }));
        
        setProductImages(uploadedImages);
      } catch (error) {
        console.error("Error uploading images:", error);
        alert("Error al subir las imágenes");
      }
    }
    
    // Construir título completo con artista y álbum
    const artists = release.artists?.map((a: any) => a.name).join(", ") || "";
    const fullTitle = artists ? `${artists} - ${release.title}` : release.title;
    
    // Construir formato detallado
    const formats = release.formats?.map((f: any) => {
      let formatStr = f.name;
      if (f.descriptions && f.descriptions.length > 0) {
        formatStr += ` (${f.descriptions.join(", ")})`;
      }
      if (f.qty && f.qty > 1) {
        formatStr += ` x${f.qty}`;
      }
      return formatStr;
    }).join(", ") || "";
    
    // Auto-seleccionar categoría basada en el formato de Discogs
    let selectedCategoryId = formData.categoryId;
    if (release.formats && release.formats.length > 0) {
      console.log("🔍 Formatos desde Discogs:", release.formats.map((f: any) => ({ name: f.name, descriptions: f.descriptions })));
      console.log("📋 Categorías disponibles:", categories.map(cat => ({ id: cat.id, name: cat.name, format: cat.format })));
      
      // Mapa ampliado de formatos de Discogs a formatos de BD
      const formatMap: { [key: string]: string } = {
        'vinyl': 'vinilo',
        'shellac': 'vinilo',
        'flexi-disc': 'vinilo',
        'acetate': 'vinilo',
        'lathe cut': 'vinilo',
        'cd': 'cd',
        'cdr': 'cd',
        'sacd': 'cd',
        'hybrid': 'cd',
        'minidisc': 'cd',
        'cassette': 'cassette',
        '8-track cartridge': 'cassette',
        'reel-to-reel': 'cassette',
        'microcassette': 'cassette',
        'vhs': 'vhs',
        'betamax': 'vhs',
        'video 8': 'vhs',
        'dvd': 'dvd',
        'dvd-video': 'dvd',
        'dvd-audio': 'dvd',
        'hd dvd': 'dvd',
        'laserdisc': 'dvd',
        'blu-ray': 'bluray',
        'blu-ray-a': 'bluray',
        'ultra hd blu-ray': 'bluray',
        'file': 'digital',
        'digital': 'digital',
      };
      
      // Descripciones que indican vinilo
      const vinylDescriptions = ['lp', '7"', '10"', '12"', '16"', '45 rpm', '33 rpm', '78 rpm', 'single sided', 'picture disc', 'shaped'];
      
      // Función para buscar categoría por formato normalizado
      const findCategory = (format: string) => {
        const normalized = formatMap[format.toLowerCase()] || format.toLowerCase();
        return categories.find(cat => cat.format === normalized);
      };
      
      // 1. Intentar con el formato principal
      let matchingCategory = findCategory(release.formats[0].name);
      console.log("🔄 Intento 1 - formato principal:", release.formats[0].name, "→", matchingCategory?.name || 'no match');
      
      // 2. Si no coincide (ej: "Box Set", "All Media"), buscar en los demás formatos
      if (!matchingCategory && release.formats.length > 1) {
        for (let i = 1; i < release.formats.length; i++) {
          matchingCategory = findCategory(release.formats[i].name);
          if (matchingCategory) {
            console.log(`🔄 Intento 2 - formato secundario [${i}]:`, release.formats[i].name, "→", matchingCategory.name);
            break;
          }
        }
      }
      
      // 3. Si aún no coincide, analizar las descripciones de todos los formatos
      if (!matchingCategory) {
        for (const fmt of release.formats) {
          if (fmt.descriptions && Array.isArray(fmt.descriptions)) {
            const descs = fmt.descriptions.map((d: string) => d.toLowerCase());
            if (descs.some((d: string) => vinylDescriptions.includes(d))) {
              matchingCategory = categories.find(cat => cat.format === 'vinilo');
              if (matchingCategory) {
                console.log('🔄 Intento 3 - descripción indica vinilo:', fmt.descriptions);
                break;
              }
            }
          }
        }
      }
      
      if (matchingCategory) {
        selectedCategoryId = matchingCategory.id;
        console.log(`✅ Auto-seleccionada categoría "${matchingCategory.name}"`);
      } else {
        console.log(`⚠️ No se encontró categoría para formatos:`, release.formats.map((f: any) => f.name));
      }
    }
    
    // Construir tracklist detallado
    const tracklist = release.tracklist?.map((t: any) => {
      let trackStr = t.position ? `${t.position}. ` : "";
      trackStr += t.title;
      if (t.duration) {
        trackStr += ` (${t.duration})`;
      }
      return trackStr;
    }).join("\n") || "";
    
    // Generar datos técnicos usando el template
    const generatedTechnicalSpecs = applyTechnicalSpecsTemplate(release);
    
    // Construir descripción
    let description = `${fullTitle}${release.year ? ` (${release.year})` : ""}`;
    if (release.labels && release.labels.length > 0) {
      description += `\nSello: ${release.labels.map((l: any) => l.name).join(", ")}`;
    }
    if (release.genres && release.genres.length > 0) {
      description += `\nGénero: ${release.genres.join(", ")}`;
    }
    if (release.styles && release.styles.length > 0) {
      description += `\nEstilo: ${release.styles.join(", ")}`;
    }
    if (release.notes) {
      description += `\n\n${release.notes}`;
    }
    
    // Generar descripción corta usando el template
    const generatedShortDescription = applyShortDescriptionTemplate(release);
    
    // Obtener número de catálogo para el SKU y eliminar todos los espacios
    const catalogNumber = (release.labels?.[0]?.catno || "").replace(/\s+/g, "");
    
    // Mapear datos al formulario
    const updatedFormData = {
      ...formData,
      title: fullTitle,
      artist: artists,
      album: release.title || "",
      label: release.labels?.[0]?.name || "",
      year: release.year ? release.year.toString() : "",
      genre: release.genres?.join(", ") || "",
      format: formats,
      country: release.country || "",
      tracklist: tracklist,
      technicalSpecs: generatedTechnicalSpecs,
      description: description.trim(),
      shortDescription: generatedShortDescription,
      sku: catalogNumber, // Auto-llenar SKU sin espacios (ej: "50999 6384501 3" → "5099963845013")
    };
    
    setFormData(updatedFormData);
    
    // Auto-seleccionar categoría en el array de selectedCategories
    if (selectedCategoryId && !selectedCategories.includes(selectedCategoryId)) {
      console.log("📌 Agregando categoría al array selectedCategories:", selectedCategoryId);
      setSelectedCategories([...selectedCategories, selectedCategoryId]);
    }
    
    // Buscar automáticamente en Spotify si hay artista y álbum
    if (artists && release.title && vendorId) {
      try {
        const query = `${artists} ${release.title}`;
        const data = await api.searchSpotify(vendorId, query);
        if (data.albums && data.albums.length > 0) {
          // Auto-seleccionar el primer resultado de Spotify
          updatedFormData.spotifyAlbumId = data.albums[0].id;
          setFormData(updatedFormData);
        }
      } catch (error) {
        console.error("Error auto-buscando en Spotify:", error);
        // No mostrar error al usuario, simplemente no autocompletar Spotify
      }
    }
    
    alert("¡Datos importados desde Discogs! Revisa y completa la información necesaria.");
  };

  const handleUploadLocalImages = async (files: FileList): Promise<string[]> => {
    try {
      const urls = await api.uploadFiles(vendorId, files);
      return urls;
    } catch (error) {
      console.error('Error uploading files:', error);
      throw error;
    }
  };

  const handleActivateCategories = async () => {
    if (categoriesToActivate.length === 0) {
      alert("Por favor, selecciona al menos una categoría");
      return;
    }

    setActivatingCategories(true);
    try {
      // Actualizar las categorías del vendor
      await api.updateVendorCategories(vendorId, categoriesToActivate);
      
      // Recargar las categorías activas
      const vendorCategories = await api.getVendorCategories(vendorId);
      const activeCategories = vendorCategories.filter((cat: any) => cat.isActive);
      setCategories(activeCategories);
      
      // Cerrar el modal
      setShowCategoryModal(false);
      setCategoriesToActivate([]);
    } catch (error) {
      console.error("Error activating categories:", error);
      alert("Error al activar las categorías. Por favor, intenta nuevamente.");
    } finally {
      setActivatingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validar campos requeridos
    if (!formData.condition) {
      alert("Por favor selecciona una condición");
      return;
    }
    if (!formData.title.trim()) {
      alert("Por favor ingresa un título");
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      alert("Por favor ingresa un precio válido");
      return;
    }
    if (!formData.stock || parseInt(formData.stock) < 0) {
      alert("Por favor ingresa un stock válido");
      return;
    }
    
    setLoading(true);

    try {
      // Convertir imágenes a formato para la API (array de strings)
      const imagesArray = productImages.map(img => img.url);

      const data: any = {
        title: formData.title,
        shortDescription: formData.shortDescription || undefined,
        description: formData.description,
        condition: formData.condition as 'new' | 'used',
        mediaGrade: formData.mediaGrade || undefined,
        sleeveGrade: formData.sleeveGrade || undefined,
        artist: formData.artist || undefined,
        album: formData.album || undefined,
        label: formData.label || undefined,
        year: formData.year ? parseInt(formData.year) : undefined,
        genre: formData.genre || undefined,
        format: formData.format || undefined,
        country: formData.country || undefined,
        tracklist: formData.tracklist || undefined,
        technicalSpecs: formData.technicalSpecs || undefined,
        price: Math.round(parseFloat(formData.price)),
        salePrice: formData.salePrice ? Math.round(parseFloat(formData.salePrice)) : undefined,
        isOnSale: formData.isOnSale,
        wholesalePrice: formData.wholesalePrice ? Math.round(parseFloat(formData.wholesalePrice)) : undefined,
        stock: parseInt(formData.stock),
        sku: formData.sku || undefined,
        images: imagesArray,
        categoryIds: selectedCategories,
        spotifyAlbumId: formData.spotifyAlbumId || undefined,
        spotifyEnabled: formData.spotifyEnabled,
      };

      console.log('Creating product with data:', data);
      await api.createProduct(data);
      router.push("/dashboard/products");
    } catch (error) {
      console.error("Error creating product:", error);
      alert("Error al crear el producto. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Producto</h1>
          <p className="text-gray-600 mt-2">Agrega un nuevo producto a tu catálogo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Discogs Search */}
            {vendorId && (
              <DiscogsSearch 
                vendorId={vendorId} 
                onSelectRelease={handleDiscogsSelect}
                existingImages={productImages}
              />
            )}

            {/* Image Gallery */}
            {vendorId && (
              <ImageGallery
                images={productImages}
                onChange={setProductImages}
                onUploadLocal={handleUploadLocalImages}
                vendorId={vendorId}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Información General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Título *</Label>
                  <Input 
                    id="title" 
                    name="title" 
                    required 
                    placeholder="Ej: Dark Side of the Moon - Pink Floyd"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="shortDescription">Descripción Corta</Label>
                  <Textarea
                    id="shortDescription"
                    name="shortDescription"
                    rows={2}
                    placeholder="Descripción breve para listados y previsualizaciones..."
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Descripción breve (se mostrará en listados)</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="description">Descripción *</Label>
                    <div className="flex items-center gap-2">
                      {/* Debug indicator */}
                      {process.env.NODE_ENV === 'development' && (
                        <span className="text-xs text-gray-500">
                          Gemini: {geminiEnabled ? '✅' : '❌'}
                        </span>
                      )}
                      {geminiEnabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={generatingDescription || !formData.artist || !formData.album}
                          onClick={async () => {
                            if (!vendorId) return;
                            setGeneratingDescription(true);
                            try {
                              console.log('Generating description with data:', {
                                artist: formData.artist,
                                album: formData.album,
                              });
                              
                              const result = await api.generateDescriptionWithGemini(vendorId, {
                                artist: formData.artist,
                                album: formData.album,
                                title: formData.title,
                                year: formData.year,
                                genre: formData.genre,
                                label: formData.label,
                                format: formData.format,
                              });
                              
                              console.log('Gemini API result:', result);
                              console.log('Description received:', result.description);
                              
                              if (result.description) {
                                setFormData({ ...formData, description: result.description, descriptionGeneratedByAI: true });
                                console.log('Description updated in form');
                              } else {
                                console.error('No description in result');
                                alert('No se pudo generar la descripción');
                              }
                            } catch (error: any) {
                              console.error('Error generating description:', error);
                              alert(error.message || 'Error al generar descripción');
                            } finally {
                              setGeneratingDescription(false);
                            }
                          }}
                        >
                          {generatingDescription ? '⏳ Generando...' : '✨ Generar con IA'}
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-500 italic">
                          IA no habilitada
                        </span>
                      )}
                    </div>
                  </div>
                  <Textarea
                    id="description"
                    name="description"
                    required
                    rows={4}
                    placeholder="Describe el producto, condición, características especiales..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                  {geminiEnabled && (
                    <p className="text-xs text-green-600 mt-1">
                      ✨ IA habilitada - Ingresa artista y álbum para generar descripción automáticamente
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Información Musical</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="artist">Artista</Label>
                    <Input 
                      id="artist" 
                      name="artist" 
                      placeholder="Ej: Pink Floyd"
                      value={formData.artist}
                      onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="album">Álbum</Label>
                    <Input 
                      id="album" 
                      name="album" 
                      placeholder="Ej: Dark Side of the Moon"
                      value={formData.album}
                      onChange={(e) => setFormData({ ...formData, album: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="label">Sello</Label>
                    <Input 
                      id="label" 
                      name="label" 
                      placeholder="Ej: Harvest Records"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Año</Label>
                    <Input 
                      id="year" 
                      name="year" 
                      type="number" 
                      placeholder="Ej: 1973"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="genre">Género</Label>
                  <Input 
                    id="genre" 
                    name="genre" 
                    placeholder="Ej: Progressive Rock"
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="format">Formato</Label>
                  <Input 
                    id="format" 
                    name="format" 
                    placeholder="Ej: LP 12', 33 RPM, 180g"
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalles Adicionales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tracklist">Canciones</Label>
                  <Textarea
                    id="tracklist"
                    name="tracklist"
                    rows={6}
                    placeholder="Listado de canciones (una por línea)&#10;Ej:&#10;1. Speak to Me&#10;2. Breathe&#10;3. On the Run&#10;4. Time"
                    value={formData.tracklist}
                    onChange={(e) => setFormData({ ...formData, tracklist: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Ingresa el listado de canciones, una por línea</p>
                </div>

                <div>
                  <Label htmlFor="technicalSpecs">Especificaciones Técnicas</Label>
                  <Textarea
                    id="technicalSpecs"
                    name="technicalSpecs"
                    rows={8}
                    placeholder="Describe las especificaciones técnicas del producto...&#10;&#10;Ej:&#10;- Peso del vinilo: 180g&#10;- Velocidad: 33 1/3 RPM&#10;- Número de discos: 1&#10;- Material: Vinilo virgen&#10;- Incluye: Encarte con letras"
                    value={formData.technicalSpecs}
                    onChange={(e) => setFormData({ ...formData, technicalSpecs: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Incluye detalles técnicos, materiales, contenido incluido, etc.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Sección: Precio y Stock */}
            <Card>
              <CardHeader>
                <CardTitle>Precio y Stock</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="price">Precio Regular (CLP) *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    required
                    min="0"
                    step="1"
                    placeholder="35990"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>

                {/* Switch para activar precio oferta */}
                <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <Switch
                    id="isOnSale"
                    checked={formData.isOnSale}
                    onCheckedChange={(checked) => setFormData({ ...formData, isOnSale: checked })}
                  />
                  <Label htmlFor="isOnSale" className="cursor-pointer font-medium">
                    Producto en Oferta
                  </Label>
                </div>

                {/* Precio oferta (solo visible si isOnSale es true) */}
                {formData.isOnSale && (
                  <div>
                    <Label htmlFor="salePrice">Precio Oferta (CLP) *</Label>
                    <Input
                      id="salePrice"
                      name="salePrice"
                      type="number"
                      required={formData.isOnSale}
                      min="0"
                      step="1"
                      placeholder="29990"
                      value={formData.salePrice}
                      onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Precio rebajado para clientes</p>
                  </div>
                )}

                {/* Precio mayorista (solo visible si el vendor tiene activado wholesale) */}
                {isWholesaleEnabled && (
                  <div>
                    <Label htmlFor="wholesalePrice">Precio Mayorista (CLP)</Label>
                    <Input
                      id="wholesalePrice"
                      name="wholesalePrice"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="25990"
                      value={formData.wholesalePrice}
                      onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Precio especial para clientes mayoristas</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="stock">Stock *</Label>
                  <Input
                    id="stock"
                    name="stock"
                    type="number"
                    required
                    min="0"
                    placeholder="10"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sección: General */}
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="sku">SKU / Número de Catálogo</Label>
                  <Input 
                    id="sku" 
                    name="sku" 
                    placeholder="Ej: VIN-001, ABC-12345"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Se auto-completa al importar desde Discogs
                  </p>
                </div>

                <div>
                  <Label htmlFor="condition">Condición *</Label>
                  <Select 
                    name="condition" 
                    required
                    value={formData.condition}
                    onValueChange={(value) => setFormData({ ...formData, condition: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar condición" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nuevo</SelectItem>
                      <SelectItem value="used">Usado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Escala Goldmine - Solo visible si es Usado */}
                {formData.condition === "used" && (
                  <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🎵</span>
                      <h3 className="font-medium text-amber-900">Escala Goldmine</h3>
                    </div>
                    
                    <div>
                      <Label htmlFor="mediaGrade">Calificación del Disco/Media</Label>
                      <Select 
                        name="mediaGrade"
                        value={formData.mediaGrade}
                        onValueChange={(value) => setFormData({ ...formData, mediaGrade: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar calificación" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">M (Mint) - Perfecto</SelectItem>
                          <SelectItem value="NM">NM (Near Mint) - Casi perfecto</SelectItem>
                          <SelectItem value="VG+">VG+ (Very Good Plus) - Muy bueno</SelectItem>
                          <SelectItem value="VG">VG (Very Good) - Bueno</SelectItem>
                          <SelectItem value="G+">G+ (Good Plus) - Regular+</SelectItem>
                          <SelectItem value="G">G (Good) - Regular</SelectItem>
                          <SelectItem value="P">P (Poor) - Pobre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="sleeveGrade">Calificación de la Carátula</Label>
                      <Select 
                        name="sleeveGrade"
                        value={formData.sleeveGrade}
                        onValueChange={(value) => setFormData({ ...formData, sleeveGrade: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar calificación" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">M (Mint) - Perfecto</SelectItem>
                          <SelectItem value="NM">NM (Near Mint) - Casi perfecto</SelectItem>
                          <SelectItem value="VG+">VG+ (Very Good Plus) - Muy bueno</SelectItem>
                          <SelectItem value="VG">VG (Very Good) - Bueno</SelectItem>
                          <SelectItem value="G+">G+ (Good Plus) - Regular+</SelectItem>
                          <SelectItem value="G">G (Good) - Regular</SelectItem>
                          <SelectItem value="P">P (Poor) - Pobre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <p className="text-xs text-amber-700">
                      💡 La Escala Goldmine es el estándar de la industria para calificar discos usados
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sección: Categorías */}
            <Card>
              <CardHeader>
                <CardTitle>Categorías</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categories.length > 0 ? (
                  categories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`category-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories([...selectedCategories, category.id]);
                          } else {
                            setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <Label 
                        htmlFor={`category-${category.id}`}
                        className="text-sm font-normal cursor-pointer flex items-center"
                      >
                        {category.icon && (
                          <span className="mr-2">
                            {category.icon.startsWith('/icons/') ? '📀' : category.icon}
                          </span>
                        )}
                        {category.name}
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No hay categorías disponibles</p>
                )}
              </CardContent>
            </Card>

            {/* Sección: Spotify */}
            <Card>
              <CardHeader>
                <CardTitle>Integración Spotify</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="spotifyAlbumId">Spotify Album ID (Opcional)</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="spotifyAlbumId" 
                      name="spotifyAlbumId" 
                      placeholder="Se detectará automáticamente"
                      value={formData.spotifyAlbumId}
                      onChange={(e) => setFormData({ ...formData, spotifyAlbumId: e.target.value })}
                      className="flex-1"
                      readOnly
                    />
                    {!formData.spotifyAlbumId ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!formData.artist || !formData.album || !vendorId}
                        onClick={async () => {
                          try {
                            const query = `${formData.artist} ${formData.album}`;
                            const data = await api.searchSpotify(vendorId, query);
                            if (data.albums && data.albums.length > 0) {
                              // Auto-seleccionar el primer resultado
                              setFormData({ ...formData, spotifyAlbumId: data.albums[0].id });
                            } else {
                              alert("No se encontraron resultados en Spotify");
                            }
                          } catch (error: any) {
                            alert(error.message || "Error al buscar en Spotify");
                          }
                        }}
                      >
                        Buscar en Spotify
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="default"
                        onClick={() => {
                          const modal = document.getElementById('spotify-preview-modal');
                          if (modal) modal.classList.remove('hidden');
                        }}
                      >
                        🎵 Vista Previa
                      </Button>
                    )}
                  </div>
                  {!vendorId ? (
                    <p className="text-xs text-red-500 mt-1">
                      ⏳ Cargando información del vendedor...
                    </p>
                  ) : (!formData.artist || !formData.album) ? (
                    <p className="text-xs text-yellow-600 mt-1">
                      ⚠️ Ingresa el artista y álbum arriba para buscar en Spotify
                    </p>
                  ) : formData.spotifyAlbumId ? (
                    <p className="text-xs text-green-600 mt-1">
                      ✅ Álbum detectado automáticamente (ID: {formData.spotifyAlbumId.slice(0, 10)}...)
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      Busca automáticamente el álbum en Spotify usando artista y título
                    </p>
                  )}
                </div>

                {/* Switch para habilitar/deshabilitar reproductor de Spotify */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex-1">
                    <Label htmlFor="spotifyEnabled" className="text-base font-medium cursor-pointer">
                      Mostrar Reproductor de Spotify
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      Activa para mostrar el reproductor en la página del producto
                    </p>
                  </div>
                  <Switch
                    id="spotifyEnabled"
                    checked={formData.spotifyEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, spotifyEnabled: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creando..." : "Crear Producto"}
              </Button>
              <Link href="/dashboard/products">
                <Button type="button" variant="outline" className="w-full">
                  Cancelar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </form>

      {/* Modal para activar categorías */}
      <Dialog open={showCategoryModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Activar Categorías
            </DialogTitle>
            <DialogDescription className="space-y-2 text-base">
              <p>
                No tienes categorías activas. Para agregar productos, necesitas seleccionar las categorías 
                relacionadas con los productos que vas a vender.
              </p>
              <p className="font-medium text-foreground">
                Selecciona las categorías que correspondan a tu catálogo:
              </p>
              <p className="text-sm italic">
                Puedes modificar esta selección más adelante desde la configuración de tu portal.
              </p>
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[400px] overflow-y-auto space-y-2 py-4">
            {allMarketplaceCategories.map((category) => (
              <div key={category.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  id={`activate-${category.id}`}
                  checked={categoriesToActivate.includes(category.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCategoriesToActivate([...categoriesToActivate, category.id]);
                    } else {
                      setCategoriesToActivate(categoriesToActivate.filter(id => id !== category.id));
                    }
                  }}
                  className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <Label 
                  htmlFor={`activate-${category.id}`}
                  className="text-base font-normal cursor-pointer flex items-center flex-1"
                >
                  {category.icon && (
                    <span className="mr-2 text-xl">
                      {category.icon.startsWith('/icons/') || 
                       category.icon.startsWith('icons/') || 
                       category.icon.startsWith('http') || 
                       category.icon.includes('digitaloceanspaces.com') ? (
                        <img 
                          src={getImageUrl(category.icon)} 
                          alt={category.name} 
                          className="w-8 h-8 object-contain" 
                        />
                      ) : (
                        category.icon
                      )}
                    </span>
                  )}
                  <div>
                    <div className="font-medium">{category.name}</div>
                    {category.description && (
                      <div className="text-sm text-gray-500">{category.description}</div>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleActivateCategories}
              disabled={activatingCategories || categoriesToActivate.length === 0}
              className="w-full"
            >
              {activatingCategories ? "Activando..." : `Activar ${categoriesToActivate.length > 0 ? `(${categoriesToActivate.length})` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spotify Preview Modal */}
      <SpotifyPreviewModal 
        vendorId={vendorId}
        artist={formData.artist}
        album={formData.album}
        selectedAlbumId={formData.spotifyAlbumId}
        onSelect={(albumId) => {
          setFormData({ ...formData, spotifyAlbumId: albumId });
        }}
      />
    </div>
  );
}

// Spotify Preview Modal Component
function SpotifyPreviewModal({ 
  vendorId, 
  artist, 
  album, 
  selectedAlbumId,
  onSelect 
}: { 
  vendorId: string; 
  artist: string; 
  album: string; 
  selectedAlbumId: string;
  onSelect: (albumId: string) => void;
}) {
  const [showAllResults, setShowAllResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [error, setError] = useState("");

  const searchSpotify = async () => {
    if (!vendorId || !artist || !album) return;

    setSearching(true);
    setError("");
    setResults([]);

    try {
      const query = `${artist} ${album}`;
      const data = await api.searchSpotify(vendorId, query);
      setResults(data.albums || []);
      
      // Buscar el álbum seleccionado en los resultados
      if (data.albums && data.albums.length > 0) {
        const foundAlbum = data.albums.find((a: any) => a.id === selectedAlbumId);
        setSelectedAlbum(foundAlbum || data.albums[0]);
      }
    } catch (err: any) {
      console.error("Spotify search error:", err);
      setError(err.message || "Error al buscar en Spotify");
    } finally {
      setSearching(false);
    }
  };

  // Buscar cuando cambia el selectedAlbumId
  useEffect(() => {
    if (selectedAlbumId && vendorId && artist && album) {
      // Buscar los resultados para encontrar el álbum seleccionado
      searchSpotify();
    }
  }, [selectedAlbumId]);

  // Observer para cuando se abre el modal
  useEffect(() => {
    const modal = document.getElementById('spotify-preview-modal');
    if (modal) {
      const observer = new MutationObserver(() => {
        if (!modal.classList.contains('hidden') && results.length === 0 && selectedAlbumId) {
          searchSpotify();
        }
      });
      observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
    }
  }, []);

  const closeModal = () => {
    const modal = document.getElementById('spotify-preview-modal');
    if (modal) {
      modal.classList.add('hidden');
      setShowAllResults(false);
    }
  };

  return (
    <div
      id="spotify-preview-modal"
      className="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeModal();
        }
      }}
    >
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {!showAllResults ? (
          // Vista Previa del álbum seleccionado
          <>
            <h3 className="text-xl font-bold mb-4">Vista Previa - Spotify</h3>
            
            {searching && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
                {error}
              </div>
            )}

            {selectedAlbum && (
              <div className="space-y-4">
                <div className="flex gap-6">
                  {selectedAlbum.image && (
                    <img 
                      src={selectedAlbum.image} 
                      alt={selectedAlbum.name} 
                      className="w-32 h-32 rounded-lg shadow-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="text-2xl font-bold mb-2">{selectedAlbum.name}</h4>
                    <p className="text-lg text-gray-700">{selectedAlbum.artist}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedAlbum.releaseDate} • {selectedAlbum.totalTracks} canciones
                    </p>
                  </div>
                </div>

                {/* Reproductor de Spotify */}
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Reproductor:</p>
                  <iframe
                    src={`https://open.spotify.com/embed/album/${selectedAlbumId}?utm_source=generator&theme=0`}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="rounded-lg"
                  ></iframe>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    onClick={closeModal}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    ✓ Confirmar Este Álbum
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAllResults(true)}
                    className="flex-1"
                  >
                    Ver Más Opciones
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          // Lista completa de resultados
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Todas las Opciones</h3>
              <Button variant="ghost" onClick={() => setShowAllResults(false)}>
                ← Volver a Vista Previa
              </Button>
            </div>
            
            <p className="text-gray-600 mb-4">Buscando: {artist} - {album}</p>

            {results.length > 0 && (
              <div className="space-y-3">
                {results.map((albumOption: any) => (
                  <div
                    key={albumOption.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition ${
                      albumOption.id === selectedAlbumId ? 'border-purple-500 bg-purple-50' : ''
                    }`}
                    onClick={() => {
                      onSelect(albumOption.id);
                      setSelectedAlbum(albumOption);
                      setShowAllResults(false);
                    }}
                  >
                    {albumOption.image && (
                      <img src={albumOption.image} alt={albumOption.name} className="w-16 h-16 rounded" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold">{albumOption.name}</h4>
                      <p className="text-sm text-gray-600">{albumOption.artist}</p>
                      <p className="text-xs text-gray-500">
                        {albumOption.releaseDate} • {albumOption.totalTracks} canciones
                      </p>
                    </div>
                    {albumOption.id === selectedAlbumId && (
                      <div className="text-purple-600 font-semibold">✓ Seleccionado</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={closeModal}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
