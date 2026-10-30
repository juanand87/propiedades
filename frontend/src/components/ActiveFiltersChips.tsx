"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActiveFiltersChipsProps {
  activeFilters: {
    formats: string[];
    genres: string[];
    conditions: string[];
    priceRange?: string;
    rpms: string[];
    sizes: string[];
    editions: string[];
  };
  allFormats: Array<{ id: string; name: string }>;
  allGenres: Array<{ id: string; name: string }>;
  allEditions: Array<{ id: string; name: string }>;
  onRemoveFilter: (filterType: string, value: string) => void;
  onClearAll: () => void;
}

const CONDITIONS_MAP: Record<string, string> = {
  "new": "Nuevo",
  "used": "Usado",
  "sealed": "Sellado",
  "mint": "Mint (M)",
  "near-mint": "Near Mint (NM)",
  "very-good": "Very Good (VG+)",
  "good": "Good (G)"
};

const PRICE_RANGES_MAP: Record<string, string> = {
  "hasta-5000": "Hasta $5.000",
  "5000-10000": "$5.000 - $10.000",
  "10000-20000": "$10.000 - $20.000",
  "20000-30000": "$20.000 - $30.000",
  "30000-50000": "$30.000 - $50.000",
  "mas-50000": "Más de $50.000"
};

const RPMS_MAP: Record<string, string> = {
  "33": "33 RPM",
  "45": "45 RPM",
  "78": "78 RPM"
};

const SIZES_MAP: Record<string, string> = {
  "7": '7"',
  "10": '10"',
  "12": '12"',
  "LP": "LP"
};

// EDITIONS_MAP ya no se usa, se obtienen dinámicamente desde allEditions

export default function ActiveFiltersChips({
  activeFilters,
  allFormats,
  allGenres,
  allEditions,
  onRemoveFilter,
  onClearAll
}: ActiveFiltersChipsProps) {
  const hasActiveFilters = 
    activeFilters.formats.length > 0 ||
    activeFilters.genres.length > 0 ||
    activeFilters.conditions.length > 0 ||
    activeFilters.priceRange ||
    activeFilters.rpms.length > 0 ||
    activeFilters.sizes.length > 0 ||
    activeFilters.editions.length > 0;

  if (!hasActiveFilters) {
    return null;
  }

  const getFormatName = (id: string) => {
    const format = allFormats.find(f => f.id === id);
    return format?.name || id;
  };

  const getGenreName = (id: string) => {
    const genre = allGenres.find(g => g.id === id);
    return genre?.name || id;
  };

  const getEditionName = (id: string) => {
    const edition = allEditions.find(e => e.id === id);
    return edition?.name || id;
  };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">
        {/* Formatos */}
        {activeFilters.formats.map(formatId => (
          <div
            key={`format-${formatId}`}
            className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm"
          >
            <span className="font-medium">Formato:</span>
            <span>{getFormatName(formatId)}</span>
            <button
              onClick={() => onRemoveFilter('formats', formatId)}
              className="ml-1 hover:bg-purple-200 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Géneros */}
        {activeFilters.genres.map(genreId => (
          <div
            key={`genre-${genreId}`}
            className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
          >
            <span className="font-medium">Género:</span>
            <span>{getGenreName(genreId)}</span>
            <button
              onClick={() => onRemoveFilter('genres', genreId)}
              className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Condiciones */}
        {activeFilters.conditions.map(condition => (
          <div
            key={`condition-${condition}`}
            className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
          >
            <span className="font-medium">Condición:</span>
            <span>{CONDITIONS_MAP[condition] || condition}</span>
            <button
              onClick={() => onRemoveFilter('conditions', condition)}
              className="ml-1 hover:bg-green-200 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Precio */}
        {activeFilters.priceRange && (
          <div className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
            <span className="font-medium">Precio:</span>
            <span>{PRICE_RANGES_MAP[activeFilters.priceRange] || activeFilters.priceRange}</span>
            <button
              onClick={() => onRemoveFilter('priceRange', activeFilters.priceRange!)}
              className="ml-1 hover:bg-yellow-200 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* RPMs */}
        {activeFilters.rpms.map(rpm => (
          <div
            key={`rpm-${rpm}`}
            className="inline-flex items-center gap-1 bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm"
          >
            <span className="font-medium">RPM:</span>
            <span>{RPMS_MAP[rpm] || rpm}</span>
            <button
              onClick={() => onRemoveFilter('rpms', rpm)}
              className="ml-1 hover:bg-pink-200 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Tamaños */}
        {activeFilters.sizes.map(size => (
          <div
            key={`size-${size}`}
            className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm"
          >
            <span className="font-medium">Tamaño:</span>
            <span>{SIZES_MAP[size] || size}</span>
            <button
              onClick={() => onRemoveFilter('sizes', size)}
              className="ml-1 hover:bg-indigo-200 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Ediciones */}
        {activeFilters.editions.map(editionId => (
          <div
            key={`edition-${editionId}`}
            className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm"
          >
            <span className="font-medium">Edición:</span>
            <span>{getEditionName(editionId)}</span>
            <button
              onClick={() => onRemoveFilter('editions', editionId)}
              className="ml-1 hover:bg-orange-200 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
