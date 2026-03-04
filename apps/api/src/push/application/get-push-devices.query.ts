import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class GetPushDevicesQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string) {
    const devices = await this.prisma.client.pushDevice.findMany({
      where: { userId },
      orderBy: [{ disabledAt: 'asc' }, { lastSeenAt: 'desc' }],
      select: {
        id: true,
        platform: true,
        deviceName: true,
        deviceId: true,
        lastSeenAt: true,
        disabledAt: true,
      },
    });
    return { devices };
  }
}
