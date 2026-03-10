import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SaveTeamsDto {
  @IsNumber()
  expectedRevision!: number;

  @IsArray()
  teamA!: (string | null)[];

  @IsArray()
  teamB!: (string | null)[];
}

export class GenerateTeamsDto {
  @IsNumber()
  expectedRevision!: number;
}

export class MoveTeamPlayerDto {
  @IsNumber()
  expectedRevision!: number;

  @IsString()
  @IsNotEmpty()
  fromTeam!: string;

  @IsInt()
  @Min(0)
  fromSlotIndex!: number;

  @IsString()
  @IsNotEmpty()
  toTeam!: string;

  @IsInt()
  @Min(0)
  toSlotIndex!: number;
}
