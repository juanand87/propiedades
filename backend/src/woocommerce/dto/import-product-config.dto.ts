export interface ImportProductConfig {
  productId: number;
  condition: 'new' | 'used';
  mediaGrade?: string;
  sleeveGrade?: string;
  categoryIds?: string[];
  enableSpotify?: boolean;
}

export class ImportProductsDto {
  products: ImportProductConfig[];
}
