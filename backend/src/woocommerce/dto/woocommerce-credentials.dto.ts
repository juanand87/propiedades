import { IsString, IsUrl } from 'class-validator';

export class WooCommerceCredentialsDto {
  @IsUrl()
  storeUrl: string;

  @IsString()
  consumerKey: string;

  @IsString()
  consumerSecret: string;
}
