import { IsArray, IsIn, IsOptional, IsString, ArrayMaxSize, ArrayMinSize } from 'class-validator';

export class GenerateAiImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  productIds: string[];

  @IsString()
  scenario: string;

  @IsString()
  style: string;

  @IsOptional()
  @IsString()
  decoration?: string;

  @IsOptional()
  @IsIn(['1024x1024'])
  size?: '1024x1024';

  @IsOptional()
  @IsIn(['gpt-image-1-mini', 'gpt-image-1'])
  model?: 'gpt-image-1-mini' | 'gpt-image-1';

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'auto'])
  quality?: 'low' | 'medium' | 'high' | 'auto';
}
