import { IsEmail, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestEmailVerifyDto {
  @IsString()
  @IsEmail()
  @Transform(({ value }) => (value as string).toLowerCase().trim())
  email: string;
}
