"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [vendorId, setVendorId] = useState<string>("");
  const [spotifySearchOpen, setSpotifySearchOpen] = useState(false);
  const [spotifyResults, setSpotifyResults] = useState<any[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    condition: "",
    artist: "",
    album: "",
    label: "",
    year: "",
    genre: "",
    format: "",
    tracklist: "",
    technicalSpecs: "",
    price: "",
    salePrice: "",
    isOnSale: false,
    wholesalePrice: "",
    stock: "",
    sku: "",
    spotifyAlbumId: "",
    spotifyEnabled: true,
  });

  useEffect(() => {
    loadVendorAndProduct();
  }, [id]);

  const loadVendorAndProduct = async () => {
    try {
      // Cargar perfil del vendor
      const vendorResponse = await api.getMyVendor();
      if (vendorResponse.hasVendor && vendorResponse.id) {
        setVendorId(vendorResponse.id);
        // Cargar categorías activas del vendor
        try {
          const vendorCats = await api.getVendorCategories(vendorResponse.id);
          setCategories(vendorCats.filter((c: any) => c.isActive));
        } catch (err) {
          console.error('Error loading vendor categories:', err);
        }
      }

      // Cargar producto
      const product = await api.getProduct(id);
      
      // Llenar el formulario con los datos del producto
      setFormData({
        title: product.title || "",
        description: product.description || "",
        condition: product.condition || "",
        artist: product.artist || "",
        album: product.album || "",
        label: product.label || "",
        year: product.year?.toString() || "",
        genre: product.genre || "",
        format: product.format || "",
        tracklist: product.tracklist || "",
        technicalSpecs: product.technicalSpecs || "",
        price: product.price?.toString() || "",
        salePrice: product.salePrice?.toString() || "",
        isOnSale: product.isOnSale || false,
        wholesalePrice: product.wholesalePrice?.toString() || "",
        stock: product.stock?.toString() || "",
        sku: product.sku || "",
        spotifyAlbumId: product.spotifyAlbumId || "",
        spotifyEnabled: product.spotifyEnabled !== undefined ? product.spotifyEnabled : true,
      });
      // Preseleccionar categorías del producto (compatibilidad con categoryIds o relaciones)
      const existingCategoryIds = product.categoryIds ?? (product.categories ? product.categories.map((c: any) => c.id) : []);
      setSelectedCategories(existingCategoryIds || []);
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Error al cargar el producto");
    } finally {
      setLoadingProduct(false);
    }
  };

  const searchSpotify = async () => {
    if (!formData.artist || !formData.album) {
      alert("Necesitas ingresar el artista y álbum primero");
      return;
    }

    setSpotifyLoading(true);
    try {
      const query = `${formData.artist} ${formData.album}`;
      const response = await api.searchSpotify(vendorId, query);
      setSpotifyResults(response.albums || []);
      setSpotifySearchOpen(true);
    } catch (error: any) {
      console.error("Error searching Spotify:", error);
      alert(error.message || "Error al buscar en Spotify");
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.price || !formData.stock) {
      alert("Por favor completa los campos requeridos");
      return;
    }

    setLoading(true);
    try {
      const productData = {
        ...formData,
        categoryIds: selectedCategories,
        price: Math.round(parseFloat(formData.price)),
        salePrice: formData.salePrice ? Math.round(parseFloat(formData.salePrice)) : undefined,
        wholesalePrice: formData.wholesalePrice ? Math.round(parseFloat(formData.wholesalePrice)) : undefined,
        stock: parseInt(formData.stock),
        year: formData.year ? parseInt(formData.year) : undefined,
        spotifyEnabled: formData.spotifyEnabled,
      };

      await api.updateProduct(id, productData);
      alert("Producto actualizado exitosamente");
      router.push("/dashboard/products");
    } catch (error: any) {
      console.error("Error updating product:", error);
      alert(error.message || "Error al actualizar producto");
    } finally {
      setLoading(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">Cargando producto...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Editar Producto</h1>
          <p className="text-gray-600 mt-2">Actualiza la información del producto</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Básica */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Pink Floyd - The Wall"
                required
              />
            </div>

            <div>
              <Label htmlFor="artist">Artista</Label>
              <Input
                id="artist"
                value={formData.artist}
                onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                placeholder="Ej: Pink Floyd"
              />
            </div>

            <div>
              <Label htmlFor="album">Álbum</Label>
              <Input
                id="album"
                value={formData.album}
                onChange={(e) => setFormData({ ...formData, album: e.target.value })}
                placeholder="Ej: The Wall"
              />
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción detallada del producto"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="condition">Condición</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value) => setFormData({ ...formData, condition: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar condición" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nuevo</SelectItem>
                    <SelectItem value="like_new">Como Nuevo</SelectItem>
                    <SelectItem value="very_good">Muy Bueno</SelectItem>
                    <SelectItem value="good">Bueno</SelectItem>
                    <SelectItem value="acceptable">Aceptable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="year">Año</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="Ej: 1979"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="label">Sello Discográfico</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Ej: Columbia"
                />
              </div>

              <div>
                <Label htmlFor="genre">Género</Label>
                <Input
                  id="genre"
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  placeholder="Ej: Rock, Jazz, Pop"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="format">Formato</Label>
              <Input
                id="format"
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                placeholder="Ej: Vinyl, CD, Cassette"
              />
            </div>

            {/* Sección: Categorías (usar categorías activas del vendor) */}
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
          </CardContent>
        </Card>

        {/* Integración Spotify */}
        <Card>
          <CardHeader>
            <CardTitle>Integración Spotify</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="spotifyAlbumId">Spotify Album ID</Label>
              <div className="flex gap-2">
                <Input
                  id="spotifyAlbumId"
                  value={formData.spotifyAlbumId}
                  onChange={(e) => setFormData({ ...formData, spotifyAlbumId: e.target.value })}
                  placeholder="ID del álbum en Spotify"
                  readOnly={spotifySearchOpen}
                />
                <Button
                  type="button"
                  onClick={searchSpotify}
                  disabled={!formData.artist || !formData.album || spotifyLoading}
                >
                  <SearchIcon className="h-4 w-4 mr-2" />
                  {spotifyLoading ? "Buscando..." : "Buscar en Spotify"}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Ingresa el artista y álbum arriba, luego haz clic en "Buscar en Spotify"
              </p>
            </div>

            {/* Modal de resultados Spotify */}
            {spotifySearchOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                  <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white">
                    <h3 className="text-lg font-semibold">Resultados de Spotify</h3>
                    <Button
                      variant="ghost"
                      onClick={() => setSpotifySearchOpen(false)}
                    >
                      Cerrar
                    </Button>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {spotifyResults.length === 0 ? (
                      <p className="text-gray-500 col-span-2 text-center py-8">
                        No se encontraron resultados
                      </p>
                    ) : (
                      spotifyResults.map((album) => (
                        <div
                          key={album.id}
                          className="border rounded-lg p-4 hover:border-purple-500 cursor-pointer transition"
                          onClick={() => {
                            setFormData({ ...formData, spotifyAlbumId: album.id });
                            setSpotifySearchOpen(false);
                          }}
                        >
                          <div className="flex gap-4">
                            {album.image && (
                              <img
                                src={album.image}
                                alt={album.name}
                                className="w-24 h-24 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <h4 className="font-semibold">{album.name}</h4>
                              <p className="text-sm text-gray-600">{album.artist}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {album.releaseDate} • {album.totalTracks} tracks
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Switch para habilitar/deshabilitar reproductor de Spotify */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border mt-4">
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

        {/* Detalles Adicionales */}
        <Card>
          <CardHeader>
            <CardTitle>Detalles Adicionales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tracklist">Listado de Temas</Label>
              <Textarea
                id="tracklist"
                value={formData.tracklist}
                onChange={(e) => setFormData({ ...formData, tracklist: e.target.value })}
                placeholder="Lista de canciones (una por línea)"
                rows={6}
              />
            </div>

            <div>
              <Label htmlFor="technicalSpecs">Especificaciones Técnicas</Label>
              <Textarea
                id="technicalSpecs"
                value={formData.technicalSpecs}
                onChange={(e) => setFormData({ ...formData, technicalSpecs: e.target.value })}
                placeholder="Detalles técnicos del producto"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Precios e Inventario */}
        <Card>
          <CardHeader>
            <CardTitle>Precios e Inventario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Precio Regular *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="stock">Stock *</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isOnSale"
                checked={formData.isOnSale}
                onCheckedChange={(checked) => setFormData({ ...formData, isOnSale: checked })}
              />
              <Label htmlFor="isOnSale">Producto en oferta</Label>
            </div>

            {formData.isOnSale && (
              <div>
                <Label htmlFor="salePrice">Precio de Oferta</Label>
                <Input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  value={formData.salePrice}
                  onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            )}

            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Código único del producto"
              />
            </div>
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar Cambios"}
          </Button>
          <Link href="/dashboard/products">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
