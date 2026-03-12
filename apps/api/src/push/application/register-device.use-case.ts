import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface RegisterDeviceInput {
  userId: string;
  expoPushToken: string;
  platform: string;
  deviceName?: string;
  deviceId?: string;
}

@Injectable()
export class RegisterDeviceUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: RegisterDeviceInput) {
    const now = new Date();
    return this.prisma.client.$transaction(async (tx) => {
      // Remove any stale push device rows for the same physical device that
      // belong to a different user. This handles account switching without an
      // explicit logout (e.g. force-quit before logout, or token refresh path).
      if (input.deviceId) {
        await tx.pushDevice.deleteMany({
          where: { deviceId: input.deviceId, userId: { not: input.userId } },
        });
      }

      return tx.pushDevice.upsert({
        where: { expoPushToken: input.expoPushToken },
        update: {
          userId: input.userId,
          platform: input.platform,
          deviceName: input.deviceName ?? null,
          deviceId: input.deviceId ?? null,
          lastSeenAt: now,
          disabledAt: null,
        },
        create: {
          userId: input.userId,
          expoPushToken: input.expoPushToken,
          platform: input.platform,
          deviceName: input.deviceName ?? null,
          deviceId: input.deviceId ?? null,
          lastSeenAt: now,
        },
        select: {
          id: true,
          expoPushToken: true,
          platform: true,
          disabledAt: true,
        },
      });
    });
  }
}
