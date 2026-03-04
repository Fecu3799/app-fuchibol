import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { PushController } from './api/push.controller';
import { RegisterDeviceUseCase } from './application/register-device.use-case';
import { GetPushDevicesQuery } from './application/get-push-devices.query';
import { PushService } from './application/push.service';
import { ExpoNotificationProvider } from './expo-notification.provider';
import { NOTIFICATION_PROVIDER } from './notification-provider.interface';

@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [
    RegisterDeviceUseCase,
    GetPushDevicesQuery,
    PushService,
    { provide: NOTIFICATION_PROVIDER, useClass: ExpoNotificationProvider },
  ],
  exports: [PushService, GetPushDevicesQuery, NOTIFICATION_PROVIDER],
})
export class PushModule {}
