import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString({ message: 'INVALID_MESSAGE' })
  @IsNotEmpty({ message: 'INVALID_MESSAGE' })
  @MaxLength(2000, { message: 'MESSAGE_TOO_LARGE' })
  body!: string;

  @IsUUID()
  clientMsgId!: string;
}
