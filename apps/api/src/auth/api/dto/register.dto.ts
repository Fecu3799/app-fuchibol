import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum GenderDto {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum PreferredPositionDto {
  GOALKEEPER = 'GOALKEEPER',
  DEFENDER = 'DEFENDER',
  MIDFIELDER = 'MIDFIELDER',
  FORWARD = 'FORWARD',
}

export enum SkillLevelDto {
  BEGINNER = 'BEGINNER',
  AMATEUR = 'AMATEUR',
  REGULAR = 'REGULAR',
  SEMIPRO = 'SEMIPRO',
  PRO = 'PRO',
}

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

  @IsBoolean()
  acceptTerms: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => (value as string)?.trim())
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => (value as string)?.trim())
  lastName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsEnum(GenderDto)
  gender?: GenderDto;

  @IsOptional()
  @IsEnum(PreferredPositionDto)
  preferredPosition?: PreferredPositionDto;

  @IsOptional()
  @IsEnum(SkillLevelDto)
  skillLevel?: SkillLevelDto;
}
