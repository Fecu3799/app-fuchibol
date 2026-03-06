import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class ConfirmAvatarDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsInt()
  @IsPositive()
  size: number;
}
