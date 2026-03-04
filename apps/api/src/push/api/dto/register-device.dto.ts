import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @Matches(/^Expo(nent)?PushToken\[.+\]$/, {
    message:
      'expoPushToken must be a valid Expo push token (e.g. ExponentPushToken[xxx])',
  })
  expoPushToken: string;

  @IsString()
  @IsIn(['ios', 'android'])
  platform: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
