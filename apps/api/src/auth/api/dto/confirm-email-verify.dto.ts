import { IsString } from 'class-validator';

export class ConfirmEmailVerifyDto {
  @IsString()
  token: string;
}
