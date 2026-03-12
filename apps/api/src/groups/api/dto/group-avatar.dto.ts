import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class PrepareGroupAvatarDto {
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsInt()
  @IsPositive()
  size!: number;
}

export class ConfirmGroupAvatarDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsInt()
  @IsPositive()
  size!: number;
}
