"use client";

import { useState, useEffect, useRef } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getProductUrl, getProductsUrl } from "@/lib/useCustomDomain";

interface SearchBarProps {
  vendor: any;
  slug: string;
  placeholder?: string;
  className?: string;
  showButton?: boolean;
}

type AdvancedFilters = {
  artist: string;
  format: string;
  genre: string;
  condition: string;
  country: string;
};

const emptyAdvancedFilters: AdvancedFilters = {
  artist: "",
  format: "",
  genre: "",
  condition: "",
  country: "",
};

export default function SearchBar({
  vendor,
  slug,
  placeholder = "Buscar albumes, artistas, formatos...",
  className = "",
  showButton = true,
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(emptyAdvancedFilters);
  const [formats, setFormats] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  const hasAdvancedFilters = Object.values(advancedFilters).some((value) => value.trim() !== "");

  const buildSearchParams = (limit?: number) => {
    const searchParams: any = {};

    if (searchQuery.trim()) searchParams.search = searchQuery.trim();
    if (advancedFilters.artist.trim()) searchParams.artist = advancedFilters.artist.trim();
    if (advancedFilters.format) searchParams.format = advancedFilters.format;
    if (advancedFilters.genre) searchParams.genre = advancedFilters.genre;
    if (advancedFilters.condition) searchParams.condition = advancedFilters.condition;
    if (advancedFilters.country.trim()) searchParams.country = advancedFilters.country.trim();
    if (limit) searchParams.limit = limit;

    if (slug === "marketplace" || vendor?.slug === "marketplace") {
      searchParams.marketplaceOnly = true;
    } else if (vendor?.id) {
      searchParams.vendorId = vendor.id;
    }

    return searchParams;
  };

  const getAllResultsUrl = () => {
    const queryParams: Record<string, string> = {};
    if (searchQuery.trim()) queryParams.search = searchQuery.trim();
    if (advancedFilters.artist.trim()) queryParams.artist = advancedFilters.artist.trim();
    if (advancedFilters.format) queryParams.format = advancedFilters.format;
    if (advancedFilters.genre) queryParams.genre = advancedFilters.genre;
    if (advancedFilters.condition) queryParams.condition = advancedFilters.condition;
    if (advancedFilters.country.trim()) queryParams.country = advancedFilters.country.trim();

    return getProductsUrl(slug, queryParams);
  };

  const loadAdvancedOptions = async () => {
    if (formats.length > 0 || genres.length > 0 || loadingFilters) return;

    setLoadingFilters(true);
    try {
      const [formatsData, genresData] = await Promise.all([api.getFormats(), api.getGenres()]);
      const formatsList = Array.isArray(formatsData) ? formatsData : formatsData.formats || [];
      setFormats(formatsList.filter((format: any) => Number(format.productCount || 0) >= 5));
      setGenres(Array.isArray(genresData) ? genresData : genresData.genres || []);
    } catch (error) {
      console.error("Error loading advanced search options:", error);
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleSearch = async () => {
    const hasQuery = searchQuery.trim() || hasAdvancedFilters;
    if (!hasQuery) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await api.getProducts(buildSearchParams(10));
      const productsList = Array.isArray(results) ? results : results.products || results.data || [];
      setSearchResults(productsList);
      setShowResults(true);
    } catch (error) {
      console.error("Error searching products:", error);
      setSearchResults([]);
      setShowResults(true);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery, advancedFilters]);

  useEffect(() => {
    if (advancedOpen) loadAdvancedOptions();
  }, [advancedOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setAdvancedOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearSearch = () => {
    setSearchQuery("");
    setAdvancedFilters(emptyAdvancedFilters);
    setSearchResults([]);
    setShowResults(false);
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters(emptyAdvancedFilters);
  };

  const handleResultClick = () => {
    setShowResults(false);
    setAdvancedOpen(false);
  };

  const updateAdvancedFilter = (key: keyof AdvancedFilters, value: string) => {
    setAdvancedFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => (searchQuery || hasAdvancedFilters) && setShowResults(true)}
          placeholder={placeholder}
          className="w-full px-6 py-3 pr-40 border-2 border-gray-300 rounded-full focus:outline-none theme-search-input transition-all"
        />

        {(searchQuery || hasAdvancedFilters) && (
          <button
            onClick={clearSearch}
            className="absolute right-28 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            title="Limpiar busqueda"
            type="button"
          >
            <X size={18} />
          </button>
        )}

        <button
          onClick={() => setAdvancedOpen((open) => !open)}
          className={`absolute right-16 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border transition-all ${advancedOpen || hasAdvancedFilters ? "theme-border theme-text bg-white" : "border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
          title="Busqueda avanzada"
          type="button"
        >
          <SlidersHorizontal size={18} />
        </button>

        {showButton && (
          <button
            onClick={handleSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-12 text-white rounded-full hover:shadow-lg transition-all font-medium flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--color-primary, #9333ea) 0%, var(--color-secondary, #2563eb) 100%)",
            }}
            type="button"
          >
            <Search size={18} />
          </button>
        )}
      </div>

      {(showResults || advancedOpen) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[620px] overflow-y-auto z-50">
          {advancedOpen && (
            <div className="p-4 border-b border-gray-100 bg-gray-50/80">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Artista</span>
                  <input
                    type="text"
                    value={advancedFilters.artist}
                    onChange={(e) => updateAdvancedFilter("artist", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none theme-search-input"
                    placeholder="Ej: Depeche Mode"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Album / titulo</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none theme-search-input"
                    placeholder="Ej: Violator"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Formato</span>
                  <select
                    value={advancedFilters.format}
                    onChange={(e) => updateAdvancedFilter("format", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none theme-search-input"
                  >
                    <option value="">Todos</option>
                    {formats.map((format) => (
                      <option key={format.id} value={format.id}>{format.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Genero</span>
                  <select
                    value={advancedFilters.genre}
                    onChange={(e) => updateAdvancedFilter("genre", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none theme-search-input"
                  >
                    <option value="">Todos</option>
                    {genres.map((genre) => (
                      <option key={genre.id} value={genre.id}>{genre.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Condicion</span>
                  <select
                    value={advancedFilters.condition}
                    onChange={(e) => updateAdvancedFilter("condition", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none theme-search-input"
                  >
                    <option value="">Todas</option>
                    <option value="new">Nuevo</option>
                    <option value="used">Usado</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Pais de edicion</span>
                  <input
                    type="text"
                    value={advancedFilters.country}
                    onChange={(e) => updateAdvancedFilter("country", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none theme-search-input"
                    placeholder="Ej: Chile, Japan, US"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={clearAdvancedFilters}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Limpiar filtros
                </button>
                <div className="flex gap-2">
                  {loadingFilters && <span className="text-xs text-gray-500 self-center">Cargando filtros...</span>}
                  <Link
                    href={getAllResultsUrl()}
                    onClick={handleResultClick}
                    className="rounded-lg border theme-border theme-text px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                  >
                    Ver todos
                  </Link>
                  <Link
                    href={getAllResultsUrl()}
                    onClick={handleResultClick}
                    className="rounded-lg theme-gradient-bg px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Buscar
                  </Link>
                </div>
              </div>
            </div>
          )}

          {isSearching ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin inline-block w-6 h-6 border-2 theme-border border-t-transparent rounded-full"></div>
              <p className="mt-2">Buscando...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {searchResults.map((product) => {
                let imageUrl = null;

                if (product.image) imageUrl = product.image;
                else if (product.imageUrl) imageUrl = product.imageUrl;
                else if (product.images && Array.isArray(product.images) && product.images.length > 0) imageUrl = product.images[0];
                else if (product.coverImage) imageUrl = product.coverImage;
                else if (product.thumbnail) imageUrl = product.thumbnail;

                if (imageUrl && imageUrl.startsWith("/uploads/")) {
                  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
                  const apiHost = hostname === "localhost" || hostname === "127.0.0.1" ? "http://localhost:3001" : `http://${hostname}:3001`;
                  imageUrl = `${apiHost}${imageUrl}`;
                }

                const priceValue = product.price || product.salePrice || 0;

                return (
                  <Link
                    key={product.id}
                    href={getProductUrl(product, slug)}
                    onClick={handleResultClick}
                    className="block p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Search size={24} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{product.title}</h4>
                        {product.artist && <p className="text-xs text-gray-500 truncate">{product.artist}</p>}
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          {product.format && <span>{product.format}</span>}
                          {product.country && <span>{product.country}</span>}
                          {product.year && <span>{product.year}</span>}
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <p className="text-base font-bold theme-text mb-1">
                          ${Math.round(priceValue).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        {product.stock > 0 ? (
                          <span className="text-xs text-green-600 font-medium">En stock</span>
                        ) : (
                          <span className="text-xs text-red-600 font-medium">Sin stock</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}

              {searchResults.length >= 10 && (
                <div className="p-3 text-center">
                  <Link
                    href={getAllResultsUrl()}
                    onClick={handleResultClick}
                    className="text-sm theme-text hover:opacity-80 font-medium"
                  >
                    Ver todos los resultados
                  </Link>
                </div>
              )}
            </div>
          ) : searchQuery || hasAdvancedFilters ? (
            <div className="p-8 text-center text-gray-500">
              <Search size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No se encontraron resultados</p>
              <p className="text-sm mt-1">Intenta con otros terminos de busqueda</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
