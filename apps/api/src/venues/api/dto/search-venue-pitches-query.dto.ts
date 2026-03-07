import { IsEnum } from 'class-validator';

export enum PitchTypeDto {
  F5 = 'F5',
  F7 = 'F7',
  F9 = 'F9',
  F11 = 'F11',
}

export class SearchVenuePitchesQueryDto {
  @IsEnum(PitchTypeDto)
  pitchType: PitchTypeDto;
}
