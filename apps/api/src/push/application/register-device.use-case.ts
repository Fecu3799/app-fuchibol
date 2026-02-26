import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface RegisterDeviceInput {
  userId: string;
  expoPushToken: string;
  platform: string;
  deviceName?: string;
}

@Injectable()
export class RegisterDeviceUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: RegisterDeviceInput) {
    const now = new Date();
    return this.prisma.client.pushDevice.upsert({
      where: { expoPushToken: input.expoPushToken },
      update: {
        userId: input.userId,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
        lastSeenAt: now,
        disabledAt: null,
      },
      create: {
        userId: input.userId,
        expoPushToken: input.expoPushToken,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
        lastSeenAt: now,
      },
      select: {
        id: true,
        expoPushToken: true,
        platform: true,
        disabledAt: true,
      },
    });
  }
}
