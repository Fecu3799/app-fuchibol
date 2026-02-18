import { IsInt, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PromoteAdminDto {
  @IsUUID()
  userId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;
}

export class DemoteAdminDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;
}
