"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface FilterOptions {
  formats: Array<{ id: string; name: string }>;
  genres: Array<{ id: string; name: string; slug: string }>;
  conditions: Array<{ value: string; label: string }>;
  priceRanges: Array<{ slug: string; label: string }>;
  rpms: Array<{ value: string; label: string }>;
  sizes: Array<{ value: string; label: string }>;
  editions: Array<{ value: string; label: string }>;
}

interface ActiveFilters {
  formats: string[];
  genres: string[];
  conditions: string[];
  priceRange?: string;
  rpms: string[];
  sizes: string[];
  editions: string[];
  minPrice?: number;
  maxPrice?: number;
}

interface ProductFilterSidebarProps {
  onFilterChange: (filters: ActiveFilters) => void;
  initialFilters?: Partial<ActiveFilters>;
  products?: any[]; // Productos actuales para calcular filtros disponibles
}

const CONDITIONS = [
  { value: "new", label: "Nuevo" },
  { value: "used", label: "Usado" },
  { value: "sealed", label: "Sellado" },
  { value: "mint", label: "Mint (M)" },
  { value: "near-mint", label: "Near Mint (NM)" },
  { value: "very-good", label: "Very Good (VG+)" },
  { value: "good", label: "Good (G)" }
];

const PRICE_RANGES = [
  { slug: "hasta-5000", label: "Hasta $5.000", min: 0, max: 5000 },
  { slug: "5000-10000", label: "$5.000 - $10.000", min: 5000, max: 10000 },
  { slug: "10000-20000", label: "$10.000 - $20.000", min: 10000, max: 20000 },
  { slug: "20000-30000", label: "$20.000 - $30.000", min: 20000, max: 30000 },
  { slug: "30000-50000", label: "$30.000 - $50.000", min: 30000, max: 50000 },
  { slug: "mas-50000", label: "Más de $50.000", min: 50000, max: 999999999 }
];

const RPMS = [
  { value: "33", label: "33 RPM (LP)" },
  { value: "45", label: "45 RPM (Single)" },
  { value: "78", label: "78 RPM (Vintage)" }
];

const SIZES = [
  { value: "7", label: '7" (Single)' },
  { value: "10", label: '10" (EP)' },
  { value: "12", label: '12" (LP)' },
  { value: "LP", label: 'LP' }
];

// EDITIONS se cargarán dinámicamente desde la API (igual que formats y genres)

