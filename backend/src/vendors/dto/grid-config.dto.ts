export interface GridConfig {
  id: string;
  type: 'homepage' | 'category'; // Portada o Categoría
  columns: number; // 1-5 columnas
  rows: number | null; // null = ilimitado (infinite scroll)
  displayMode: 'specific-category' | 'latest' | 'featured' | 'best-sellers'; // Tipo de productos a mostrar
  categoryId?: string; // Solo si displayMode es 'specific-category'
  sortBy?: 'newest' | 'most-sold' | 'featured'; // Ordenamiento
  isActive: boolean;
  order: number; // Orden de aparición
}

export interface GridConfigDto {
  type: 'homepage' | 'category';
  columns: number;
  rows: number | null;
  displayMode: 'specific-category' | 'latest' | 'featured' | 'best-sellers';
  categoryId?: string;
  sortBy?: 'newest' | 'most-sold' | 'featured';
  isActive?: boolean;
  order?: number;
}
