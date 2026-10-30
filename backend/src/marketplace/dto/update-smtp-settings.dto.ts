import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class UpdateSmtpSettingsDto {
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  smtpUser?: string;

  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @IsOptional()
  @IsString()
  smtpFromEmail?: string;

  @IsOptional()
  @IsString()
  smtpFromName?: string;
}
