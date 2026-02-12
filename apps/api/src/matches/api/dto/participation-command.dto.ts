import { IsInt, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ParticipationCommandDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;
}

export class InviteCommandDto extends ParticipationCommandDto {
  @IsUUID()
  userId: string;
}
