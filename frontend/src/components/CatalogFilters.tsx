"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FilterItem {
  label: string;
  count: number;
  value: string;
}

interface Filters {
  format: string[];
  genre: string[];
  mediaGrade: string[];
  sleeveGrade: string[];
}

interface CatalogFiltersProps {
  filters: Filters;
  availableFilters: {
    formats: FilterItem[];
    genres: FilterItem[];
    mediaGrades: FilterItem[];
    sleeveGrades: FilterItem[];
  };
  onFilterChange: (category: keyof Filters, value: string) => void;
  goldmineOrder?: string[];
}

export default function CatalogFilters({
  filters,
  availableFilters,
  onFilterChange,
  goldmineOrder = ['M', 'NM', 'NM or M-', 'VG+', 'VG', 'G+', 'G', 'P']
}: CatalogFiltersProps) {
  const [expandedFilters, setExpandedFilters] = useState({
    format: false,
    genre: false,
    mediaGrade: false,
    sleeveGrade: false,
  });

  const toggleExpanded = (category: keyof typeof expandedFilters) => {
    setExpandedFilters(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const renderFilterSection = (
    title: string,
    category: keyof typeof expandedFilters,
    items: FilterItem[]
  ) => {
    const isExpanded = expandedFilters[category];
    const displayItems = isExpanded ? items : items.slice(0, 5);
    const hasMore = items.length > 5;

    return (
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
        <div className="space-y-2">
          {displayItems.map((item) => (
            <label
              key={item.value}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
            >
              <input
                type="checkbox"
                checked={filters[category].includes(item.value)}
                onChange={() => onFilterChange(category, item.value)}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <span className="text-sm text-gray-700 flex-1">{item.label}</span>
              <span className="text-xs text-gray-400">({item.count})</span>
            </label>
          ))}
          {hasMore && (
            <button
              onClick={() => toggleExpanded(category)}
              className="text-sm theme-text hover:opacity-80 font-medium flex items-center gap-1 mt-2 transition-opacity"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Mostrar más ({items.length - 5})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-fit rounded-lg border bg-white p-6 lg:sticky lg:top-[172px] lg:max-h-[calc(100vh-188px)] lg:overflow-y-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-900">🎛️ Filtros</h2>

      {/* Formato */}
      {renderFilterSection(
        '💿 Formato',
        'format',
        availableFilters.formats.length > 0 
          ? availableFilters.formats 
          : [
              { label: 'CD', count: 0, value: 'CD' },
              { label: 'Vinilo', count: 0, value: 'Vinyl' },
              { label: 'Cassette', count: 0, value: 'Cassette' },
              { label: 'DVD', count: 0, value: 'DVD' },
              { label: 'Blu-ray', count: 0, value: 'Blu-ray' },
              { label: 'Merchandise', count: 0, value: 'Merchandise' },
            ]
      )}

      {/* Género */}
      {renderFilterSection(
        '🎸 Género',
        'genre',
        availableFilters.genres.length > 0 
          ? availableFilters.genres 
          : []
      )}

      {/* Estado del Soporte (Goldmine) */}
      {renderFilterSection(
        '💎 Estado del Soporte',
        'mediaGrade',
        availableFilters.mediaGrades.length > 0
          ? availableFilters.mediaGrades
          : goldmineOrder.map(grade => ({ label: grade, count: 0, value: grade }))
      )}

      {/* Estado de la Carátula (Goldmine) */}
      {renderFilterSection(
        '📦 Estado de la Carátula',
        'sleeveGrade',
        availableFilters.sleeveGrades.length > 0
          ? availableFilters.sleeveGrades
          : goldmineOrder.map(grade => ({ label: grade, count: 0, value: grade }))
      )}
    </div>
  );
}
