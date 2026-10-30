export class BulkImportConfigDto {
  condition: 'new' | 'used';
  mediaGrade?: string; // Escala Goldmine para disco
  sleeveGrade?: string; // Escala Goldmine para portada
  includeWholesalePrices: boolean;
  minimumPrice: number;
  createIncomplete: boolean; // true = crear productos sin Discogs, false = omitir
}

export class ValidateImportDto {
  config: BulkImportConfigDto;
}

export class ExecuteImportDto {
  config: BulkImportConfigDto;
  products: Array<{
    rowNumber: number;
    barcode: string;
    priceRetail: number;
    priceWholesale?: number;
    category: string;
    quantity: number;
    discogsMatch?: any; // Datos del match de Discogs (opcional si no hay match)
  }>;
}

export interface ValidationResult {
  valid: boolean;
  products: Array<{
    rowNumber: number;
    barcode: string;
    priceRetail: number;
    priceWholesale?: number;
    category: string;
    quantity: number;
    status: 'ok' | 'warning' | 'error';
    errors: string[];
    warnings: string[];
    discogsMatch?: any;
  }>;
  summary: {
    total: number;
    ok: number;
    warnings: number;
    errors: number;
  };
}
