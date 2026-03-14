import { IsString, MaxLength } from 'class-validator';

export class AdminBanDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
