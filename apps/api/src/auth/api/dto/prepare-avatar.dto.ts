import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class PrepareAvatarDto {
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsInt()
  @IsPositive()
  size: number;
}