export default function ProductFilterSidebar({ onFilterChange, initialFilters = {}, products = [] }: ProductFilterSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    formato: true,
    genero: true,
    condicion: false,
    precio: false,
    rpm: false,
    size: false,
    edicion: false
  });

  const [formats, setFormats] = useState<Array<{ id: string; name: string }>>([]);
  const [genres, setGenres] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [editions, setEditions] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    formats: initialFilters.formats || [],
    genres: initialFilters.genres || [],
    conditions: initialFilters.conditions || [],
    priceRange: initialFilters.priceRange,
    rpms: initialFilters.rpms || [],
    sizes: initialFilters.sizes || [],
    editions: initialFilters.editions || [],
    minPrice: initialFilters.minPrice,
    maxPrice: initialFilters.maxPrice
  });

  useEffect(() => {
    loadFilterOptions();
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [products]); // Recargar cuando cambien los productos

  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  const loadFilterOptions = async () => {
    try {
      setLoading(true);
      
      // Si hay productos, extraer géneros, formatos y ediciones únicos de ellos
      if (products && products.length > 0) {
        // Extraer géneros únicos
        const uniqueGenres = new Map<string, { id: string; name: string; slug: string }>();
        products.forEach(product => {
          if (product.genres && Array.isArray(product.genres)) {
            product.genres.forEach((genre: any) => {
              if (!uniqueGenres.has(genre.id.toString())) {
                uniqueGenres.set(genre.id.toString(), {
                  id: genre.id.toString(),
                  name: genre.name,
                  slug: genre.slug
                });
              }
            });
          }
        });

        // Extraer formatos únicos
        const uniqueFormats = new Map<string, { id: string; name: string }>();
        products.forEach(product => {
          if (product.formats && Array.isArray(product.formats)) {
            product.formats.forEach((format: any) => {
              if (!uniqueFormats.has(format.id.toString())) {
                uniqueFormats.set(format.id.toString(), {
                  id: format.id.toString(),
                  name: format.name
                });
              }
            });
          }
        });

        // Extraer ediciones únicas de los productos
        const uniqueEditions = new Map<string, { id: string; name: string }>();
        products.forEach(product => {
          if (product.editions && Array.isArray(product.editions)) {
            product.editions.forEach((edition: any) => {
              if (!uniqueEditions.has(edition.id.toString())) {
                uniqueEditions.set(edition.id.toString(), {
                  id: edition.id.toString(),
                  name: edition.name
                });
              }
            });
          }
        });

        setGenres(Array.from(uniqueGenres.values()).sort((a, b) => a.name.localeCompare(b.name)));
        setFormats(Array.from(uniqueFormats.values()).sort((a, b) => a.name.localeCompare(b.name)));
        setEditions(Array.from(uniqueEditions.values()).sort((a, b) => a.name.localeCompare(b.name)));
        console.log('🎨 [ProductFilterSidebar] Editions extracted from products:', Array.from(uniqueEditions.values()));
      } else {
        // Si no hay productos, cargar todos los géneros, formatos y ediciones del sistema
        const formatsData = await api.get('/formats');
        const formatsList = Array.isArray(formatsData) ? formatsData : (formatsData.formats || []);
        setFormats(formatsList);

        const genresData = await api.getGenres();
        const genresList = Array.isArray(genresData) ? genresData : (genresData.genres || []);
        setGenres(genresList);
        
        // Cargar todas las ediciones del sistema si no hay productos
        const editionsData = await api.get('/editions', false);
        const editionsList = Array.isArray(editionsData) ? editionsData : (editionsData.editions || []);
        setEditions(editionsList);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading filter options:", error);
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFormatChange = (formatId: string, checked: boolean) => {
    const newFormats = checked
      ? [...activeFilters.formats, formatId]
      : activeFilters.formats.filter(f => f !== formatId);
    
    const newFilters = { ...activeFilters, formats: newFormats };
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleGenreChange = (genreId: string, checked: boolean) => {
    const newGenres = checked
      ? [...activeFilters.genres, genreId]
      : activeFilters.genres.filter(g => g !== genreId);
    
    const newFilters = { ...activeFilters, genres: newGenres };
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleConditionChange = (condition: string, checked: boolean) => {
    const newConditions = checked
      ? [...activeFilters.conditions, condition]
      : activeFilters.conditions.filter(c => c !== condition);
    
    const newFilters = { ...activeFilters, conditions: newConditions };
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handlePriceRangeChange = (slug: string) => {
    const range = PRICE_RANGES.find(r => r.slug === slug);
    const newFilters = {
      ...activeFilters,
      priceRange: slug,
      minPrice: range?.min,
      maxPrice: range?.max
    };
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleRPMChange = (rpm: string, checked: boolean) => {
    const newRPMs = checked
      ? [...activeFilters.rpms, rpm]
      : activeFilters.rpms.filter(r => r !== rpm);
    
    const newFilters = { ...activeFilters, rpms: newRPMs };
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSizeChange = (size: string, checked: boolean) => {
    const newSizes = checked
      ? [...activeFilters.sizes, size]
      : activeFilters.sizes.filter(s => s !== size);
    
    const newFilters = { ...activeFilters, sizes: newSizes };
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleEditionChange = (edition: string, checked: boolean) => {
    const newEditions = checked
      ? [...activeFilters.editions, edition]
      : activeFilters.editions.filter(e => e !== edition);
    
    const newFilters = { ...activeFilters, editions: newEditions };
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    const emptyFilters: ActiveFilters = {
      formats: [],
      genres: [],
      conditions: [],
      rpms: [],
      sizes: [],
      editions: []
    };
    setActiveFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const getActiveFilterCount = () => {
    return (
      activeFilters.formats.length +
      activeFilters.genres.length +
      activeFilters.conditions.length +
      (activeFilters.priceRange ? 1 : 0) +
      activeFilters.rpms.length +
      activeFilters.sizes.length +
      activeFilters.editions.length
    );
  };

  const getSectionFilterCount = (sectionKey: string) => {
    switch(sectionKey) {
      case 'formato': return activeFilters.formats.length;
      case 'genero': return activeFilters.genres.length;
      case 'condicion': return activeFilters.conditions.length;
      case 'precio': return activeFilters.priceRange ? 1 : 0;
      case 'rpm': return activeFilters.rpms.length;
      case 'size': return activeFilters.sizes.length;
      case 'edicion': return activeFilters.editions.length;
      default: return 0;
    }
  };

  const FilterSection = ({ 
    title, 
    sectionKey, 
    items, 
    activeItems, 
    onChange,
    valueKey = 'value'
  }: {
    title: string;
    sectionKey: string;
    items: any[];
    activeItems: string[];
    onChange: (value: string, checked: boolean) => void;
    valueKey?: string;
  }) => {
    const activeCount = getSectionFilterCount(sectionKey);
    return (
      <div className="border-b border-gray-200 pb-2">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center justify-between w-full py-1.5 text-left font-semibold text-sm text-gray-900 hover:text-purple-600"
        >
          <div className="flex items-center gap-1.5">
            <span>{title}</span>
            {activeCount > 0 && (
              <span className="bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {activeCount}
              </span>
            )}
          </div>
          {expandedSections[sectionKey] ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      
      {expandedSections[sectionKey] && (
        <div className="mt-1.5 space-y-1.5 max-h-48 overflow-y-auto">
          {items.map((item) => {
            const value = String(valueKey === 'name' ? item.name : item[valueKey]);
            const label = item.label || item.name;
            const id = `${sectionKey}-${value}`;
            
            return (
              <div key={value} className="flex items-center space-x-1.5">
                <Checkbox
                  id={id}
                  checked={activeItems.includes(value)}
                  onCheckedChange={(checked) => onChange(value, checked as boolean)}
                />
                <Label
                  htmlFor={id}
                  className="text-xs text-gray-700 cursor-pointer flex-1 leading-tight"
                >
                  {label}
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
  };

  const sidebarContent = (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h2 className="text-lg font-bold">Filtros</h2>
          {getActiveFilterCount() > 0 && (
            <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
              {getActiveFilterCount()}
            </span>
          )}
        </div>
        {isMobile && (
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Cargando filtros...</p>
          </div>
        ) : (
          <>
            {/* Formato */}
            {formats.length > 0 && (
              <FilterSection
                title="Formato"
                sectionKey="formato"
                items={formats}
                activeItems={activeFilters.formats}
                onChange={handleFormatChange}
                valueKey="id"
              />
            )}

            {/* Género */}
            {genres.length > 0 && (
              <FilterSection
                title="Género"
                sectionKey="genero"
                items={genres.map(g => ({ ...g, value: g.id }))}
                activeItems={activeFilters.genres}
                onChange={handleGenreChange}
                valueKey="id"
              />
            )}

            {/* Condición */}
            <FilterSection
              title="Condición"
              sectionKey="condicion"
              items={CONDITIONS}
              activeItems={activeFilters.conditions}
              onChange={handleConditionChange}
            />

            {/* Precio */}
            <div className="border-b border-gray-200 pb-4">
              <button
                onClick={() => toggleSection('precio')}
                className="flex items-center justify-between w-full py-2 text-left font-semibold text-gray-900 hover:text-purple-600"
              >
                <div className="flex items-center gap-2">
                  <span>Precio</span>
                  {activeFilters.priceRange && (
                    <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                      1
                    </span>
                  )}
                </div>
                {expandedSections.precio ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              
              {expandedSections.precio && (
                <div className="mt-2 space-y-2">
                  {PRICE_RANGES.map((range) => (
                    <div key={range.slug} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`price-${range.slug}`}
                        name="priceRange"
                        checked={activeFilters.priceRange === range.slug}
                        onChange={() => handlePriceRangeChange(range.slug)}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <Label
                        htmlFor={`price-${range.slug}`}
                        className="text-sm text-gray-700 cursor-pointer flex-1"
                      >
                        {range.label}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RPM */}
            <FilterSection
              title="RPM"
              sectionKey="rpm"
              items={RPMS}
              activeItems={activeFilters.rpms}
              onChange={handleRPMChange}
            />

            {/* Tamaño */}
            <FilterSection
              title="Tamaño"
              sectionKey="size"
              items={SIZES}
              activeItems={activeFilters.sizes}
              onChange={handleSizeChange}
            />

            {/* Edición */}
            {editions.length > 0 && (
              <FilterSection
                title="Edición"
                sectionKey="edicion"
                items={editions}
                activeItems={activeFilters.editions}
                onChange={handleEditionChange}
                valueKey="id"
              />
            )}
            {editions.length === 0 && (
              <div className="text-sm text-gray-500 p-4">No hay ediciones disponibles</div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {getActiveFilterCount() > 0 && (
        <div className="p-4 border-t border-gray-200">
          <Button
            variant="outline"
            className="w-full"
            onClick={clearAllFilters}
          >
            Limpiar todos los filtros
          </Button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile Toggle Button */}
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg h-14 w-14 p-0"
        >
          <Filter className="h-6 w-6" />
          {getActiveFilterCount() > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {getActiveFilterCount()}
            </span>
          )}
        </Button>

        {/* Mobile Overlay */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 w-80 bg-white z-50 shadow-xl">
              {sidebarContent}
            </div>
          </>
        )}
      </>
    );
  }

  // Desktop Sidebar
  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full">
      {sidebarContent}
    </div>
  );
}
