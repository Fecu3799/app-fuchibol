import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;

  @IsUUID()
  clientMsgId!: string;
}
