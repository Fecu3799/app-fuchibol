import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsBoolean()
  pushMatchReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  pushMatchChanges?: boolean;

  @IsOptional()
  @IsBoolean()
  pushChatMessages?: boolean;
}
