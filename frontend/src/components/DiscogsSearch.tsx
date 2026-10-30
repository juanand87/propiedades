"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, Star } from "lucide-react";
import { api } from "@/lib/api";

interface DiscogsResult {
  id: number;
  title: string;
  year?: string;
  format?: string[];
  label?: string[];
  country?: string;
  genre?: string[];
  thumb?: string;
  cover_image?: string;
  catno?: string;
}

export interface ProductImage {
  url: string;
  isPrimary: boolean;
  order: number;
  meta?: any;
}

interface DiscogsSearchProps {
  vendorId: string;
  onSelectRelease?: (release: any) => void;
  existingImages?: ProductImage[]; // Imágenes ya seleccionadas previamente
}

export default function DiscogsSearch({ vendorId, onSelectRelease, existingImages = [] }: DiscogsSearchProps) {
  const [searchParams, setSearchParams] = useState({
    format: "all",
    artist: "",
    album: "",
    label: "",
    catno: "",
    barcode: "",
  });
  const [loading, setLoading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false); // Cargando imágenes
  const [allResults, setAllResults] = useState<DiscogsResult[]>([]); // Todos los resultados
  const [filteredResults, setFilteredResults] = useState<DiscogsResult[]>([]); // Resultados filtrados
  const [showModal, setShowModal] = useState(false);
  const [currentView, setCurrentView] = useState<"results" | "images">("results"); // Vista activa
  const [selectedRelease, setSelectedRelease] = useState<any>(null); // Release con detalles completos
  const [selectedImages, setSelectedImages] = useState<string[]>([]); // Imágenes seleccionadas
  const [primaryImage, setPrimaryImage] = useState<string | null>(null); // Imagen principal
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const [selectedSubFormat, setSelectedSubFormat] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [availableFormats, setAvailableFormats] = useState<Map<string, Set<string>>>(new Map());
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar que al menos un campo tenga valor
    const hasSearchTerm = Object.values(searchParams).some(value => value.trim() !== "");
    if (!hasSearchTerm) {
      alert("Por favor ingresa al menos un término de búsqueda");
      return;
    }

    setLoading(true);
    try {
      // Filtrar el formato si es "all"
      const searchData = {
        ...searchParams,
        format: searchParams.format === "all" ? undefined : searchParams.format,
        per_page: 100,
      };
      
      const data = await api.searchDiscogs(vendorId, searchData);
      const results = data.results || [];
      
      // Eliminar duplicados basados en ID
      const uniqueResultsMap = new Map<number, DiscogsResult>();
      results.forEach((item: DiscogsResult) => {
        uniqueResultsMap.set(item.id, item);
      });
      const uniqueResults = Array.from(uniqueResultsMap.values());
      
      console.log('Total resultados:', results.length, 'Únicos:', uniqueResults.length);
      console.log('Ejemplo de formato:', uniqueResults[0]?.format);
      
      // Extraer formatos y subformatos únicos
      const formatsMap = new Map<string, Set<string>>();
      uniqueResults.forEach((result) => {
        if (result.format && Array.isArray(result.format)) {
          // result.format es un array como: ["Vinyl", "LP", "Album"] o ["CD", "Album"]
          // El primer elemento es el formato principal
          const mainFormat = result.format[0];
          if (mainFormat) {
            if (!formatsMap.has(mainFormat)) {
              formatsMap.set(mainFormat, new Set());
            }
            // Los elementos restantes son subformatos
            result.format.slice(1).forEach((subFormat: string) => {
              formatsMap.get(mainFormat)?.add(subFormat);
            });
          }
        }
      });
      
      console.log('Formatos encontrados:', Array.from(formatsMap.keys()));
      
      // Extraer años únicos y ordenarlos
      const yearsSet = new Set<string>();
      uniqueResults.forEach((result) => {
        if (result.year) {
          yearsSet.add(result.year);
        }
      });
      const years = Array.from(yearsSet).sort((a, b) => b.localeCompare(a)); // Ordenar descendente
      
      // Extraer países únicos
      const countriesSet = new Set<string>();
      uniqueResults.forEach((result) => {
        if (result.country) countriesSet.add(result.country);
      });
      const countries = Array.from(countriesSet).sort();
      
      console.log('Años encontrados:', years);
      
      setAllResults(uniqueResults);
      setAvailableFormats(formatsMap);
      setAvailableCountries(countries);
      setAvailableYears(years);
      
      // Mantener el formato seleccionado en la búsqueda principal si existe en los resultados
      const searchFormatInResults = searchParams.format !== "all" && formatsMap.has(searchParams.format);
      const initialFormat = searchFormatInResults ? searchParams.format : "all";
      setSelectedFormat(initialFormat);
      setSelectedSubFormat("all");
      setSelectedCountry("all");
      setSelectedYear("all");
      
      // Aplicar filtro inicial si hay un formato seleccionado
      if (initialFormat !== "all") {
        const filtered = uniqueResults.filter((result) => {
          return result.format && result.format.length > 0 && result.format[0] === initialFormat;
        });
        setFilteredResults(filtered);
      } else {
        setFilteredResults(uniqueResults);
      }
      
      // Resetear vista a resultados y limpiar release seleccionado
      setCurrentView("results");
      setSelectedRelease(null);
      setSelectedImages([]);
      
      setShowModal(true);
    } catch (error: any) {
      console.error("Error searching Discogs:", error);
      alert(error.message || "Error al buscar en Discogs. Verifica que hayas configurado tu API key.");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (format: string, subFormat: string, country: string, year: string) => {
    let filtered = allResults;
    
    // Filtrar por formato principal (primer elemento del array)
    if (format !== "all") {
      filtered = filtered.filter((result) => {
        return result.format && result.format.length > 0 && result.format[0] === format;
      });
    }
    
    // Filtrar por subformato (elementos después del primero)
    if (subFormat !== "all") {
      filtered = filtered.filter((result) => {
        return result.format && result.format.slice(1).includes(subFormat);
      });
    }
    
    // Filtrar por país
    if (country !== "all") {
      filtered = filtered.filter((result) => result.country === country);
    }
    
    // Filtrar por año
    if (year !== "all") {
      filtered = filtered.filter((result) => {
        return result.year === year;
      });
    }
    
    // Actualizar países disponibles basados en filtros actuales (sin el filtro de país)
    let resultsForCountries = allResults;
    if (format !== "all") {
      resultsForCountries = resultsForCountries.filter((result) => {
        return result.format && result.format.length > 0 && result.format[0] === format;
      });
    }
    if (subFormat !== "all") {
      resultsForCountries = resultsForCountries.filter((result) => {
        return result.format && result.format.slice(1).includes(subFormat);
      });
    }
    const countriesSet = new Set<string>();
    resultsForCountries.forEach((result) => {
      if (result.country) countriesSet.add(result.country);
    });
    setAvailableCountries(Array.from(countriesSet).sort());
    
    // Actualizar años disponibles basados en los resultados filtrados (sin el filtro de año)
    let resultsForYears = allResults;
    if (format !== "all") {
      resultsForYears = resultsForYears.filter((result) => {
        return result.format && result.format.length > 0 && result.format[0] === format;
      });
    }
    if (subFormat !== "all") {
      resultsForYears = resultsForYears.filter((result) => {
        return result.format && result.format.slice(1).includes(subFormat);
      });
    }
    if (country !== "all") {
      resultsForYears = resultsForYears.filter((result) => result.country === country);
    }
    
    const yearsSet = new Set<string>();
    resultsForYears.forEach((result) => {
      if (result.year) {
        yearsSet.add(result.year);
      }
    });
    const years = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    setAvailableYears(years);
    
    setFilteredResults(filtered);
  };

  const handleFormatChange = (format: string) => {
    setSelectedFormat(format);
    setSelectedSubFormat("all");
    setSelectedCountry("all");
    setSelectedYear("all");
    applyFilters(format, "all", "all", "all");
  };

  const handleSubFormatChange = (subFormat: string) => {
    setSelectedSubFormat(subFormat);
    setSelectedCountry("all");
    setSelectedYear("all");
    applyFilters(selectedFormat, subFormat, "all", "all");
  };

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setSelectedYear("all");
    applyFilters(selectedFormat, selectedSubFormat, country, "all");
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    applyFilters(selectedFormat, selectedSubFormat, selectedCountry, year);
  };

  const handleSelectRelease = async (result: DiscogsResult) => {
    setLoadingImages(true);
    try {
      console.log('🔍 Fetching release details for ID:', result.id);
      // Obtener detalles completos del release
      const releaseDetails = await api.getDiscogsRelease(vendorId, result.id.toString());
      console.log('✅ Release details received:', releaseDetails);
      
      if (!releaseDetails) {
        throw new Error('No se recibieron detalles del release');
      }

      setSelectedRelease(releaseDetails);
      
      // Cargar imágenes existentes si hay
      if (existingImages.length > 0) {
        const existingUrls = existingImages.map(img => img.url);
        setSelectedImages(existingUrls);
        
        const primaryImg = existingImages.find(img => img.isPrimary);
        if (primaryImg) {
          setPrimaryImage(primaryImg.url);
        }
      } else {
        setSelectedImages([]);
        setPrimaryImage(null);
      }
      
      // Precargar todas las imágenes
      if (releaseDetails.images && releaseDetails.images.length > 0) {
        const imagePromises = releaseDetails.images.map((image: any) => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = image.uri;
          });
        });
        
        // Esperar a que todas las imágenes se carguen
        await Promise.all(imagePromises);
      }
      
      // Cambiar a vista de imágenes después de que todo esté cargado
      setCurrentView("images");
    } catch (error: any) {
      console.error("Error getting release details:", error);
      const errorMsg = error?.message || error?.response?.data?.message || 'Error al obtener detalles del disco. Por favor intenta de nuevo.';
      alert(errorMsg);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleBackToResults = () => {
    setCurrentView("results");
    setSelectedRelease(null);
    setSelectedImages([]);
  };

  const handleImportRelease = () => {
    if (onSelectRelease && selectedRelease) {
      // Crear array de ProductImage con orden y primary
      const images: ProductImage[] = [];
      
      // Si hay imagen principal, va primera
      if (primaryImage) {
        images.push({
          url: primaryImage,
          isPrimary: true,
          order: 0
        });
      }
      
      // Agregar el resto de imágenes seleccionadas
      selectedImages.forEach((url, index) => {
        if (url !== primaryImage) {
          images.push({
            url,
            isPrimary: false,
            order: primaryImage ? index + 1 : index
          });
        }
      });
      
      const releaseWithImages = {
        ...selectedRelease,
        images: images,
      };
      onSelectRelease(releaseWithImages);
    }
    
    // Cerrar modal y resetear
    setShowModal(false);
    setCurrentView("results");
    setSelectedRelease(null);
    setSelectedImages([]);
    setPrimaryImage(null);
  };

  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev => {
      const isSelected = prev.includes(imageUrl);
      if (isSelected) {
        // Si deseleccionamos y era la principal, quitarla también
        if (primaryImage === imageUrl) {
          setPrimaryImage(null);
        }
        return prev.filter(url => url !== imageUrl);
      } else {
        // Si es la primera imagen seleccionada, hacerla principal automáticamente
        const newSelection = [...prev, imageUrl];
        if (newSelection.length === 1) {
          setPrimaryImage(imageUrl);
        }
        return newSelection;
      }
    });
  };

  const togglePrimaryImage = (imageUrl: string) => {
    // Solo puede ser principal si está seleccionada
    if (selectedImages.includes(imageUrl)) {
      setPrimaryImage(imageUrl);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar en Discogs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Primera fila: Formato, Artista, Álbum */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="format">Formato</Label>
                <Select value={searchParams.format} onValueChange={(value) => setSearchParams({ ...searchParams, format: value })}>
                  <SelectTrigger id="format">
                    <SelectValue placeholder="Todos los formatos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los formatos</SelectItem>
                    <SelectItem value="Vinyl">Vinilo</SelectItem>
                    <SelectItem value="CD">CD</SelectItem>
                    <SelectItem value="Cassette">Cassette</SelectItem>
                    <SelectItem value="VHS">VHS</SelectItem>
                    <SelectItem value="DVD">DVD</SelectItem>
                    <SelectItem value="Blu-ray">Blu-ray</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="artist">Artista</Label>
                <Input
                  id="artist"
                  value={searchParams.artist}
                  onChange={(e) => setSearchParams({ ...searchParams, artist: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                  placeholder="Ej: Pink Floyd"
                />
              </div>
              <div>
                <Label htmlFor="album">Álbum</Label>
                <Input
                  id="album"
                  value={searchParams.album}
                  onChange={(e) => setSearchParams({ ...searchParams, album: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                  placeholder="Ej: Dark Side of the Moon"
                />
              </div>
            </div>

            {/* Segunda fila: Sello, Número de Catálogo, Código de Barras */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="label">Sello</Label>
                <Input
                  id="label"
                  value={searchParams.label}
                  onChange={(e) => setSearchParams({ ...searchParams, label: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                  placeholder="Ej: EMI"
                />
              </div>
              <div>
                <Label htmlFor="catno">Número de Catálogo</Label>
                <Input
                  id="catno"
                  value={searchParams.catno}
                  onChange={(e) => setSearchParams({ ...searchParams, catno: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                  placeholder="Ej: SHVL 804"
                />
              </div>
              <div>
                <Label htmlFor="barcode">Código de Barras</Label>
                <Input
                  id="barcode"
                  value={searchParams.barcode}
                  onChange={(e) => setSearchParams({ ...searchParams, barcode: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                  placeholder="Ej: 5099902894027"
                />
              </div>
            </div>

            <Button type="button" onClick={handleSearch} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </>
              )}
            </Button>

            <p className="text-xs text-gray-500">
              Combina los campos para afinar tu búsqueda. Por ejemplo: Artista + Álbum, o Artista + Número de Catálogo.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={(open) => {
        setShowModal(open);
        if (!open) {
          // Resetear al cerrar el modal
          setCurrentView("results");
          setSelectedRelease(null);
          setSelectedImages([]);
        }
      }}>
        <DialogContent className="sm:max-w-[75vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {currentView === "results" 
                ? `Resultados de Discogs (${allResults.length} encontrados, ${filteredResults.length} mostrados)`
                : "Seleccionar Imágenes"
              }
            </DialogTitle>
          </DialogHeader>
          
          {/* Preloader de imágenes */}
          {loadingImages && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
              <p className="text-lg font-medium">Cargando imágenes...</p>
              <p className="text-sm text-gray-500">Espera mientras se cargan todas las imágenes del disco</p>
            </div>
          )}
          
          {/* Vistas con animación slide */}
          {!loadingImages && currentView === "results" && (
            <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
              {/* Vista de Resultados */}
              {/* Filtros */}
              <div className="grid grid-cols-4 gap-4 pb-4 border-b flex-shrink-0">
                <div>
                  <Label htmlFor="filter-format">Formato</Label>
                  <Select value={selectedFormat} onValueChange={handleFormatChange}>
                    <SelectTrigger id="filter-format">
                      <SelectValue placeholder="Todos los formatos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los formatos ({allResults.length})</SelectItem>
                      {Array.from(availableFormats.keys()).map((format) => (
                        <SelectItem key={format} value={format}>
                          {format}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="filter-subformat">Sub-formato</Label>
                  <Select 
                    value={selectedSubFormat} 
                    onValueChange={handleSubFormatChange}
                    disabled={selectedFormat === "all"}
                  >
                    <SelectTrigger id="filter-subformat">
                      <SelectValue placeholder="Todos los sub-formatos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los sub-formatos</SelectItem>
                      {Array.from(availableFormats.get(selectedFormat) || []).map((subFormat) => (
                        <SelectItem key={subFormat} value={subFormat}>
                          {subFormat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* País */}
                <div>
                  <Label htmlFor="filter-country">País</Label>
                  <Select value={selectedCountry} onValueChange={handleCountryChange}>
                    <SelectTrigger id="filter-country">
                      <SelectValue placeholder="Todos los países" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="all">Todos los países</SelectItem>
                      {availableCountries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="filter-year">Año</Label>
                  <Select value={selectedYear} onValueChange={handleYearChange}>
                    <SelectTrigger id="filter-year">
                      <SelectValue placeholder="Todos los años" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="all">Todos los años</SelectItem>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Resultados */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 pt-4">
                {filteredResults.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No se encontraron resultados con estos filtros</p>
                ) : (
                  filteredResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:border-blue-300 transition-colors"
                    >
                      {result.thumb && (
                        <img
                          src={result.thumb}
                          alt={result.title}
                          className="w-20 h-20 object-cover rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-2">{result.title}</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                          {result.year && <p><span className="font-medium">Año:</span> {result.year}</p>}
                          {result.format && result.format.length > 0 && (
                            <p><span className="font-medium">Formato:</span> {result.format.join(", ")}</p>
                          )}
                          {result.label && result.label.length > 0 && (
                            <p className="truncate"><span className="font-medium">Sello:</span> {result.label.join(", ")}</p>
                          )}
                          {result.catno && <p><span className="font-medium">Cat#:</span> {result.catno}</p>}
                          {result.country && <p><span className="font-medium">País:</span> {result.country}</p>}
                          {result.genre && result.genre.length > 0 && (
                            <p className="col-span-2"><span className="font-medium">Género:</span> {result.genre.join(", ")}</p>
                          )}
                        </div>
                      </div>
                      <Button 
                        onClick={() => handleSelectRelease(result)}
                        className="flex-shrink-0"
                      >
                        Seleccionar
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {!loadingImages && currentView === "images" && selectedRelease && (
            <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
              {/* Vista de Imágenes */}
              <>
                  {/* Información del disco */}
                  <div className="pb-4 border-b flex-shrink-0">
                    <h3 className="font-semibold text-lg mb-2">{selectedRelease.title}</h3>
                    <div className="grid grid-cols-2 gap-x-4 text-sm text-gray-600">
                      {selectedRelease.year && <p><span className="font-medium">Año:</span> {selectedRelease.year}</p>}
                      {selectedRelease.artists && selectedRelease.artists.length > 0 && (
                        <p><span className="font-medium">Artista:</span> {selectedRelease.artists[0].name}</p>
                      )}
                    </div>
                  </div>

                  {/* Instrucciones */}
                  <div className="pb-3 text-sm text-gray-600">
                    <p>Haz clic en las imágenes para seleccionarlas. Usa la <Star className="inline h-4 w-4 fill-yellow-400 text-yellow-400" /> para marcar la imagen principal.</p>
                  </div>

                  {/* Galería de imágenes */}
                  <div className="flex-1 overflow-y-auto py-4">
                    {selectedRelease.images && selectedRelease.images.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {selectedRelease.images.map((image: any, index: number) => {
                          const isSelected = selectedImages.includes(image.uri);
                          const isPrimary = primaryImage === image.uri;
                          
                          return (
                            <div
                              key={index}
                              className={`relative rounded-lg overflow-hidden border-4 transition-all ${
                                isSelected
                                  ? "border-blue-500 shadow-lg"
                                  : "border-transparent hover:border-blue-200"
                              }`}
                            >
                              {/* Imagen */}
                              <div
                                onClick={() => toggleImageSelection(image.uri)}
                                className="cursor-pointer hover:scale-105 transition-transform aspect-square"
                              >
                                <img
                                  src={image.uri}
                                  alt={`${selectedRelease.title} - Imagen ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              {/* Checkbox selección */}
                              {isSelected && (
                                <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg">
                                  ✓
                                </div>
                              )}

                              {/* Botón estrella para principal */}
                              {isSelected && (
                                <button
                                  onClick={() => togglePrimaryImage(image.uri)}
                                  className={`absolute top-2 left-2 p-2 rounded-full shadow-lg transition-all ${
                                    isPrimary
                                      ? "bg-yellow-400 text-white"
                                      : "bg-white bg-opacity-80 text-gray-400 hover:bg-yellow-100 hover:text-yellow-500"
                                  }`}
                                  title={isPrimary ? "Imagen principal" : "Marcar como principal"}
                                >
                                  <Star className={`h-5 w-5 ${isPrimary ? "fill-white" : ""}`} />
                                </button>
                              )}

                              {/* Badge "Principal" */}
                              {isPrimary && (
                                <div className="absolute top-12 left-2 bg-yellow-400 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
                                  PRINCIPAL
                                </div>
                              )}

                              {/* Info de imagen */}
                              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2">
                                {image.type || "Imagen"} - {image.width}x{image.height}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-8">No hay imágenes disponibles</p>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="flex gap-3 pt-4 border-t flex-shrink-0">
                    <Button variant="outline" onClick={handleBackToResults} className="flex-1">
                      ← Volver
                    </Button>
                    <Button 
                      onClick={handleImportRelease} 
                      className="flex-1"
                      disabled={selectedImages.length === 0}
                    >
                      Importar {selectedImages.length > 0 && `(${selectedImages.length})`}
                    </Button>
                  </div>
              </>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
