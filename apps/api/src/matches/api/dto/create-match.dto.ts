import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class CreateMatchDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDateString()
  startsAt: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity: number;
}
