import { IsEmail, IsString, Length } from 'class-validator';

export class RequestAccessDto {
  @IsEmail()
  email: string;
}

export class VerifyAccessDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  token: string;
}
