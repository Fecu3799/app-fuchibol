import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class GetDashboardQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(todayEnd);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const [
      totalUsers,
      bannedUsers,
      activeUsers,
      matchesToday,
      matchesTomorrow,
      pendingInvites,
      deliveredL24h,
      disabledDevices,
    ] = await Promise.all([
      this.prisma.client.user.count(),
      this.prisma.client.user.count({ where: { bannedAt: { not: null } } }),
      this.prisma.client.user.count({
        where: { updatedAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.client.match.count({
        where: { startsAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.client.match.count({
        where: { startsAt: { gte: tomorrowStart, lte: tomorrowEnd } },
      }),
      this.prisma.client.matchParticipant.count({
        where: { status: 'INVITED' },
      }),
      this.prisma.client.notificationDelivery.count({
        where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.client.pushDevice.count({
        where: { disabledAt: { not: null } },
      }),
    ]);

    return {
      users: { total: totalUsers, activeL7d: activeUsers, banned: bannedUsers },
      matches: { today: matchesToday, tomorrow: matchesTomorrow },
      notifications: { deliveredL24h, pendingInvites, disabledDevices },
    };
  }
}
