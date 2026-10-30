import { IsString, IsUrl, IsUUID, Matches, MinLength } from 'class-validator';

export class WooCommercePluginConnectDto {
  @IsUUID()
  vendorId: string;

  @IsString()
  @MinLength(20)
  connectionCode: string;

  @IsUrl({ require_protocol: true })
  storeUrl: string;

  @IsString()
  @Matches(/^ck_[a-zA-Z0-9]+$/)
  consumerKey: string;

  @IsString()
  @Matches(/^cs_[a-zA-Z0-9]+$/)
  consumerSecret: string;

  @IsString()
  @MinLength(20)
  webhookSecret: string;
}
