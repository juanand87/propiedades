import { IsString, IsOptional, IsObject, IsBoolean, IsNumber } from 'class-validator';

export class UpdateVendorSettingsDto {
  // Discogs Integration
  @IsString()
  @IsOptional()
  discogsApiKey?: string;

  @IsString()
  @IsOptional()
  discogsApiSecret?: string;

  @IsString()
  @IsOptional()
  discogsToken?: string;

  // General Settings
  @IsString()
  @IsOptional()
  marketplaceUrl?: string;

  @IsString()
  @IsOptional()
  customDomain?: string;

  @IsString()
  @IsOptional()
  companyLegalName?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  companyAddress?: string;

  // Business Settings
  @IsBoolean()
  @IsOptional()
  isWholesaleEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  publishInMarketplace?: boolean;

  // JSON Objects
  @IsObject()
  @IsOptional()
  policies?: any;

  @IsObject()
  @IsOptional()
  emailSettings?: any;

  @IsObject()
  @IsOptional()
  notificationSettings?: any;

  @IsObject()
  @IsOptional()
  shippingSettings?: any;

  // Design Settings
  @IsOptional()
  headerType?: number;

  @IsObject()
  @IsOptional()
  headerConfig?: any;

  @IsObject()
  @IsOptional()
  topBarPhrases?: any; // { phrases: string[], enableRotating: boolean, rotationSpeed: number, scrollSpeed: number }

  @IsOptional()
  slides?: any; // Puede ser array o null

  @IsObject()
  @IsOptional()
  heroSliderConfig?: any; // { enabled, sliderId, overlayCards, autoplay, interval }

  @IsOptional()
  productGridColumns?: number;

  @IsObject()
  @IsOptional()
  colors?: any;

  @IsString()
  @IsOptional()
  colorTheme?: string;

  @IsOptional()
  customColors?: any;

  @IsObject()
  @IsOptional()
  menuConfig?: any;

  @IsObject()
  @IsOptional()
  footerConfig?: any;

  // Product Description Templates
  @IsString()
  @IsOptional()
  shortDescriptionTemplate?: string;

  @IsString()
  @IsOptional()
  descriptionTemplate?: string;

  @IsString()
  @IsOptional()
  technicalSpecsTemplate?: string;

  // Gemini AI Integration
  @IsString()
  @IsOptional()
  geminiApiKey?: string;

  @IsString()
  @IsOptional()
  geminiPrompt?: string;

  @IsBoolean()
  @IsOptional()
  geminiEnabled?: boolean;

  // Product Page Configuration
  @IsObject()
  @IsOptional()
  productPageSections?: any;

  @IsObject()
  @IsOptional()
  productPageLayout?: any;

  @IsOptional()
  productPageRightColumnOrder?: any;

  @IsOptional()
  productPageTabsOrder?: any;

  @IsOptional()
  productInfoBar?: any;

  // Spotify Integration
  @IsBoolean()
  @IsOptional()
  spotifyEnabled?: boolean;

  @IsString()
  @IsOptional()
  spotifyClientId?: string;

  @IsString()
  @IsOptional()
  spotifyClientSecret?: string;

  @IsString()
  @IsOptional()
  spotifyRefreshToken?: string;

  @IsString()
  @IsOptional()
  spotifyUserId?: string;

  @IsString()
  @IsOptional()
  spotifyPlaylistId?: string;

  // Menus Configuration
  @IsObject()
  @IsOptional()
  menus?: any;

  // Custom Menus Configuration (new structure)
  @IsObject()
  @IsOptional()
  customMenus?: any;

  // Filters Configuration
  @IsObject()
  @IsOptional()
  filters?: any;

  // Banners Configuration
  @IsOptional()
  banners?: any;

  // Product Grid Category Display Configuration
  @IsObject()
  @IsOptional()
  productGridCategoryDisplay?: any;

  // Image Rollover Configuration
  @IsBoolean()
  @IsOptional()
  imageRolloverEnabled?: boolean;

  // Onboarding
  @IsBoolean()
  @IsOptional()
  onboardingCompleted?: boolean;

  // Payku Affiliation Configuration
  @IsString()
  @IsOptional()
  paykuIdentifier?: string;

  @IsString()
  @IsOptional()
  paykuPublicToken?: string;

  // Payku URLs Configuration
  @IsString()
  @IsOptional()
  paykuNotifyUrl?: string;

  @IsString()
  @IsOptional()
  paykuReturnUrl?: string;

  @IsString()
  @IsOptional()
  paykuCancelUrl?: string;

  // WooCommerce Integration
  @IsString()
  @IsOptional()
  wooClientKey?: string;

  @IsString()
  @IsOptional()
  wooClientSecret?: string;

  @IsString()
  @IsOptional()
  wooStoreUrl?: string;

  @IsString()
  @IsOptional()
  wooWebhookSecret?: string;

  @IsBoolean()
  @IsOptional()
  wooAutoSync?: boolean;

  @IsOptional()
  wooCategoryMapping?: Record<string, string>;

  // SMTP Configuration
  @IsString()
  @IsOptional()
  smtpHost?: string;

  @IsNumber()
  @IsOptional()
  smtpPort?: number;

  @IsBoolean()
  @IsOptional()
  smtpSecure?: boolean;

  @IsString()
  @IsOptional()
  smtpUser?: string;

  @IsString()
  @IsOptional()
  smtpPassword?: string;

  @IsString()
  @IsOptional()
  smtpFromEmail?: string;

  @IsString()
  @IsOptional()
  smtpFromName?: string;
}
