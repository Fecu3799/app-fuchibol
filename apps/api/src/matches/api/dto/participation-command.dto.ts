import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ParticipationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;
}

export class InviteCommandDto extends ParticipationCommandDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  identifier?: string;

  /** Validation: at least one of userId or identifier must be provided. */
  @ValidateIf((o) => !o.userId && !o.identifier)
  @IsUUID(undefined, {
    message: 'Either userId or identifier must be provided',
  })
  _requireOne?: string;
}
