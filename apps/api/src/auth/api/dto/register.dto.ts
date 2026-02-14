import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }) => (value as string).toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-z0-9][a-z0-9_]*$/, {
    message:
      'username must be 3-20 chars, [a-z0-9_], start with letter or number',
  })
  @Transform(({ value }) => (value as string)?.toLowerCase().trim())
  username?: string;
}
