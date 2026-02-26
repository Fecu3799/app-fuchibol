import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class TestPushDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  @IsUUID()
  matchId?: string;
}
