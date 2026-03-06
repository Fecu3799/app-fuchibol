import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { GenderDto, PreferredPositionDto, SkillLevelDto } from './register.dto';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => (value as string)?.trim() ?? null)
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }) => (value as string)?.trim() ?? null)
  lastName?: string | null;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsEnum(GenderDto)
  gender?: GenderDto | null;

  @IsOptional()
  @IsEnum(PreferredPositionDto)
  preferredPosition?: PreferredPositionDto | null;

  @IsOptional()
  @IsEnum(SkillLevelDto)
  skillLevel?: SkillLevelDto | null;
}
