import { IsArray, IsString, IsOptional } from 'class-validator';

export class UploadImagesDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[]; // URLs de Discogs para descargar
}
