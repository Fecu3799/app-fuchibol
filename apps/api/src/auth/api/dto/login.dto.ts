import {
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

class DeviceDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}

export class LoginDto {
  @IsString()
  @Transform(({ value }) => (value as string).toLowerCase().trim())
  identifier: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DeviceDto)
  device?: DeviceDto;
}
